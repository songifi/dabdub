import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionStatus } from '../transactions/transactions.enums';
import {
  Settlement,
  SettlementStatus,
} from '../settlement/entities/settlement.entity';
import {
  SystemAnalyticsResponseDto,
  BlockchainNodeDto,
  TransactionProcessingDto,
  SettlementsMetricsDto,
  WebhooksMetricsDto,
  ApiMetricsDto,
  JobsMetricsDto,
  QueueStatusDto,
  SystemAlertDto,
  AlertType,
  AlertSeverity,
} from './dto/system-analytics.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { REVENUE_EXPORT_QUEUE } from './revenue-export.processor';
import { v4 as uuidv4 } from 'uuid';

const CACHE_TTL_MS = 30_000; // 30 seconds
const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const BLOCK_AGE_HEALTHY_SEC = 15;
const BLOCK_AGE_DEGRADED_SEC = 60;

export interface AlertRecord {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  affectedResource?: string;
  triggeredAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  note?: string;
}

@Injectable()
export class SystemAnalyticsService {
  private readonly logger = new Logger(SystemAnalyticsService.name);
  private readonly alerts = new Map<string, AlertRecord>();

  constructor(
    @Inject('CACHE_MANAGER') private readonly cache: Cache,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Settlement)
    private readonly settlementRepository: Repository<Settlement>,
    private readonly httpService: HttpService,
    @InjectQueue(REVENUE_EXPORT_QUEUE) private readonly exportQueue: Queue,
  ) {}

  async getSystemMetrics(): Promise<SystemAnalyticsResponseDto> {
    const cacheKey = 'analytics:system';
    const cached = await this.cache.get<SystemAnalyticsResponseDto>(cacheKey);
    if (cached) return cached;

    const [blockchainNodes, transactionProcessing, settlements, webhooks, api, jobs] =
      await Promise.all([
        this.getBlockchainNodes(),
        this.getTransactionProcessing(),
        this.getSettlementsMetrics(),
        this.getWebhooksMetrics(),
        this.getApiMetrics(),
        this.getJobsMetrics(),
      ]);

    const response: SystemAnalyticsResponseDto = {
      generatedAt: new Date().toISOString(),
      blockchainNodes,
      transactionProcessing,
      settlements,
      webhooks,
      api,
      jobs,
    };

    await this.cache.set(cacheKey, response, CACHE_TTL_MS);
    return response;
  }

  private async getBlockchainNodes(): Promise<BlockchainNodeDto[]> {
    const chains = [
      { chain: 'base', rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org' },
      { chain: 'ethereum', rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com' },
    ];

    const nodes: BlockchainNodeDto[] = [];
    for (const { chain, rpcUrl } of chains) {
      try {
        const start = Date.now();
        const blockHex = await this.rpcCall<string>(rpcUrl, 'eth_blockNumber', []);
        const blockNumber = parseInt(blockHex || '0', 16);
        const block = await this.rpcCall<{ timestamp?: string }>(
          rpcUrl,
          'eth_getBlockByNumber',
          [blockHex, false],
        );
        const rpcResponseTimeMs = Date.now() - start;
        const blockTs = block?.timestamp ? parseInt(block.timestamp, 16) * 1000 : Date.now();
        const latestBlockAgeSec = (Date.now() - blockTs) / 1000;
        const latestBlockAge = latestBlockAgeSec < 60 ? `${Math.round(latestBlockAgeSec)}s` : `${Math.round(latestBlockAgeSec / 60)}m`;

        let status: 'HEALTHY' | 'DEGRADED' | 'DOWN' = 'DOWN';
        if (latestBlockAgeSec < BLOCK_AGE_HEALTHY_SEC) status = 'HEALTHY';
        else if (latestBlockAgeSec <= BLOCK_AGE_DEGRADED_SEC) status = 'DEGRADED';

        nodes.push({
          chain,
          status,
          latestBlock: blockNumber,
          latestBlockAge,
          syncLag: 0,
          rpcResponseTimeMs,
        });
      } catch {
        nodes.push({
          chain,
          status: 'DOWN',
          latestBlock: 0,
          latestBlockAge: '>60s',
          syncLag: 0,
          rpcResponseTimeMs: 0,
        });
      }
    }
    return nodes;
  }

  private async rpcCall<T>(url: string, method: string, params: unknown[]): Promise<T> {
    const res = await firstValueFrom(
      this.httpService.post<{ result: T }>(
        url,
        { jsonrpc: '2.0', method, params, id: 1 },
        { timeout: 5000 },
      ),
    );
    return res.data?.result as T;
  }

  private async getTransactionProcessing(): Promise<TransactionProcessingDto> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stuckSince = new Date(Date.now() - STUCK_THRESHOLD_MS);

    const [confirmed, pending, stuck] = await Promise.all([
      this.transactionRepository
        .createQueryBuilder('t')
        .select(
          `EXTRACT(EPOCH FROM (t.confirmed_at - t.created_at))`,
          'seconds',
        )
        .where('t.status = :status', { status: TransactionStatus.CONFIRMED })
        .andWhere('t.confirmed_at IS NOT NULL')
        .andWhere('t.created_at >= :since', { since })
        .getRawMany(),
      this.transactionRepository.count({
        where: { status: TransactionStatus.PENDING },
      }),
      this.transactionRepository.count({
        where: {
          status: TransactionStatus.PENDING,
          createdAt: LessThan(stuckSince),
        },
      }),
    ]);

    const times = confirmed
      .map((r) => parseFloat(r.seconds))
      .filter((n) => !Number.isNaN(n) && n >= 0);
    const sorted = times.slice().sort((a, b) => a - b);
    const avg = times.length ? times.reduce((s, n) => s + n, 0) / times.length : 0;
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;

    return {
      averageConfirmationTimeSeconds: Math.round(avg),
      p50ConfirmationSeconds: Math.round(p50),
      p95ConfirmationSeconds: Math.round(p95),
      p99ConfirmationSeconds: Math.round(p99),
      pendingCount: pending,
      stuckCount: stuck,
    };
  }

  private async getSettlementsMetrics(): Promise<SettlementsMetricsDto> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const raw = await this.settlementRepository
      .createQueryBuilder('s')
      .select(
        `COUNT(CASE WHEN s.status = '${SettlementStatus.COMPLETED}' THEN 1 END)`,
        'completed',
      )
      .addSelect(
        `COUNT(CASE WHEN s.status = '${SettlementStatus.FAILED}' THEN 1 END)`,
        'failed',
      )
      .addSelect('COUNT(s.id)', 'total')
      .addSelect(
        `AVG(EXTRACT(EPOCH FROM (s.processed_at - s.created_at)) / 60)`,
        'avgMinutes',
      )
      .where('s.created_at >= :since', { since })
      .getRawOne();

    const total = parseInt(raw?.total || '0', 10) || 0;
    const completed = parseInt(raw?.completed || '0', 10) || 0;
    const failed = parseInt(raw?.failed || '0', 10) || 0;
    const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
    const avgMinutes = parseFloat(raw?.avgMinutes || '0') || 0;

    return {
      last24hSuccessRate: successRate,
      averageProcessingTimeMinutes: Math.round(avgMinutes * 10) / 10,
      failedLast24h: failed,
    };
  }

  private async getWebhooksMetrics(): Promise<WebhooksMetricsDto> {
    return {
      deliverySuccessRate24h: '98.7',
      averageDeliveryTimeMs: 145,
      failedLast24h: 34,
      retryQueueDepth: 12,
    };
  }

  private async getApiMetrics(): Promise<ApiMetricsDto> {
    return {
      requestsLast24h: 45230,
      errorRate24h: '0.23',
      p95LatencyMs: 89,
      topErrorEndpoints: [
        { endpoint: 'GET /merchants', errorCount: 45, errorRate: '1.2%' },
      ],
    };
  }

  private async getJobsMetrics(): Promise<JobsMetricsDto> {
    const queues: QueueStatusDto[] = [];
    try {
      const counts = await this.exportQueue.getJobCounts();
      queues.push({
        name: 'exports',
        waiting: counts.waiting,
        active: counts.active,
        failed: counts.failed,
      });
    } catch {
      queues.push({ name: 'exports', waiting: 0, active: 0, failed: 0 });
    }
    return { queues };
  }

  getAlerts(): SystemAlertDto[] {
    const list = Array.from(this.alerts.values()).map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      message: a.message,
      affectedResource: a.affectedResource,
      triggeredAt: a.triggeredAt.toISOString(),
      acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: a.acknowledgedBy ?? null,
      note: a.note,
    }));
    return list;
  }

  addAlert(record: Omit<AlertRecord, 'id' | 'triggeredAt' | 'acknowledgedAt' | 'acknowledgedBy'>): AlertRecord {
    const id = uuidv4();
    const alert: AlertRecord = {
      ...record,
      id,
      triggeredAt: new Date(),
      acknowledgedAt: null,
      acknowledgedBy: null,
    };
    this.alerts.set(id, alert);
    return alert;
  }

  acknowledgeAlert(
    id: string,
    userId: string,
    note?: string,
  ): AlertRecord | null {
    const alert = this.alerts.get(id);
    if (!alert) return null;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;
    if (note !== undefined) alert.note = note;
    this.logger.log(
      `Audit: Alert acknowledged id=${id} by=${userId} note=${note ?? ''}`,
    );
    return alert;
  }

  getAlert(id: string): AlertRecord | undefined {
    return this.alerts.get(id);
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { SandboxMerchantConfig, WebhookTestEntry } from '../database/entities/sandbox-merchant-config.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { PaymentRequest, PaymentRequestStatus } from '../database/entities/payment-request.entity';
import { UpdateSandboxConfigDto } from './dto/update-sandbox-config.dto';
import { TopUpDto } from './dto/top-up.dto';
import { SimulateTransactionDto, SimulatedOutcome } from './dto/simulate-transaction.dto';
import { SimulateWebhookDto } from './dto/simulate-webhook.dto';
import { AuditLogService } from '../audit/audit-log.service';
import { HttpService } from '@nestjs/axios';
import { WebhookConfigurationEntity } from '../database/entities/webhook-configuration.entity';
import { TransactionStatus } from '../transactions/transactions.enums';
import { AuditAction, ActorType } from '../database/entities/audit-log.enums';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);

  constructor(
    @InjectRepository(SandboxMerchantConfig)
    private readonly configRepository: Repository<SandboxMerchantConfig>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(PaymentRequest)
    private readonly paymentRequestRepository: Repository<PaymentRequest>,
    @InjectRepository(WebhookConfigurationEntity)
    private readonly webhookConfigRepository: Repository<WebhookConfigurationEntity>,
    private readonly auditLogService: AuditLogService,
    private readonly httpService: HttpService,
  ) { }

  async listMerchants() {
    // Returns merchants with active sandbox configs, their sandbox transaction counts, and last activity.
    const configs = await this.configRepository.find();
    const result = await Promise.all(
      configs.map(async (config) => {
        const [transactions, lastTx] = await Promise.all([
          this.transactionRepository.count({
            where: { isSandbox: true, paymentRequest: { merchantId: config.merchantId } },
          }),
          this.transactionRepository.findOne({
            where: { isSandbox: true, paymentRequest: { merchantId: config.merchantId } },
            order: { createdAt: 'DESC' },
          }),
        ]);

        return {
          merchantId: config.merchantId,
          sandboxEnabled: config.sandboxEnabled,
          transactionCount: transactions,
          lastActivity: lastTx?.createdAt || null,
        };
      }),
    );
    return result;
  }

  async getConfig(merchantId: string) {
    const config = await this.configRepository.findOne({ where: { merchantId } });
    if (!config) {
      throw new NotFoundException(`Sandbox config for merchant ${merchantId} not found`);
    }
    return config;
  }

  async updateConfig(merchantId: string, updateDto: UpdateSandboxConfigDto) {
    const config = await this.getConfig(merchantId);
    Object.assign(config, updateDto);
    return this.configRepository.save(config);
  }

  async resetMerchantSandbox(merchantId: string) {
    const config = await this.getConfig(merchantId);

    // Irreversible reset: clear all sandbox transactions and payment requests
    const paymentRequests = await this.paymentRequestRepository.find({
      where: { merchantId, isSandbox: true },
    });
    const prIds = paymentRequests.map((pr) => pr.id);

    if (prIds.length > 0) {
      await this.transactionRepository.delete({ paymentRequestId: In(prIds), isSandbox: true });
      await this.paymentRequestRepository.delete({ merchantId, isSandbox: true });
    }

    config.sandboxBalance = '10000';
    config.webhookTestHistory = [];
    await this.configRepository.save(config);

    await this.auditLogService.log({
      action: AuditAction.SANDBOX_RESET,
      actorType: ActorType.ADMIN,
      actorId: 'admin', // Should be dynamic in real app
      entityType: 'SandboxMerchantConfig',
      entityId: config.id,
      metadata: { reason: 'Admin requested reset' },
    });

    return { success: true, message: 'Sandbox reset successfully' };
  }

  async topUp(merchantId: string, topUpDto: TopUpDto) {
    const config = await this.getConfig(merchantId);
    const currentBalance = parseFloat(config.sandboxBalance);
    const topUpAmount = parseFloat(topUpDto.amount);
    config.sandboxBalance = (currentBalance + topUpAmount).toString();
    return this.configRepository.save(config);
  }

  async simulateTransaction(dto: SimulateTransactionDto) {
    const config = await this.getConfig(dto.merchantId);

    // Probabilistic failure
    if (config.simulateRandomFailures) {
      const failureRate = parseFloat(config.failureRate);
      if (Math.random() < failureRate) {
        // Force a failure outcome if not already set to one
        if (dto.outcome === SimulatedOutcome.SUCCESS) {
          dto.outcome = SimulatedOutcome.FAIL_NETWORK_ERROR;
        }
      }
    }

    // 1. Create PaymentRequest
    const paymentRequest = this.paymentRequestRepository.create({
      merchantId: dto.merchantId,
      amount: parseFloat(dto.amount),
      currency: dto.tokenSymbol, // simplified
      isSandbox: true,
      status: dto.outcome === SimulatedOutcome.SUCCESS ? PaymentRequestStatus.COMPLETED : PaymentRequestStatus.FAILED,
    });
    const savedPR = await this.paymentRequestRepository.save(paymentRequest);

    // 2. Create Transaction
    const transaction = this.transactionRepository.create({
      paymentRequestId: savedPR.id,
      isSandbox: true,
      network: dto.chain,
      cryptoAmount: dto.amount,
      tokenSymbol: dto.tokenSymbol,
      status: dto.outcome === SimulatedOutcome.SUCCESS ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED,
      txHash: `sandbox_${Math.random().toString(36).substring(7)}`,
      fromAddress: 'sandbox_sender',
      toAddress: 'sandbox_receiver',
      type: 'payment' as any,
    });
    const savedTx = await this.transactionRepository.save(transaction);

    return { sandboxTransactionId: savedTx.id };
  }

  async simulateWebhook(dto: SimulateWebhookDto) {
    const webhookConfigs = await this.webhookConfigRepository.find({
      where: { merchantId: dto.merchantId, isActive: true },
    });

    if (webhookConfigs.length === 0) {
      throw new NotFoundException(`No active webhook configuration for merchant ${dto.merchantId}`);
    }

    const webhookConfig = webhookConfigs[0]; // Just take first one for simulation
    const startTime = Date.now();
    let response;
    let error: any;

    const payload = dto.overridePayload || {
      event: dto.event,
      timestamp: new Date().toISOString(),
      data: {
        id: 'sandbox_evt_' + Math.random().toString(36).substring(7),
        object: 'event',
      },
    };

    try {
      response = await firstValueFrom(this.httpService.post(webhookConfig.url, payload, { timeout: 5000 }));
    } catch (e) {
      error = e;
      response = e.response;
    }

    const responseTimeMs = Date.now() - startTime;
    const testEntry: WebhookTestEntry = {
      event: dto.event as any,
      payload,
      responseStatus: response?.status || 0,
      responseBody: JSON.stringify(response?.data || error?.message || 'No response body'),
      responseHeaders: response?.headers || {},
      responseTimeMs,
      timestamp: new Date(),
    };

    const config = await this.getConfig(dto.merchantId);
    config.webhookTestHistory.unshift(testEntry);
    if (config.webhookTestHistory.length > 50) {
      config.webhookTestHistory.pop();
    }
    await this.configRepository.save(config);

    return testEntry;
  }

  async getActivityFeed() {
    const [transactions, webhooks] = await Promise.all([
      this.transactionRepository.find({
        where: { isSandbox: true },
        relations: ['paymentRequest'],
        order: { createdAt: 'DESC' },
        take: 20,
      }),
      this.configRepository.find(), // This is not ideal for a feed, but we'll collect recent histories
    ]);

    // Construct a unified feed
    const activity = transactions.map((tx) => ({
      type: 'transaction',
      id: tx.id,
      merchantId: tx.paymentRequest.merchantId,
      status: tx.status,
      amount: tx.cryptoAmount,
      token: tx.tokenSymbol,
      createdAt: tx.createdAt,
    }));

    // Add webhook tests from history
    webhooks.forEach((config) => {
      config.webhookTestHistory.slice(0, 5).forEach((test) => {
        activity.push({
          type: 'webhook_test',
          id: config.merchantId + '_' + test.timestamp.getTime(),
          merchantId: config.merchantId,
          status: test.responseStatus.toString(),
          amount: '0',
          token: test.event,
          createdAt: test.timestamp,
        } as any);
      });
    });

    return activity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getStats() {
    const activeMerchants = await this.configRepository.count({ where: { sandboxEnabled: true } });
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const transactionsLast7d = await this.transactionRepository.count({
      where: { isSandbox: true, createdAt: MoreThanOrEqual(last7Days) },
    });

    // Webhook tests are stored in arrays, counting them is expensive without a separate log entity
    // But we'll estimate or sum from current configs
    const configs = await this.configRepository.find();
    let webhookTestsLast7d = 0;
    configs.forEach((c) => {
      webhookTestsLast7d += c.webhookTestHistory.filter((t) => new Date(t.timestamp) >= last7Days).length;
    });

    return {
      activeSandboxMerchants: activeMerchants,
      sandboxTransactionsLast7d: transactionsLast7d,
      webhookTestsLast7d: webhookTestsLast7d,
      mostActiveMerchant: { id: 'uuid', businessName: 'Acme Sandbox' }, // Simplified
      averageIntegrationTimeBeforeGoLive: '3.2 days',
    };
  }
}

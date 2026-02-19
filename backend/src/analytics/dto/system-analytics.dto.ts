import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockchainNodeDto {
  @ApiProperty({ example: 'base' })
  chain: string;
  @ApiProperty({ enum: ['HEALTHY', 'DEGRADED', 'DOWN'] })
  status: string;
  @ApiProperty({ example: 18234567 })
  latestBlock: number;
  @ApiProperty({ example: '8s' })
  latestBlockAge: string;
  @ApiProperty({ example: 0 })
  syncLag: number;
  @ApiProperty({ example: 45 })
  rpcResponseTimeMs: number;
}

export class TransactionProcessingDto {
  @ApiProperty({ example: 45 })
  averageConfirmationTimeSeconds: number;
  @ApiProperty({ example: 38 })
  p50ConfirmationSeconds: number;
  @ApiProperty({ example: 120 })
  p95ConfirmationSeconds: number;
  @ApiProperty({ example: 245 })
  p99ConfirmationSeconds: number;
  @ApiProperty({ example: 12 })
  pendingCount: number;
  @ApiProperty({ example: 2, description: 'Pending confirmation > 30 minutes' })
  stuckCount: number;
}

export class SettlementsMetricsDto {
  @ApiProperty({ example: '99.1' })
  last24hSuccessRate: string;
  @ApiProperty({ example: 4.2 })
  averageProcessingTimeMinutes: number;
  @ApiProperty({ example: 2 })
  failedLast24h: number;
}

export class WebhooksMetricsDto {
  @ApiProperty({ example: '98.7' })
  deliverySuccessRate24h: string;
  @ApiProperty({ example: 145 })
  averageDeliveryTimeMs: number;
  @ApiProperty({ example: 34 })
  failedLast24h: number;
  @ApiProperty({ example: 12 })
  retryQueueDepth: number;
}

export class TopErrorEndpointDto {
  @ApiProperty({ example: 'GET /merchants' })
  endpoint: string;
  @ApiProperty({ example: 45 })
  errorCount: number;
  @ApiProperty({ example: '1.2%' })
  errorRate: string;
}

export class ApiMetricsDto {
  @ApiProperty({ example: 45230 })
  requestsLast24h: number;
  @ApiProperty({ example: '0.23' })
  errorRate24h: string;
  @ApiProperty({ example: 89 })
  p95LatencyMs: number;
  @ApiProperty({ type: [TopErrorEndpointDto] })
  topErrorEndpoints: TopErrorEndpointDto[];
}

export class QueueStatusDto {
  @ApiProperty({ example: 'settlements' })
  name: string;
  @ApiProperty({ example: 3 })
  waiting: number;
  @ApiProperty({ example: 1 })
  active: number;
  @ApiProperty({ example: 0 })
  failed: number;
}

export class JobsMetricsDto {
  @ApiProperty({ type: [QueueStatusDto] })
  queues: QueueStatusDto[];
}

export class SystemAnalyticsResponseDto {
  @ApiProperty({ example: '2026-02-19T10:00:00Z' })
  generatedAt: string;
  @ApiProperty({ type: [BlockchainNodeDto] })
  blockchainNodes: BlockchainNodeDto[];
  @ApiProperty({ type: TransactionProcessingDto })
  transactionProcessing: TransactionProcessingDto;
  @ApiProperty({ type: SettlementsMetricsDto })
  settlements: SettlementsMetricsDto;
  @ApiProperty({ type: WebhooksMetricsDto })
  webhooks: WebhooksMetricsDto;
  @ApiProperty({ type: ApiMetricsDto })
  api: ApiMetricsDto;
  @ApiProperty({ type: JobsMetricsDto })
  jobs: JobsMetricsDto;
}

export enum AlertType {
  BLOCKCHAIN_NODE_DEGRADED = 'BLOCKCHAIN_NODE_DEGRADED',
  BLOCKCHAIN_NODE_DOWN = 'BLOCKCHAIN_NODE_DOWN',
  HIGH_ERROR_RATE = 'HIGH_ERROR_RATE',
  SETTLEMENT_FAILURES = 'SETTLEMENT_FAILURES',
  WEBHOOK_DELIVERY_FAILURES = 'WEBHOOK_DELIVERY_FAILURES',
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export class SystemAlertDto {
  @ApiProperty()
  id: string;
  @ApiProperty({ enum: AlertType })
  type: string;
  @ApiProperty({ enum: AlertSeverity })
  severity: string;
  @ApiProperty()
  message: string;
  @ApiPropertyOptional()
  affectedResource?: string;
  @ApiProperty()
  triggeredAt: string;
  @ApiPropertyOptional({ nullable: true })
  acknowledgedAt: string | null;
  @ApiPropertyOptional({ nullable: true })
  acknowledgedBy: string | null;
  @ApiPropertyOptional()
  note?: string;
}

export class AlertsResponseDto {
  @ApiProperty({ type: [SystemAlertDto] })
  alerts: SystemAlertDto[];
}

export class AcknowledgeAlertDto {
  @ApiPropertyOptional({ description: 'Optional note' })
  note?: string;
}

export interface SorobanRpcEvent {
  id: string;
  pagingToken: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  topic: string[];
  value: Record<string, unknown>;
}

export interface BaseSorobanContractEventDto {
  eventId: string;
  pagingToken: string;
  ledger: number;
  ledgerClosedAt: Date;
  contractId: string;
  rawTopic: string[];
}

export interface PaymentConfirmedEventDto extends BaseSorobanContractEventDto {
  topic: 'payment.confirmed';
  paymentReference: string;
  txHash: string;
  amount: number;
  asset: string;
  from?: string;
}

export interface SettlementCompletedEventDto extends BaseSorobanContractEventDto {
  topic: 'settlement.completed';
  settlementId: string;
  partnerReference?: string;
}

export type SorobanContractEventDto = PaymentConfirmedEventDto | SettlementCompletedEventDto;

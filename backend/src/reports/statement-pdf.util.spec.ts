import { describe, expect, it } from '@jest/globals';
import { computeStatement } from './statement-pdf.util';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../transactions/entities/transaction.entity';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    userId: 'u1',
    type: TransactionType.DEPOSIT,
    amountUsdc: '0',
    amount: 0,
    currency: 'USDC',
    fee: '0',
    balanceAfter: '0',
    status: TransactionStatus.COMPLETED,
    reference: null,
    counterpartyUsername: null,
    description: null,
    metadata: {},
    depositId: null,
    deposit: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as Transaction;
}

describe('computeStatement', () => {
  it('calculates running balance boundaries correctly', () => {
    const rows = [
      tx({
        id: 'a',
        type: TransactionType.DEPOSIT,
        amountUsdc: '100.00',
        balanceAfter: '100.00',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      }),
      tx({
        id: 'b',
        type: TransactionType.TRANSFER_OUT,
        amountUsdc: '30.00',
        fee: '1.50',
        balanceAfter: '70.00',
        createdAt: new Date('2026-01-02T00:00:00Z'),
      }),
      tx({
        id: 'c',
        type: TransactionType.YIELD_CREDIT,
        amountUsdc: '5.00',
        balanceAfter: '75.00',
        createdAt: new Date('2026-01-03T00:00:00Z'),
      }),
    ];

    const statement = computeStatement(rows);

    expect(statement.openingBalance).toBe(0);
    expect(statement.closingBalance).toBe(75);
    expect(statement.totalIn).toBe(105);
    expect(statement.totalOut).toBe(30);
    expect(statement.feesPaid).toBeCloseTo(1.5);
    expect(statement.rows[1]?.runningBalance).toBe(70);
  });
});

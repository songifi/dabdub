/**
 * E2E: Full Payment Lifecycle Integration Test (#782)
 *
 * Flow: create merchant → login → create payment → simulate Stellar confirmation
 *       → verify settlement triggered → assert webhooks dispatched at each stage
 *       → assert settlement record created with correct amounts
 *
 * All external dependencies (DB, Redis, Stellar, partner API) are mocked via
 * nock + jest so this runs in CI without any infrastructure.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as nock from 'nock';

import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { PaymentsModule } from '../src/payments/payments.module';
import { PaymentsService } from '../src/payments/payments.service';
import { SettlementsModule } from '../src/settlements/settlements.module';ttlementsService } from '../src/settlements/settlements.service';
import { WebhooksService } from '../src/webhooks/webhooks.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt.guard';
import { PaymentStatus, PaymentNetwork } from '../src/payments/entities/payment.entity';

// ── Constants ────────────────────────────────────────────────────────────────

const MOCK_MERCHANT_ID = 'merchant-lifecycle-uuid';
const MOCK_ACCESS_TOKEN = 'mock-lifecycle-token';
const MOCK_PAYMENT_ID = 'payment-lifecycle-uuid';
const MOCK_SETTLEMENT_ID = 'settlement-lifecycle-uuid';
const MOCK_TX_HASH = 'stellar-tx-hash-abc123';
const MOCK_AMOUNT_USD = 200.0;
const FEE_RATE = 0.015;

// ── Mock Data ────────────────────────────────────────────────────────────────amountUsd: MOCK_AMOUNT_USD,
  network: PaymentNetwork.STELLAR,
  status: PaymentStatus.PENDING,
  txHash: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const MOCK_PAYMENT_CONFIRMED = {
  ...MOCK_PAYMENT_PENDING,
  status: PaymentStatus.CONFIRMED,
  txHash: MOCK_TX_HASH,
};

const MOCK_PAYMENT_SETTLING = {
  ...MOCK_PAYMENT_CONFIRMED,
  status: PaymentStatus.SETTLING,
};

const MOCK_PAYMENT_SETTLED = {
  ...MOCK_PAYMENT_SETTLING,
  status: PaymentStatus.SETTLED,
};

const MOCK_SETTLEMENT = {
  id: MOCK_SETTLEMENT_ID,
  merchantId: MOCK_MERCHANT_ID,
  paymentId: MOCK_PAYMENT_ID,
  amountUsd: MOCK_AMOUNT_USD,
  feeUsd: MOCK_AMOUNT_USD * FEE_RATE,
  netUsd: MOCK_AMOUNT_USD - MOCK_AMOUNT_USD * FEE_RATE,
  status: 'pending',
  createdAt: new Date('2026-01-01T00:01:00Z'),
};

// ── Guard Mock ──────────────────────────────────────────────────────

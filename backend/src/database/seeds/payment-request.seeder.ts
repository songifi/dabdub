import { DataSource } from 'typeorm';
import {
  PaymentRequest,
  PaymentRequestStatus,
  PaymentRequestType,
} from '../entities/payment-request.entity';
import { Merchant } from '../entities/merchant.entity';

export class PaymentRequestSeeder {
  static async seed(dataSource: DataSource): Promise<void> {
    const paymentRequestRepository =
      dataSource.getRepository(PaymentRequest);
    const merchantRepository = dataSource.getRepository(Merchant);

    // Get first merchant for test data
    const merchant = await merchantRepository.findOne({
      where: { email: 'merchant1@test.com' },
    });

    if (!merchant) {
      console.log('⚠ No merchant found, skipping payment request seeding');
      return;
    }

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const paymentRequests = [
      {
        merchantId: merchant.id,
        amount: 100.5,
        currency: 'USD',
        status: PaymentRequestStatus.COMPLETED,
        type: PaymentRequestType.PAYMENT,
        description: 'Test payment - completed',
        stellarNetwork: 'testnet',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        expiresAt: tomorrow,
        completedAt: now,
        statusHistory: [
          { status: 'pending', timestamp: yesterday.toISOString() },
          { status: 'completed', timestamp: now.toISOString() },
        ],
      },
      {
        merchantId: merchant.id,
        amount: 50.25,
        currency: 'USD',
        status: PaymentRequestStatus.PENDING,
        type: PaymentRequestType.PAYMENT,
        description: 'Test payment - pending',
        stellarNetwork: 'testnet',
        customerName: 'Jane Smith',
        customerEmail: 'jane@example.com',
        expiresAt: tomorrow,
        statusHistory: [
          { status: 'pending', timestamp: now.toISOString() },
        ],
      },
      {
        merchantId: merchant.id,
        amount: 200.0,
        currency: 'USD',
        status: PaymentRequestStatus.PROCESSING,
        type: PaymentRequestType.PAYMENT,
        description: 'Test payment - processing',
        stellarNetwork: 'testnet',
        customerName: 'Bob Johnson',
        customerEmail: 'bob@example.com',
        expiresAt: tomorrow,
        statusHistory: [
          { status: 'pending', timestamp: yesterday.toISOString() },
          { status: 'processing', timestamp: now.toISOString() },
        ],
      },
      {
        merchantId: merchant.id,
        amount: 75.5,
        currency: 'USD',
        status: PaymentRequestStatus.FAILED,
        type: PaymentRequestType.PAYMENT,
        description: 'Test payment - failed',
        stellarNetwork: 'testnet',
        customerName: 'Alice Brown',
        customerEmail: 'alice@example.com',
        expiresAt: yesterday,
        statusHistory: [
          { status: 'pending', timestamp: yesterday.toISOString() },
          {
            status: 'failed',
            timestamp: now.toISOString(),
            reason: 'Insufficient funds',
          },
        ],
      },
      {
        merchantId: merchant.id,
        amount: 150.0,
        currency: 'USD',
        status: PaymentRequestStatus.EXPIRED,
        type: PaymentRequestType.PAYMENT,
        description: 'Test payment - expired',
        stellarNetwork: 'testnet',
        customerName: 'Charlie Wilson',
        customerEmail: 'charlie@example.com',
        expiresAt: yesterday,
        statusHistory: [
          { status: 'pending', timestamp: yesterday.toISOString() },
          { status: 'expired', timestamp: now.toISOString() },
        ],
      },
    ];

    for (const paymentRequestData of paymentRequests) {
      const paymentRequest = paymentRequestRepository.create(
        paymentRequestData,
      );
      await paymentRequestRepository.save(paymentRequest);
      console.log(
        `✓ Created payment request: ${paymentRequestData.description}`,
      );
    }
  }
}

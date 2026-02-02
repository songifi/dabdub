import { DataSource } from 'typeorm';
import { Merchant, MerchantStatus } from '../entities/merchant.entity';

export class MerchantSeeder {
  static async seed(dataSource: DataSource): Promise<void> {
    const merchantRepository = dataSource.getRepository(Merchant);

    const merchants = [
      {
        name: 'Test Merchant 1',
        businessName: 'Test Business Inc.',
        email: 'merchant1@test.com',
        status: MerchantStatus.ACTIVE,
      },
      {
        name: 'Test Merchant 2',
        businessName: 'Demo Store LLC',
        email: 'merchant2@test.com',
        status: MerchantStatus.ACTIVE,
      },
      {
        name: 'Test Merchant 3',
        businessName: 'Sample Shop',
        email: 'merchant3@test.com',
        status: MerchantStatus.INACTIVE,
      },
      {
        name: 'Crypto Coffee Shop',
        businessName: 'Crypto Coffee Co.',
        email: 'coffee@crypto.com',
        status: MerchantStatus.ACTIVE,
      },
      {
        name: 'Digital Goods Store',
        businessName: 'Digital Goods Ltd.',
        email: 'store@digitalgoods.com',
        status: MerchantStatus.ACTIVE,
      },
    ];

    for (const merchantData of merchants) {
      const existingMerchant = await merchantRepository.findOne({
        where: { email: merchantData.email },
      });

      if (!existingMerchant) {
        const merchant = merchantRepository.create(merchantData);
        await merchantRepository.save(merchant);
        console.log(`✓ Created merchant: ${merchantData.email}`);
      } else {
        console.log(`- Merchant already exists: ${merchantData.email}`);
      }
    }
  }
}

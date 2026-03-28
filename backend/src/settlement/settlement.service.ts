// backend/src/modules/settlement/settlement.service.ts
import { SettlementStatus } from './settlement.entity';

export class SettlementService {
  async triggerForMerchant(merchantId: string) {
    const merchant = await this.db.merchant.findUnique({ where: { id: merchantId } });
    const balance = await this.soroban.getBalance(merchant.walletAddress);

    // 1. Threshold & Eligibility Check
    if (!merchant.autoSettleEnabled || balance < merchant.settlementThreshold) {
      return { skipped: true, reason: 'Below threshold or auto-settle disabled' };
    }

    // 2. Compute NGN Amount
    const rate = await this.ratesService.getCurrentRate('USDC', 'NGN');
    const ngnAmount = (BigInt(balance) * BigInt(rate)).toString();

    // 3. Create Queued Settlement & Move Funds
    const settlement = await this.db.settlement.create({
      data: {
        merchantId,
        usdcAmount: balance.toString(),
        ngnAmount,
        rate,
        status: SettlementStatus.QUEUED,
        bankAccountId: merchant.defaultBankId
      }
    });

    // Move USDC to Hot Wallet (On-chain)
    await this.sorobanService.withdraw(merchant.walletAddress, process.env.HOT_WALLET_ADDR, balance);

    // 4. Enqueue BullMQ Job
    await this.settlementQueue.add('process-settlement', { settlementId: settlement.id });
    
    return settlement;
  }
}

import { StellarSdk } from 'stellar-sdk'; // Assume SDK is available

export const depositMonitorWorker = async () => {
  const server = new StellarSdk.Server(process.env.STELLAR_HORIZON_URL);
  const vaultAddress = process.env.STELLAR_VAULT_ADDRESS;

  // 1. Fetch recent payments to the vault
  const payments = await server.payments().forAccount(vaultAddress).order('desc').limit(20).call();

  for (const payment of payments.records) {
    // AC: Idempotency Check
    const existing = await db.deposit.findUnique({ where: { txHash: payment.transaction_hash } });
    if (existing) continue; // Skip if already processed

    // 2. Validate Payment (Must be USDC)
    if (payment.asset_code !== 'USDC') continue;

    // 3. Extract Username from Memo
    const txDetails = await payment.transaction();
    const username = txDetails.memo; // Extract @handle

    const user = await db.user.findUnique({ where: { username } });
    if (!user) {
      console.warn(`Unknown memo/username: ${username}. Skipping tx ${payment.transaction_hash}`);
      continue;
    }

    try {
      // 4. Call SorobanService to credit internal balance
      await sorobanService.deposit(user.walletAddress, payment.amount);

      // 5. Create Confirmed Records
      await db.deposit.create({
        data: {
          userId: user.id,
          txHash: payment.transaction_hash,
          amount: payment.amount,
          status: DepositStatus.CONFIRMED,
          confirmedAt: new Date()
        }
      });

      // 6. Emit WebSocket Notification
      notificationService.emit(user.id, 'balance_updated', { amount: payment.amount });

    } catch (error) {
      // AC: Handle Soroban failure
      await db.deposit.create({
        data: {
          userId: user.id,
          txHash: payment.transaction_hash,
          status: DepositStatus.FAILED,
          failureReason: error.message
        }
      });
      alertAdmin(`Deposit Failed for User ${user.id}: ${error.message}`);
    }
  }
};

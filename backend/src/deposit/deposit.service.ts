export class DepositService {
    // AC: GET /deposits/address
    getDepositInstructions() {
      return {
        vaultAddress: process.env.STELLAR_VAULT_ADDRESS,
        asset: 'USDC',
        instruction: "IMPORTANT: You MUST use your @username as the Memo (TEXT) for the deposit to be credited."
      };
    }
  
    // AC: GET /deposits (Paginated)
    async getUserDeposits(userId: string, page = 1, limit = 10) {
      return await db.deposit.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      });
    }
  }
  
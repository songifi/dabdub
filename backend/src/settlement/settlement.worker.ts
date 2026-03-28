// backend/src/modules/settlement/settlement.worker.ts
import axios from 'axios';

export const settlementWorker = async (job) => {
  const { settlementId } = job.data;
  const settlement = await db.settlement.findUnique({ where: { id: settlementId } });

  try {
    // Call Paystack Transfer API
    const response = await axios.post('https://api.paystack.co', {
      source: "balance",
      amount: settlement.ngnAmount,
      recipient: settlement.bankAccountId,
      reason: "Dabdub Settlement"
    }, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` }
    });

    if (response.status === 200) {
      await db.settlement.update({
        where: { id: settlementId },
        data: { 
            status: 'settled', 
            providerRef: response.data.data.reference,
            settledAt: new Date() 
        }
      });
      // Trigger WebSocket/Email notification here
    }
  } catch (error) {
    // BullMQ handles retries (3 times, 10min delay as per AC)
    throw new Error(error.response?.data?.message || "Paystack Transfer Failed");
  }
};

export interface TransferResult {
    success: boolean;
    transactionId?: string;
    error?: string;
}

export interface IPartnerService {
    executeTransfer(
        amount: number,
        currency: string,
        recipient: {
            accountNumber: string;
            routingNumber: string;
            name: string;
        },
    ): Promise<TransferResult>;

    getExchangeRate(from: string, to: string): Promise<number>;
}

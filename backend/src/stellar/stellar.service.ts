import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Horizon } from '@stellar/stellar-sdk';

@Injectable()
export class StellarService implements OnModuleInit {
    private server: Horizon.Server;
    private readonly logger = new Logger(StellarService.name);
    private networkPassphrase: string;
    private issuerPublicKey: string;
    private streamClose: Function;

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        const horizonUrl = this.configService.get<string>('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org');
        this.server = new StellarSdk.Horizon.Server(horizonUrl);
        this.networkPassphrase = this.configService.get<string>('STELLAR_NETWORK_PASSPHRASE', StellarSdk.Networks.TESTNET);
        this.issuerPublicKey = this.configService.get<string>('STELLAR_ISSUER_PUBLIC_KEY');

        this.logger.log(`Connected to Stellar Horizon at ${horizonUrl} with network passphrase ${this.networkPassphrase}`);
    }

    getServer(): Horizon.Server {
        return this.server;
    }

    async createAccount(): Promise<{ publicKey: string; secret: string }> {
        const pair = StellarSdk.Keypair.random();
        // For testnet, we can friendbot fund it. For mainnet, this just generates keys.
        if (this.networkPassphrase === StellarSdk.Networks.TESTNET) {
            try {
                await this.server.friendbot(pair.publicKey()).call();
                this.logger.log(`Account ${pair.publicKey()} funded by friendbot`);
            } catch (e) {
                this.logger.error(`Failed to fund account with friendbot: ${e.message}`);
            }
        }
        return {
            publicKey: pair.publicKey(),
            secret: pair.secret(),
        };
    }

    async getBalance(accountId: string): Promise<any[]> {
        try {
            const account = await this.server.loadAccount(accountId);
            return account.balances;
        } catch (e) {
            this.logger.error(`Failed to load account ${accountId}: ${e.message}`);
            throw e;
        }
    }

    async buildPaymentTransaction(
        sourceSecret: string,
        destinationId: string,
        amount: string,
        assetCode?: string,
        memo?: string
    ): Promise<string> {
        try {
            const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret);
            const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());

            const asset = assetCode && assetCode !== 'XLM'
                ? new StellarSdk.Asset(assetCode, this.issuerPublicKey)
                : StellarSdk.Asset.native();

            let transactionBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: this.networkPassphrase,
            })
                .addOperation(StellarSdk.Operation.payment({
                    destination: destinationId,
                    asset: asset,
                    amount: amount,
                }))
                .setTimeout(30);

            if (memo) {
                transactionBuilder = transactionBuilder.addMemo(StellarSdk.Memo.text(memo));
            }

            const transaction = transactionBuilder.build();
            transaction.sign(sourceKeypair);

            return transaction.toXDR();
        } catch (e) {
            this.logger.error(`Error building transaction: ${e.message}`);
            throw e;
        }
    }

    async submitTransaction(signedTransactionXdr: string): Promise<any> {
        try {
            const transaction = StellarSdk.TransactionBuilder.fromXDR(signedTransactionXdr, this.networkPassphrase);
            const result = await this.server.submitTransaction(transaction);
            this.logger.log(`Transaction submitted successfully: ${result.hash}`);
            return result;
        } catch (e) {
            this.logger.error(`Error submitting transaction: ${e.message}`);
            throw e;
        }
    }

    // Helper to add trustline (mostly for USDC on testnet/mainnet)
    async addTrustline(sourceSecret: string, assetCode: string, issuer: string): Promise<any> {
        try {
            const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret);
            const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());

            const asset = new StellarSdk.Asset(assetCode, issuer);

            const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: this.networkPassphrase,
            })
                .addOperation(StellarSdk.Operation.changeTrust({
                    asset: asset
                }))
                .setTimeout(30)
                .build();

            transaction.sign(sourceKeypair);
            return await this.server.submitTransaction(transaction);
        } catch (e) {
            this.logger.error(`Error adding trustline: ${e.message}`);
            throw e;
        }
    }

    async getTransactionHistory(accountId: string, limit: number = 10): Promise<any> {
        try {
            const payments = await this.server.payments()
                .forAccount(accountId)
                .limit(limit)
                .order('desc')
                .call();
            return payments.records;
        } catch (e) {
            this.logger.error(`Error fetching history: ${e.message}`);
            throw e;
        }
    }

    monitorTransactions(accountId: string, callback: (payment: any) => void) {
        if (this.streamClose) {
            this.streamClose();
        }

        this.logger.log(`Starting payment stream for ${accountId}`);
        this.streamClose = this.server.payments()
            .forAccount(accountId)
            .cursor('now')
            .stream({
                onmessage: (payment) => {
                    this.logger.log(`New payment detected: ${payment.id}`);
                    callback(payment);
                },
                onerror: (error) => {
                    this.logger.error(`Error in payment stream: ${error}`);
                }
            });
    }

    stopMonitoring() {
        if (this.streamClose) {
            this.streamClose();
            this.streamClose = undefined;
            this.logger.log('Stopped payment monitoring');
        }
    }
}

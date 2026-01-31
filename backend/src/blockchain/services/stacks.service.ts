import { Injectable, Logger } from '@nestjs/common';
import { GlobalConfigService } from '../../config/global-config.service';
import {
    makeSTXTokenTransfer,
    makeContractCall,
    broadcastTransaction,
    PostConditionMode,
    SignedTokenTransferOptions,
    SignedContractCallOptions,
    getAddressFromPrivateKey,
    uintCV,
    principalCV,
    ClarityValue,
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET, StacksNetwork } from '@stacks/network';
import { generateWallet, getStxAddress, generateSecretKey } from '@stacks/wallet-sdk';
import { createClient } from '@stacks/blockchain-api-client';

@Injectable()
export class StacksService {
    private readonly logger = new Logger(StacksService.name);
    private readonly network: StacksNetwork;
    private readonly client: ReturnType<typeof createClient>;

    constructor(private readonly configService: GlobalConfigService) {
        const stacksConfig = this.configService.getStacksConfig();
        const activeNetConfig = this.configService.getActiveStacksNetworkConfig();

        this.network = stacksConfig.activeNetwork === 'mainnet'
            ? STACKS_MAINNET
            : STACKS_TESTNET;

        // If custom RPC is provided, we can't easily use the constants
        // but for now, we'll stick to them or wrap them
        (this.network as any).baseUrl = activeNetConfig.rpcUrl;

        this.client = createClient({ baseUrl: activeNetConfig.rpcUrl });
    }

    getApiClient() {
        return this.client;
    }

    getNetwork() {
        return this.network;
    }

    async generateNewWallet() {
        const mnemonic = generateSecretKey();
        const wallet = await generateWallet({
            secretKey: mnemonic,
            password: 'password',
        });

        const account = wallet.accounts[0];
        const address = getStxAddress({
            account,
            network: (this.network as any).version,
        });

        return {
            mnemonic,
            address,
            privateKey: account.stxPrivateKey,
        };
    }

    async getAccountBalance(address: string) {
        try {
            const { data, error } = await this.client.GET('/extended/v1/address/{principal}/balances', {
                params: { path: { principal: address } }
            });
            if (error) throw error;
            return data;
        } catch (error) {
            this.logger.error(`Error fetching balance for ${address}:`, error);
            throw error;
        }
    }

    async getNonce(address: string) {
        try {
            const { data, error } = await this.client.GET('/extended/v1/address/{principal}/nonces', {
                params: { path: { principal: address } }
            });
            if (error) throw error;
            return BigInt((data as any).possible_next_nonce);
        } catch (error) {
            this.logger.error(`Error fetching nonce for ${address}:`, error);
            return 0n;
        }
    }

    async buildStxTransfer(options: {
        recipient: string;
        amount: bigint;
        senderKey: string;
        memo?: string;
    }) {
        const senderAddress = getAddressFromPrivateKey(options.senderKey, (this.network as any).version);
        const nonce = await this.getNonce(senderAddress);

        const txOptions: SignedTokenTransferOptions = {
            recipient: options.recipient,
            amount: options.amount,
            senderKey: options.senderKey,
            network: this.network,
            memo: options.memo,
            nonce,
        };

        return makeSTXTokenTransfer(txOptions);
    }

    async buildUsdcTransfer(options: {
        recipient: string;
        amount: bigint;
        senderKey: string;
    }) {
        const senderAddress = getAddressFromPrivateKey(options.senderKey, (this.network as any).version);
        const nonce = await this.getNonce(senderAddress);
        const activeNetConfig = this.configService.getActiveStacksNetworkConfig();

        const [contractAddress, contractDetails] = activeNetConfig.usdcAssetIdentifier.split('.');
        const [contractName] = contractDetails.split('::');

        const functionArgs: ClarityValue[] = [
            uintCV(options.amount),
            principalCV(senderAddress),
            principalCV(options.recipient),
        ];

        const txOptions: SignedContractCallOptions = {
            contractAddress,
            contractName,
            functionName: 'transfer',
            functionArgs,
            senderKey: options.senderKey,
            network: this.network,
            nonce,
            postConditionMode: PostConditionMode.Allow,
        };

        return makeContractCall(txOptions);
    }

    async broadcastTx(transaction: any) {
        try {
            const result = await broadcastTransaction(transaction);
            if ('error' in result) {
                throw new Error(`Broadcast error: ${JSON.stringify(result.error)}`);
            }
            return result.txid;
        } catch (error) {
            this.logger.error('Error broadcasting transaction:', error);
            throw error;
        }
    }

    async estimateFee(txBytes: string) {
        try {
            const { data, error } = await this.client.POST('/extended/v1/fee_rate/', {
                body: { transaction: txBytes }
            });
            if (error) throw error;
            return data;
        } catch (error) {
            this.logger.error('Error estimating fees:', error);
            throw error;
        }
    }

    async getApiStatus() {
        try {
            const { data, error } = await this.client.GET('/extended');
            if (error) throw error;
            return data;
        } catch (error) {
            this.logger.error('Error fetching API status:', error);
            throw error;
        }
    }
}

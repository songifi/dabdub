import { Injectable, Logger } from '@nestjs/common';
import {
    IBlockchainClient,
    BlockchainBlock,
    BlockchainTransaction,
} from '../interfaces/blockchain-client.interface';
import { StacksService } from './stacks.service';

@Injectable()
export class StacksClientService implements IBlockchainClient {
    private readonly logger = new Logger(StacksClientService.name);

    constructor(private readonly stacksService: StacksService) { }

    async getLatestBlockNumber(): Promise<bigint> {
        try {
            const status = await this.stacksService.getApiStatus();
            return BigInt((status as any).chain_tip.stacks_block_height);
        } catch (error) {
            this.logger.error('Error getting latest Stacks block number:', error);
            throw error;
        }
    }

    async getBlock(blockNumber: bigint): Promise<BlockchainBlock> {
        try {
            this.logger.debug(`Fetching Stacks block ${blockNumber}`);
            const client = this.stacksService.getApiClient();

            const { data: blockData, error: blockError } = await client.GET('/extended/v1/block/by_height/{height}', {
                params: { path: { height: Number(blockNumber) } }
            });
            if (blockError) throw blockError;

            const { data: txsData, error: txsError } = await client.GET('/extended/v1/tx/block_height/{height}', {
                params: { path: { height: Number(blockNumber) } }
            });
            if (txsError) throw txsError;

            const transactions: BlockchainTransaction[] = (txsData.results as any[]).map(tx => ({
                hash: tx.tx_id,
                from: tx.sender_address,
                to: this.getTxRecipient(tx),
                amount: this.getTxAmount(tx),
                memo: tx.memo || undefined,
                timestamp: new Date(tx.burn_block_time * 1000),
                blockNumber: blockNumber.toString(),
            }));

            return {
                number: blockNumber.toString(),
                hash: (blockData as any).hash,
                timestamp: new Date((blockData as any).burn_block_time * 1000),
                transactions,
            };
        } catch (error) {
            this.logger.error(`Error getting Stacks block ${blockNumber}:`, error);
            throw error;
        }
    }

    private getTxRecipient(tx: any): string {
        if (tx.tx_type === 'token_transfer') {
            return tx.token_transfer.recipient_address;
        } else if (tx.tx_type === 'contract_call') {
            return tx.contract_call.contract_id;
        }
        return '';
    }

    private getTxAmount(tx: any): string {
        if (tx.tx_type === 'token_transfer') {
            return tx.token_transfer.amount;
        } else if (tx.tx_type === 'contract_call') {
            // Check for ft_transfer_event in SIP-010 calls (like USDC)
            const transferEvent = tx.events?.find(
                (e: any) => e.event_type === 'stx_asset' || e.event_type === 'fungible_token_asset'
            );
            if (transferEvent && transferEvent.asset) {
                return transferEvent.asset.amount || '0';
            }
        }
        return '0';
    }
}

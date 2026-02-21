import { Injectable, Logger } from '@nestjs/common';
import {
  IBlockchainClient,
  BlockchainBlock,
  BlockchainTransaction,
} from '../interfaces/blockchain-client.interface';
import axios from 'axios';

@Injectable()
export class StellarClientService implements IBlockchainClient {
  private readonly logger = new Logger(StellarClientService.name);
  private readonly horizonUrl =
    process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

  async getLatestBlockNumber(): Promise<bigint> {
    const response = await axios.get(
      `${this.horizonUrl}/ledgers?order=desc&limit=1`,
    );
    const ledger = response.data._embedded.records[0];
    return BigInt(ledger.sequence);
  }

  async getBlock(blockNumber: bigint): Promise<BlockchainBlock> {
    const response = await axios.get(
      `${this.horizonUrl}/ledgers/${blockNumber}/transactions?limit=200`,
    );

    const records = response.data._embedded.records || [];

    const transactions: BlockchainTransaction[] = records
      .filter((tx: any) => tx.successful)
      .map((tx: any) => ({
        hash: tx.hash,
        from: tx.source_account,
        to: tx.source_account,
        amount: '0',
        memo: tx.memo || undefined,
        timestamp: new Date(tx.created_at),
        blockNumber: blockNumber.toString(),
      }));

    return {
      number: blockNumber.toString(),
      hash: blockNumber.toString(),
      timestamp: new Date(),
      transactions,
    };
  }
}

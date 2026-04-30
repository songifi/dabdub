import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { BlockchainWallet } from './entities/blockchain-wallet.entity';
import { SorobanService } from './soroban.service';
import { EncryptionService } from '../security/encryption.service';

export const WALLET_PROVISIONED_EVENT = 'wallet.provisioned';

@Injectable()
export class BlockchainWalletService {
  private readonly logger = new Logger(BlockchainWalletService.name);
  private readonly isTestnet: boolean;

  constructor(
    @InjectRepository(BlockchainWallet)
    private readonly walletRepo: Repository<BlockchainWallet>,
    private readonly sorobanService: SorobanService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly encryptionService: EncryptionService,
  ) {
    this.isTestnet =
      this.configService.get<string>('STELLAR_NETWORK', 'TESTNET') === 'TESTNET';
  }

  // ── Provision ───────────────────────────────────────────────────────────────

  async provision(userId: string, username: string): Promise<BlockchainWallet> {
    const existing = await this.walletRepo.findOne({ where: { userId } });
    if (existing) throw new ConflictException('Wallet already provisioned for this user');

    // 1. Generate Stellar keypair
    const keypair = StellarSdk.Keypair.random();
    const publicKey = keypair.publicKey();
    const secretKey = keypair.secret();

    // 2. Persist wallet (column transformer encrypts sensitive fields at rest)
    const wallet = this.walletRepo.create({
      userId,
      stellarAddress: publicKey,
      encryptedSecretKey: secretKey,
      iv: null,
    });
    const saved = await this.walletRepo.save(wallet);

    // 4. Register on Soroban contract
    try {
      await this.sorobanService.registerUser(username, publicKey);
    } catch (err: any) {
      this.logger.warn(`Soroban registerUser failed for ${userId}: ${err.message}`);
    }

    // 5. Fund via friendbot on testnet
    if (this.isTestnet) {
      try {
        const server = new StellarSdk.Horizon.Server(
          this.configService.get<string>('STELLAR_HORIZON_URL', 'https://horizon-testnet.stellar.org'),
        );
        await server.friendbot(publicKey).call();
        this.logger.log(`Friendbot funded ${publicKey}`);
      } catch (err: any) {
        this.logger.warn(`Friendbot funding failed: ${err.message}`);
      }
    }

    // 6. Emit internal event for notification module
    this.eventEmitter.emit(WALLET_PROVISIONED_EVENT, { userId, stellarAddress: publicKey });

    return saved;
  }

  // ── Sync balance ────────────────────────────────────────────────────────────

  async syncBalance(userId: string): Promise<BlockchainWallet> {
    const wallet = await this.getWallet(userId);

    try {
      const [balanceUsdc, stakedBalance] = await Promise.all([
        this.sorobanService.getBalance(wallet.stellarAddress),
        this.sorobanService.getStakeBalance(wallet.stellarAddress),
      ]);

      wallet.balanceUsdc = balanceUsdc;
      wallet.stakedBalance = stakedBalance;
      wallet.lastSyncedAt = new Date();

      return this.walletRepo.save(wallet);
    } catch (err: any) {
      this.logger.error(`syncBalance failed for ${userId}: ${err.message}`);
      throw err;
    }
  }

  // ── Get wallet ──────────────────────────────────────────────────────────────

  async getWallet(userId: string): Promise<BlockchainWallet> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not provisioned for this user');
    return wallet;
  }

  // ── Decrypt secret key (private — never exposed via controller/DTO) ─────────

  decryptSecretKey(wallet: BlockchainWallet): string {
    if (!wallet.encryptedSecretKey) {
      throw new InternalServerErrorException(
        'Encrypted key unavailable. Security team has been notified.',
      );
    }

    // New records are transparently decrypted by the column transformer.
    if (!wallet.iv) {
      return wallet.encryptedSecretKey;
    }

    // Backward compatibility for legacy records that stored iv+authTag separately.
    try {
      return this.encryptionService.decryptLegacy(
        wallet.encryptedSecretKey,
        wallet.iv,
      );
    } catch (error) {
      this.encryptionService.logDecryptionFailure(
        'blockchain_wallets.encryptedSecretKey',
        error,
      );
      throw new InternalServerErrorException(
        'Unable to decrypt wallet secret. Security team has been notified.',
      );
    }
  }
}

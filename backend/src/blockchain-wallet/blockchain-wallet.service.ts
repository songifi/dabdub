import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import * as StellarSdk from '@stellar/stellar-sdk';
import { BlockchainWallet } from './entities/blockchain-wallet.entity';
import { SorobanService } from './soroban.service';
import { StellarAssetService } from '../stellar/stellar-asset.service';

export const WALLET_PROVISIONED_EVENT = 'wallet.provisioned';

@Injectable()
export class BlockchainWalletService {
  private readonly logger = new Logger(BlockchainWalletService.name);
  private readonly encryptionKey: Buffer;
  private readonly isTestnet: boolean;

  constructor(
    @InjectRepository(BlockchainWallet)
    private readonly walletRepo: Repository<BlockchainWallet>,
    private readonly sorobanService: SorobanService,
    private readonly stellarAssetService: StellarAssetService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const rawKey = this.configService.get<string>('STELLAR_WALLET_ENCRYPTION_KEY');
    if (!rawKey) throw new Error('STELLAR_WALLET_ENCRYPTION_KEY is not set');
    // Derive a 32-byte key from the env var using scrypt
    this.encryptionKey = scryptSync(rawKey, 'cheese-wallet-salt', 32);
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

    // 2. AES-256-GCM encrypt the secret key
    const { ciphertext, iv } = this.encrypt(secretKey);

    // 3. Persist wallet
    const wallet = this.walletRepo.create({
      userId,
      stellarAddress: publicKey,
      encryptedSecretKey: ciphertext,
      iv,
    });
    const saved = await this.walletRepo.save(wallet);

    // 4. Register on Soroban contract
    try {
      await this.stellarAssetService.ensureTrustLine(publicKey, secretKey);
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
    return this.decrypt(wallet.encryptedSecretKey, wallet.iv);
  }

  // ── AES-256-GCM helpers ─────────────────────────────────────────────────────

  private encrypt(plaintext: string): { ciphertext: string; iv: string } {
    const iv = randomBytes(12); // 96-bit IV for GCM
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Store as: iv_hex:authTag_hex:ciphertext_hex
    return {
      ciphertext: `${authTag.toString('hex')}:${encrypted.toString('hex')}`,
      iv: iv.toString('hex'),
    };
  }

  private decrypt(ciphertext: string, ivHex: string): string {
    const iv = Buffer.from(ivHex, 'hex');
    const [authTagHex, encryptedHex] = ciphertext.split(':');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}

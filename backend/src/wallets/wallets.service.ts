import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigType } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import axios from 'axios';
import { Wallet } from './entities/wallet.entity';
import { SorobanService } from '../soroban/soroban.service';
import { stellarConfig } from '../config/stellar.config';
import {
  encryptAes256Gcm,
  decryptAes256Gcm,
  derive32ByteKeyFromString,
} from '../webhooks/webhooks.crypto';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    private readonly sorobanService: SorobanService,

    @Inject(stellarConfig.KEY)
    private readonly stellar: ConfigType<typeof stellarConfig>,
  ) {}

  // ── Provision ────────────────────────────────────────────────────────────

  async provision(userId: string, username: string): Promise<Wallet> {
    const existing = await this.walletRepo.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Wallet already exists for this user');
    }

    // Generate Stellar keypair
    const keypair = StellarSdk.Keypair.random();
    const publicKey = keypair.publicKey();
    const secretKey = keypair.secret();

    // AES-256-GCM encrypt the secret key
    const encKey = this.getEncryptionKey();
    const encrypted = encryptAes256Gcm(secretKey, encKey);
    // encrypted format: base64(iv).base64(tag).base64(ciphertext)
    const [iv] = encrypted.split('.');

    const wallet = this.walletRepo.create({
      userId,
      stellarAddress: publicKey,
      encryptedSecretKey: encrypted,
      iv,
      balance: '0',
      stakedBalance: '0',
    });

    await this.walletRepo.save(wallet);

    // Register on contract
    try {
      await this.sorobanService.registerUser(username, publicKey);
    } catch (err) {
      this.logger.error(`registerUser failed for ${username}: ${(err as Error).message}`);
      throw err;
    }

    // Fund via friendbot on testnet (best-effort)
    try {
      await axios.get(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
    } catch (err) {
      this.logger.warn(`Friendbot funding failed for ${publicKey}: ${(err as Error).message}`);
    }

    return wallet;
  }

  // ── Sync Balance ─────────────────────────────────────────────────────────

  async syncBalance(userId: string): Promise<Wallet> {
    const wallet = await this.findByUserId(userId);

    const username = await this.sorobanService.getUsername(wallet.stellarAddress) as string;

    const [balance, stakedBalance] = await Promise.all([
      this.sorobanService.getBalance(username) as Promise<string>,
      this.sorobanService.getStakeBalance(username) as Promise<string>,
    ]);

    wallet.balance = String(balance ?? '0');
    wallet.stakedBalance = String(stakedBalance ?? '0');
    wallet.lastSyncedAt = new Date();

    return this.walletRepo.save(wallet);
  }

  // ── Find ─────────────────────────────────────────────────────────────────

  async findByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }

  // ── Decrypt (private — never exposed to controller layer) ─────────────────

  private decryptSecretKey(wallet: Wallet): string {
    const encKey = this.getEncryptionKey();
    return decryptAes256Gcm(wallet.encryptedSecretKey, encKey);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private getEncryptionKey(): Buffer {
    const secret = process.env['WALLET_ENCRYPTION_KEY'] ?? this.stellar.adminSecretKey;
    return derive32ByteKeyFromString(secret);
  }
}

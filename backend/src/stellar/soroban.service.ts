import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { WalletEntity, WalletType } from '../database/entities/wallet.entity';
import { StellarService } from './stellar.service';

@Injectable()
export class SorobanService {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly stellarService: StellarService,
  ) {}

  async transfer(
    treasuryAddress: string,
    userId: string,
    amount: string,
  ): Promise<any> {
    const treasuryWallet = treasuryAddress
      ? await this.walletRepository.findOne({
          where: {
            address: treasuryAddress,
            type: WalletType.TREASURY,
          },
        })
      : await this.walletRepository.findOne({
          where: { type: WalletType.TREASURY },
          order: { createdAt: 'ASC' },
        });

    if (!treasuryWallet) {
      throw new NotFoundException('Treasury wallet not found');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    let recipientWallet = await this.walletRepository
      .createQueryBuilder('wallet')
      .leftJoinAndSelect('wallet.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('wallet.type = :walletType', { walletType: WalletType.DEPOSIT })
      .andWhere('wallet.chain = :chain', { chain: treasuryWallet.chain })
      .orderBy('wallet.createdAt', 'ASC')
      .getOne();

    if (!recipientWallet) {
      recipientWallet = await this.walletRepository
        .createQueryBuilder('wallet')
        .leftJoinAndSelect('wallet.user', 'user')
        .where('user.id = :userId', { userId })
        .andWhere('wallet.type = :walletType', {
          walletType: WalletType.DEPOSIT,
        })
        .orderBy('wallet.createdAt', 'ASC')
        .getOne();
    }

    if (!recipientWallet) {
      throw new NotFoundException(
        `Deposit wallet not found for user ${userId}`,
      );
    }

    const xdr = await this.stellarService.buildPaymentTransaction(
      treasuryWallet.privateKey,
      recipientWallet.address,
      amount,
      'USDC',
      `referral:${userId}`,
    );

    return this.stellarService.submitTransaction(xdr);
  }
}

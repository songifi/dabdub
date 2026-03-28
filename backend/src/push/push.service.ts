import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken, DevicePlatform } from './entities/device-token.entity';
import { FirebaseService, PushPayload } from './firebase.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(DeviceToken)
    private readonly tokenRepo: Repository<DeviceToken>,
    private readonly firebase: FirebaseService,
  ) {}

  async send(userId: string, payload: PushPayload): Promise<void> {
    const tokens = await this.tokenRepo.find({
      where: { userId, isActive: true },
    });

    if (!tokens.length) {
      this.logger.log(`No active tokens for userId=${userId}`);
      return;
    }

    const tokenStrings = tokens.map((t) => t.token);
    const { failedTokens } = await this.firebase.sendMulticast(tokenStrings, payload);

    if (failedTokens.length) {
      await this.tokenRepo
        .createQueryBuilder()
        .update(DeviceToken)
        .set({ isActive: false })
        .where('token IN (:...tokens)', { tokens: failedTokens })
        .execute();

      this.logger.warn(`Deactivated ${failedTokens.length} invalid tokens for userId=${userId}`);
    }
  }

  async sendBulk(userIds: string[], payload: PushPayload): Promise<void> {
    const chunks = [];
    for (let i = 0; i < userIds.length; i += 500) {
      chunks.push(userIds.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map((userId) => this.send(userId, payload)));
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise((res) => setTimeout(res, 100));
      }
    }
  }

  async register(userId: string, token: string, platform: DevicePlatform): Promise<DeviceToken> {
    const existing = await this.tokenRepo.findOne({ where: { token } });

    if (existing) {
      await this.tokenRepo.update(existing.id, {
        isActive: true,
        lastUsedAt: new Date(),
        userId,
      });
      return this.tokenRepo.findOne({ where: { token } }) as Promise<DeviceToken>;
    }

    return this.tokenRepo.save(
      this.tokenRepo.create({
        userId,
        token,
        platform,
        isActive: true,
        lastUsedAt: new Date(),
      }),
    );
  }

  async unregister(token: string): Promise<void> {
    await this.tokenRepo.update({ token }, { isActive: false });
  }
}

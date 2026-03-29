import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { RateAlert, AlertDirection, AlertStatus } from './entities/rate-alert.entity';
import { CreateRateAlertDto } from './dto/create-rate-alert.dto';

export const RATE_ALERT_QUEUE = 'rate-alert-jobs';
export const FIRE_RATE_ALERT_JOB = 'fire-rate-alert';

const MAX_ACTIVE_ALERTS = 5;

export interface FireRateAlertPayload {
  alertId: string;
  userId: string;
  targetRate: string;
  currentRate: string;
}

@Injectable()
export class RateAlertService {
  constructor(
    @InjectRepository(RateAlert)
    private readonly alertRepo: Repository<RateAlert>,

    @InjectQueue(RATE_ALERT_QUEUE)
    private readonly alertQueue: Queue<FireRateAlertPayload>,
  ) {}

  async create(userId: string, dto: CreateRateAlertDto): Promise<RateAlert> {
    if (dto.targetRate <= 0) {
      throw new BadRequestException('targetRate must be greater than 0');
    }

    const activeCount = await this.alertRepo.count({
      where: { userId, status: AlertStatus.ACTIVE },
    });

    if (activeCount >= MAX_ACTIVE_ALERTS) {
      throw new BadRequestException('Maximum of 5 active alerts allowed per user');
    }

    return this.alertRepo.save(
      this.alertRepo.create({
        userId,
        targetRate: dto.targetRate.toString(),
        direction: dto.direction,
        currency: 'NGN',
        status: AlertStatus.ACTIVE,
        triggeredAt: null,
        notifiedVia: [],
      }),
    );
  }

  async checkAlerts(currentRate: number): Promise<void> {
    const activeAlerts = await this.alertRepo.find({
      where: { status: AlertStatus.ACTIVE },
    });

    for (const alert of activeAlerts) {
      const target = parseFloat(alert.targetRate);
      const triggered =
        (alert.direction === AlertDirection.ABOVE && currentRate > target) ||
        (alert.direction === AlertDirection.BELOW && currentRate < target);

      if (!triggered) continue;

      await this.alertRepo.update(alert.id, {
        status: AlertStatus.TRIGGERED,
        triggeredAt: new Date(),
      });

      await this.alertQueue.add(FIRE_RATE_ALERT_JOB, {
        alertId: alert.id,
        userId: alert.userId,
        targetRate: alert.targetRate,
        currentRate: currentRate.toString(),
      });
    }
  }

  async getAlerts(userId: string): Promise<Array<RateAlert & { distanceFromTarget: string }>> {
    const alerts = await this.alertRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // We don't have the current rate here; distance is computed best-effort
    return alerts.map((alert) => ({
      ...alert,
      distanceFromTarget: 'N/A',
    }));
  }

  async getAlertsWithRate(
    userId: string,
    currentRate: number,
  ): Promise<Array<RateAlert & { distanceFromTarget: string }>> {
    const alerts = await this.alertRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return alerts.map((alert) => {
      const target = parseFloat(alert.targetRate);
      const distance = Math.abs(currentRate - target);
      return {
        ...alert,
        distanceFromTarget: `₦${distance.toFixed(2)} away`,
      };
    });
  }

  async cancel(alertId: string, userId: string): Promise<RateAlert> {
    const alert = await this.alertRepo.findOne({ where: { id: alertId, userId } });
    if (!alert) throw new NotFoundException('Rate alert not found');

    await this.alertRepo.update(alertId, { status: AlertStatus.CANCELLED });
    return { ...alert, status: AlertStatus.CANCELLED };
  }
}

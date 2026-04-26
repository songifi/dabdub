import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationChannel,
  NotificationEventType,
  NotificationPreference,
} from './entities/notification-preference.entity';
import {
  NotificationPrefResponseItemDto,
  NotificationPrefsResponseDto,
  UpdateNotificationPrefsDto,
} from './dto/notification-prefs.dto';

/** All valid channel × event combinations, used to seed defaults. */
const ALL_CHANNELS = Object.values(NotificationChannel);
const ALL_EVENTS = Object.values(NotificationEventType);

@Injectable()
export class NotificationPrefsService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly prefsRepo: Repository<NotificationPreference>,
  ) {}

  async getPrefs(merchantId: string): Promise<NotificationPrefsResponseDto> {
    const stored = await this.prefsRepo.find({ where: { merchantId } });

    // Build a full matrix, filling in defaults for any missing rows
    const preferences: NotificationPrefResponseItemDto[] = [];

    for (const channel of ALL_CHANNELS) {
      for (const eventType of ALL_EVENTS) {
        const existing = stored.find(
          (p) => p.channel === channel && p.eventType === eventType,
        );

        const isInApp = channel === NotificationChannel.IN_APP;

        preferences.push({
          channel,
          eventType,
          // in_app is always enabled; fall back to true for unsaved rows
          enabled: isInApp ? true : (existing?.enabled ?? true),
          ...(isInApp ? { readonly: true } : {}),
        });
      }
    }

    return { preferences };
  }

  async updatePrefs(
    merchantId: string,
    dto: UpdateNotificationPrefsDto,
  ): Promise<NotificationPrefsResponseDto> {
    for (const item of dto.preferences) {
      if (item.channel === NotificationChannel.IN_APP && !item.enabled) {
        throw new BadRequestException(
          'in_app notifications cannot be disabled',
        );
      }
    }

    // Upsert each preference using the unique constraint (merchantId, channel, eventType)
    for (const item of dto.preferences) {
      const isInApp = item.channel === NotificationChannel.IN_APP;
      const enabled = isInApp ? true : item.enabled;

      await this.prefsRepo
        .createQueryBuilder()
        .insert()
        .into(NotificationPreference)
        .values({
          merchantId,
          channel: item.channel,
          eventType: item.eventType,
          enabled,
        })
        .orUpdate(['enabled', 'updated_at'], ['merchant_id', 'channel', 'event_type'])
        .execute();
    }

    return this.getPrefs(merchantId);
  }

  /**
   * Utility used by other services to check whether a specific channel+event
   * is enabled for a merchant before dispatching a notification.
   */
  async isEnabled(
    merchantId: string,
    channel: NotificationChannel,
    eventType: NotificationEventType,
  ): Promise<boolean> {
    if (channel === NotificationChannel.IN_APP) return true;

    const pref = await this.prefsRepo.findOne({
      where: { merchantId, channel, eventType },
    });

    // Default to enabled if no preference row exists yet
    return pref?.enabled ?? true;
  }
}

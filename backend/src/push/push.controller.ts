import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Post,
  Req,
  UseGuards,
  VERSION_NEUTRAL,
  Version,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { SkipResponseWrap } from '../common/decorators/skip-response-wrap.decorator';
import { webPushConfig } from '../config';
import { PushService } from './push.service';
import { DevicePlatform } from './entities/device-token.entity';
import { IsEnum, IsNotEmptyObject, IsObject, IsString } from 'class-validator';
import type { PushSubscription } from 'web-push';

export class RegisterTokenDto {
  @IsString()
  token!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;
}

export class UnregisterTokenDto {
  @IsString()
  token!: string;
}

export class WebSubscribeDto {
  @IsObject()
  @IsNotEmptyObject()
  subscription!: PushSubscription;
}

export class WebUnsubscribeDto {
  @IsString()
  endpoint!: string;
}

@UseGuards(JwtAuthGuard)
@Controller({ path: 'push', version: '1' })
export class PushController {
  constructor(
    private readonly pushService: PushService,
    @Inject(webPushConfig.KEY)
    private readonly webPushCfg: ConfigType<typeof webPushConfig>,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterTokenDto, @Req() req: { user: { id: string } }) {
    return this.pushService.register(req.user.id, dto.token, dto.platform);
  }

  @Delete('unregister')
  async unregister(@Body() dto: UnregisterTokenDto) {
    await this.pushService.unregister(dto.token);
    return { success: true };
  }

  @Version(VERSION_NEUTRAL)
  @Post('web/subscribe')
  async subscribeWeb(
    @Body() dto: WebSubscribeDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.pushService.registerWebSubscription(req.user.id, dto.subscription);
  }

  @Version(VERSION_NEUTRAL)
  @Post('web/unsubscribe')
  async unsubscribeWeb(@Body() dto: WebUnsubscribeDto) {
    await this.pushService.unregisterWebSubscription(dto.endpoint);
    return { success: true };
  }

  @Public()
  @SkipResponseWrap()
  @Version(VERSION_NEUTRAL)
  @Get('web/vapid-public-key')
  getVapidPublicKey(): string {
    return this.webPushCfg.publicKey;
  }
}

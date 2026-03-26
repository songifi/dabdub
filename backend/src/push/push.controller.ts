import { Controller, Post, Delete, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushService } from './push.service';
import { DevicePlatform } from './entities/device-token.entity';
import { IsEnum, IsString } from 'class-validator';

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

@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('register')
  async register(@Body() dto: RegisterTokenDto, @Req() req: { user: { id: string } }) {
    return this.pushService.register(req.user.id, dto.token, dto.platform);
  }

  @Delete('unregister')
  async unregister(@Body() dto: UnregisterTokenDto) {
    await this.pushService.unregister(dto.token);
    return { success: true };
  }
}

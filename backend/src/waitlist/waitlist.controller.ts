import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WaitlistService, JoinWaitlistDto } from './waitlist.service';

@ApiTags('waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('join')
  @ApiOperation({ summary: 'Join the waitlist' })
  join(@Body() dto: JoinWaitlistDto) {
    return this.waitlistService.join(dto);
  }

  @Get('check/:username')
  @ApiOperation({ summary: 'Check username availability' })
  checkUsername(@Param('username') username: string) {
    return this.waitlistService.checkUsername(username);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Waitlist stats' })
  getStats() {
    return this.waitlistService.getStats();
  }
}

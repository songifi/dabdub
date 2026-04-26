import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { WaitlistService } from './waitlist.service';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { UsernameAvailabilityDto, WaitlistStatsDto } from './dto/waitlist-response.dto';

@ApiTags('waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post('join')
  @ApiOperation({ summary: 'Join the waitlist' })
  @ApiOkResponse({ description: 'Waitlist entry created' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Email already on waitlist' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  join(@Body() dto: JoinWaitlistDto) {
    return this.waitlistService.join(dto);
  }

  @Get('check/:username')
  @ApiOperation({ summary: 'Check username availability' })
  @ApiParam({ name: 'username', example: 'alice99' })
  @ApiOkResponse({ type: UsernameAvailabilityDto })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  checkUsername(@Param('username') username: string): Promise<UsernameAvailabilityDto> {
    return this.waitlistService.checkUsername(username);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Waitlist stats' })
  @ApiOkResponse({ type: WaitlistStatsDto })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  getStats(): Promise<WaitlistStatsDto> {
    return this.waitlistService.getStats();
  }
}

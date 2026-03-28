import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsernameService } from './username.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller({ path: 'username', version: '1' })
@ApiBearerAuth()
export class UsernameController {
  constructor(private readonly usernameService: UsernameService) {}

  @Get('check/:username')
  @ApiOperation({ summary: 'Check username availability' })
  @ApiResponse({
    status: 200,
    description: 'Availability status',
    schema: {
      type: 'object',
      properties: {
        available: { type: 'boolean' },
        reason: { type: 'string' },
      },
    },
  })
  async checkAvailability(@Param('username') username: string) {
    return this.usernameService.isAvailable(username);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change authenticated user username' })
  @ApiResponse({
    status: 200,
    description: 'Updated user profile',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid username or cooldown active',
  })
  async changeUsername(
    @Req() req: any,
    @Body('username') newUsername: string,
  ) {
    return this.usernameService.change(req.user.id, newUsername);
  }
}

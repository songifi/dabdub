import {
  Controller,
  Post,
  Body,
  Request,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminThrottlerGuard } from '../../common/guards/admin-throttler.guard';
import {
  AdminLoginDto,
  AdminLoginResponseDto,
  AdminRefreshTokenDto,
} from '../dto/admin-auth.dto';
import { Request as ExpressRequest } from 'express';

@ApiTags('Admin Authentication')
@UseGuards(AdminThrottlerGuard)
@Controller('admin/auth')
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);

  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Admin login',
    description: 'Authenticates admin users and returns short-lived JWT tokens with admin claims',
  })
  @ApiHeader({
    name: 'User-Agent',
    description: 'Browser or client user agent',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Admin login successful, JWT tokens returned',
    type: AdminLoginResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials or non-admin user',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Account locked due to too many failed attempts',
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Rate limit exceeded',
  })
  async login(
    @Body() loginDto: AdminLoginDto,
    @Request() req: ExpressRequest,
  ): Promise<AdminLoginResponseDto> {
    const userAgent = req.get('user-agent');
    const ipAddress = req.ip || req.connection.remoteAddress;

    this.logger.log(`Admin login attempt for ${loginDto.email} from ${ipAddress}`);

    return this.adminAuthService.login(loginDto, userAgent, ipAddress);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh admin access token',
    description: 'Issues a new admin access token using a valid refresh token',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        expires_in: { type: 'number' },
        admin: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token',
  })
  async refresh(
    @Body() refreshDto: AdminRefreshTokenDto,
    @Request() req: ExpressRequest,
  ): Promise<any> {
    const userAgent = req.get('user-agent');
    const ipAddress = req.ip || req.connection.remoteAddress;

    return this.adminAuthService.refresh(refreshDto, userAgent, ipAddress);
  }

  @Post('logout')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Admin logout',
    description: 'Invalidates the admin refresh token and logs out the admin user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logout successful',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logout successful' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or missing admin token',
  })
  async logout(@Request() req: any): Promise<{ message: string }> {
    const refreshToken = req.body?.refresh_token;
    
    if (refreshToken) {
      await this.adminAuthService.logout(refreshToken);
    }

    this.logger.log(`Admin logout for user ${req.user?.email}`);

    return { message: 'Logout successful' };
  }
}
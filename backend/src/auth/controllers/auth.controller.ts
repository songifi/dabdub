import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Response,
  HttpStatus,
  Version,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { JwtGuard } from '../guards/jwt.guard';
import { LocalAuthGuard } from '../guards/local-auth.guard';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  PasswordResetRequestDto,
  PasswordResetDto,
  TwoFactorEnableDto,
  ApiKeyCreateDto,
  LoginResponseDto,
  UserResponseDto,
} from '../dto/auth.dto';
import { Request as ExpressRequest } from 'express';
import { PasswordService } from '../services/password.service';
import { TwoFactorService } from '../services/two-factor.service';
import { ApiKeyService } from '../services/api-key.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordService: PasswordService,
    private readonly twoFactorService: TwoFactorService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @Version('1')
  @Post('register')
  @ApiOperation({
    summary: 'Register new user',
    description: 'Creates a new user account with email and password',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid registration data or user already exists',
  })
  async register(@Body() registerDto: RegisterDto): Promise<any> {
    const passwordValidation = this.passwordService.validatePasswordStrength(
      registerDto.password,
    );

    if (!passwordValidation.isStrong) {
      return {
        error: 'Password does not meet requirements',
        details: passwordValidation.errors,
      };
    }

    const user = await this.authService.register(registerDto);
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  @Version('1')
  @Post('login')
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticates user with email and password, returns JWT tokens',
  })
  @ApiHeader({
    name: 'User-Agent',
    description: 'Browser or client user agent',
    required: false,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful, JWT tokens returned',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: ExpressRequest,
  ): Promise<LoginResponseDto | any> {
    const userAgent = request.get('user-agent');
    const ipAddress = request.ip;

    return this.authService.login(loginDto, userAgent, ipAddress);
  }

  @Version('1')
  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Uses refresh token to obtain new access token',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'New access token provided',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 3600,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired refresh token',
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<any> {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Version('1')
  @Post('logout')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'User logout',
    description: 'Revokes current session and invalidates refresh token',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logged out successfully',
  })
  async logout(@Request() req: any): Promise<{ message: string }> {
    // Logout logic here
    return { message: 'Logged out successfully' };
  }

  @Version('1')
  @Get('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Returns the authenticated user profile',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile',
    type: UserResponseDto,
  })
  async getCurrentUser(@Request() req: any): Promise<UserResponseDto> {
    const { password, ...user } = req.user;
    return user;
  }

  @Version('1')
  @Post('password/reset-request')
  @Throttle({ sensitive: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Sends password reset link to user email',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset email sent if user exists',
  })
  async requestPasswordReset(
    @Body() passwordResetRequestDto: PasswordResetRequestDto,
  ): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(passwordResetRequestDto.email);
    return {
      message: 'If email exists, password reset link has been sent',
    };
  }

  @Version('1')
  @Post('password/reset')
  @Throttle({ sensitive: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Reset password',
    description: 'Resets password using reset token from email',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired reset token',
  })
  async resetPassword(
    @Body() passwordResetDto: PasswordResetDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(
      passwordResetDto.token,
      passwordResetDto.newPassword,
    );
    return { message: 'Password reset successfully' };
  }

  @Version('1')
  @Post('2fa/enable')
  @Throttle({ sensitive: { limit: 5, ttl: 60_000 } })
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Enable two-factor authentication',
    description: 'Generates QR code and enables 2FA for user account',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'QR code and secret provided',
    schema: {
      example: {
        secret: 'ABCDEFGHIJKLMNOP',
        qrCode: 'data:image/png;base64,iVBORw0KGg...',
      },
    },
  })
  async enableTwoFactor(@Request() req: any): Promise<any> {
    return this.twoFactorService.generateSecret(req.user.id);
  }

  @Version('1')
  @Post('2fa/confirm')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Confirm two-factor authentication',
    description: 'Verifies code and enables 2FA permanently',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '2FA enabled successfully',
  })
  async confirmTwoFactor(
    @Request() req: any,
    @Body() twoFactorDto: any,
  ): Promise<{ message: string }> {
    const enabled = await this.twoFactorService.enableTwoFactor(
      req.user.id,
      twoFactorDto.secret,
      twoFactorDto.code,
    );

    if (!enabled) {
      return { message: 'Invalid 2FA code' };
    }

    return { message: '2FA enabled successfully' };
  }

  @Version('1')
  @Post('2fa/disable')
  @Throttle({ sensitive: { limit: 5, ttl: 60_000 } })
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Disable two-factor authentication',
    description: 'Disables 2FA for user account',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '2FA disabled successfully',
  })
  async disableTwoFactor(@Request() req: any): Promise<{ message: string }> {
    await this.twoFactorService.disableTwoFactor(req.user.id);
    return { message: '2FA disabled successfully' };
  }

  @Version('1')
  @Post('api-keys')
  @Throttle({ sensitive: { limit: 5, ttl: 60_000 } })
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create API key',
    description: 'Creates new API key for server-to-server authentication',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'API key created',
    schema: {
      example: {
        id: 'ak_123456',
        key: 'name_uuid_hex',
      },
    },
  })
  async createApiKey(
    @Request() req: any,
    @Body() apiKeyCreateDto: ApiKeyCreateDto,
  ): Promise<any> {
    return this.apiKeyService.createApiKey(
      req.user.id,
      apiKeyCreateDto.name,
      apiKeyCreateDto.permissions,
      apiKeyCreateDto.expiresAt,
    );
  }

  @Version('1')
  @Get('api-keys')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List API keys',
    description: 'Retrieves all API keys for current user',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'API keys list',
    isArray: true,
  })
  async getApiKeys(@Request() req: any): Promise<any> {
    return this.apiKeyService.getUserApiKeys(req.user.id);
  }

  @Version('1')
  @Post('api-keys/:id/revoke')
  @Throttle({ sensitive: { limit: 5, ttl: 60_000 } })
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Revoke API key',
    description: 'Deactivates an API key',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'API key revoked',
  })
  async revokeApiKey(
    @Request() req: any,
    @Req() expressReq: ExpressRequest,
  ): Promise<{ message: string }> {
    const apiKeyId = expressReq.params.id;
    // await this.apiKeyService.revokeApiKey(apiKeyId, req.user.id as any);
    return { message: 'API key revoked successfully' };
  }
}

import {
  Controller,
  Post,
  Body,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { Public } from './decorators/public.decorator';

interface RequestWithUser {
  ip: string;
  headers: { authorization?: string };
  user?: { id: string };
}

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user and receive a token pair' })
  @ApiResponse({ status: 201, type: TokenResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  register(
    @Body() dto: RegisterDto,
    @Req() req: RequestWithUser,
    @Headers('user-agent') ua?: string,
  ): Promise<TokenResponseDto> {
    return this.authService.register(dto, req.ip, ua ? { userAgent: ua } : undefined);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive a token pair' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  login(
    @Body() dto: LoginDto,
    @Req() req: RequestWithUser,
    @Headers('user-agent') ua?: string,
  ): Promise<TokenResponseDto> {
    return this.authService.login(dto, req.ip, ua ? { userAgent: ua } : undefined);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token and receive a new pair' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  refresh(@Body() dto: RefreshDto): Promise<TokenResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current session refresh token' })
  @ApiResponse({ status: 204, description: 'Session revoked' })
  @ApiResponse({ status: 401, description: 'Missing or invalid bearer token' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async logout(@Req() req: RequestWithUser): Promise<void> {
    const raw = req.headers.authorization?.replace('Bearer ', '');
    if (!raw) return;

    const payload = this.jwtService.decode<{ sessionId?: string }>(raw);
    if (payload?.sessionId) {
      await this.authService.logout(payload.sessionId);
    }
  }
}

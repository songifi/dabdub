import { Controller, Post, Body, Req, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { LoginDto } from '../../auth/dto/login.dto';
import { TokenResponseDto } from '../../auth/dto/token-response.dto';
import { Public } from '../../auth/decorators/public.decorator';

@ApiTags('admin / auth')
@Controller({ path: 'admin/auth', version: '1' })
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
  ): Promise<TokenResponseDto> {
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
    };
    return this.adminAuthService.login(dto, ip, deviceInfo);
  }
}

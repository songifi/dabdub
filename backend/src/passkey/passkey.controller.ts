import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PasskeyService } from './passkey.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RegisterPasskeyOptionsDto } from './dto/register-passkey-options.dto';
import { RegisterPasskeyVerifyDto } from './dto/register-passkey-verify.dto';
import { AuthenticatePasskeyDto } from './dto/authenticate-passkey.dto';
import { RegistrationOptionsResponseDto } from './dto/registration-options-response.dto';
import { AuthenticationOptionsResponseDto } from './dto/authentication-options-response.dto';
import { PasskeyCredentialResponseDto } from './dto/passkey-credential-response.dto';
import { TokenResponseDto } from '../auth/dto/token-response.dto';

@ApiTags('Passkey')
@Controller({ path: 'passkey', version: '1' })
export class PasskeyController {
  constructor(private readonly passkeyService: PasskeyService) {}

  @Post('register/options')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate registration options for a new passkey' })
  @ApiResponse({
    status: 200,
    type: RegistrationOptionsResponseDto,
    description: 'Returns WebAuthn registration options and session ID',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async registerOptions(
    @Req() req: any,
    @Body() dto: RegisterPasskeyOptionsDto,
  ): Promise<RegistrationOptionsResponseDto> {
    const userId = req.user.sub;
    const result = await this.passkeyService.generateRegistrationOptions(
      userId,
      dto.nickname,
    );
    return result;
  }

  @Post('register/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a passkey registration response' })
  @ApiResponse({ status: 200, description: 'Passkey registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid challenge or verification failed' })
  async registerVerify(
    @Req() req: any,
    @Body() dto: RegisterPasskeyVerifyDto,
  ): Promise<void> {
    const userId = req.user.sub;
    const sessionId = (dto.response as any).sessionId;
    await this.passkeyService.verifyRegistration(
      sessionId,
      dto.response as any,
      dto.nickname,
      req.ip,
    );
  }

  @Post('auth/options')
  @ApiOperation({ summary: 'Generate authentication options for passkey login' })
  @ApiResponse({
    status: 200,
    type: AuthenticationOptionsResponseDto,
    description: 'Returns WebAuthn authentication options and session ID',
  })
  async authOptions(
    @Req() req: any,
  ): Promise<AuthenticationOptionsResponseDto> {
    // If user is authenticated, get their credentials; otherwise, allow any credential
    const userId = req.user?.sub;
    const result = await this.passkeyService.generateAuthenticationOptions(userId);
    return result;
  }

  @Post('auth/verify')
  @ApiOperation({ summary: 'Verify a passkey authentication response' })
  @ApiResponse({
    status: 200,
    type: TokenResponseDto,
    description: 'Returns JWT tokens on successful authentication',
  })
  @ApiResponse({ status: 400, description: 'Invalid challenge' })
  @ApiResponse({ status: 401, description: 'Authentication failed or counter regression' })
  async authVerify(
    @Req() req: any,
    @Body() dto: AuthenticatePasskeyDto,
  ): Promise<TokenResponseDto> {
    return this.passkeyService.verifyAuthentication(
      dto.sessionId,
      dto.response as any,
      req.ip,
      req.headers['user-agent']
        ? { userAgent: req.headers['user-agent'] }
        : undefined,
    );
  }

  @Get('credentials')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List registered passkey credentials' })
  @ApiResponse({
    status: 200,
    type: [PasskeyCredentialResponseDto],
    description: 'Returns list of registered passkeys (without publicKey)',
  })
  async listCredentials(
    @Req() req: any,
  ): Promise<PasskeyCredentialResponseDto[]> {
    const userId = req.user.sub;
    const credentials = await this.passkeyService.listCredentials(userId);
    return credentials.map((cred) =>
      PasskeyCredentialResponseDto.fromEntity(cred),
    );
  }

  @Delete('credentials/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a passkey credential' })
  @ApiResponse({ status: 200, description: 'Credential deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete last credential' })
  @ApiResponse({ status: 404, description: 'Credential not found' })
  async deleteCredential(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const userId = req.user.sub;
    await this.passkeyService.deleteCredential(userId, id);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeyService } from './api-key.service';
import { ApiKeyUsageService } from './usage.service';
import { CreateApiKeyDto, UpdateScopesDto, WhitelistDto } from './dto';
import { ApiKeyResponseDto, CreatedKeySecretDto } from './dto/api-key-response.dto';
import { Merchant } from '../database/entities/merchant.entity';

@ApiTags('API Key Management')
@ApiBearerAuth()
@UseGuards(AuthGuard('merchant-jwt'))
@Controller('api/v1/api-keys')
export class ApiKeyController {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly usageService: ApiKeyUsageService,
  ) {}

  @Post()
  @Throttle({ sensitive: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({
    status: 201,
    type: CreatedKeySecretDto,
    description: 'Key created. WARNING: Secret only shown once.',
  })
  async create(@Request() req: { user: Merchant }, @Body() dto: CreateApiKeyDto) {
    return this.apiKeyService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all API keys (masked) with scopes and last-used' })
  @ApiResponse({ status: 200, type: [ApiKeyResponseDto] })
  async findAll(@Request() req: { user: Merchant }) {
    return this.apiKeyService.findAllByMerchant(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get API key details' })
  @ApiResponse({ status: 200, type: ApiKeyResponseDto })
  async findOne(@Request() req: { user: Merchant }, @Param('id') id: string) {
    return this.apiKeyService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update API key scopes' })
  async updateScopes(
    @Request() req: { user: Merchant },
    @Param('id') id: string,
    @Body() dto: UpdateScopesDto,
  ) {
    return this.apiKeyService.updateScopes(id, req.user.id, dto.scopes);
  }

  @Post(':id/rotate')
  @Throttle({ sensitive: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate API key' })
  @ApiResponse({
    status: 200,
    type: CreatedKeySecretDto,
    description: 'Old key invalidated, new key returned.',
  })
  async rotate(@Request() req: { user: Merchant }, @Param('id') id: string) {
    return this.apiKeyService.rotate(id, req.user.id);
  }

  @Delete(':id')
  @Throttle({ sensitive: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key immediately' })
  async revoke(@Request() req: { user: Merchant }, @Param('id') id: string) {
    await this.apiKeyService.revoke(id, req.user.id);
  }

  @Get(':id/usage')
  @ApiOperation({ summary: 'Get usage statistics' })
  async getUsage(@Request() req: { user: Merchant }, @Param('id') id: string) {
    return this.usageService.getStatistics(id, req.user.id);
  }

  @Put(':id/whitelist')
  @ApiOperation({ summary: 'Manage IP Whitelist' })
  async updateWhitelist(
    @Request() req: { user: Merchant },
    @Param('id') id: string,
    @Body() dto: WhitelistDto,
  ) {
    await this.apiKeyService.updateIpWhitelist(id, req.user.id, dto.ips);
  }
}

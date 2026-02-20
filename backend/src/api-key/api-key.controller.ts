import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseArrayPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ApiKeyService } from './api-key.service';
import { ApiKeyUsageService } from './api-key-usage.service';
import { CreateApiKeyDto, UpdateScopesDto, WhitelistDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Assuming JWT for merchant session
import {
  ApiKeyResponseDto,
  CreatedKeySecretDto,
} from './dto/api-key-response.dto';

@ApiTags('API Key Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  async create(@Body() dto: CreateApiKeyDto) {
    return this.apiKeyService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all API keys' })
  @ApiResponse({ status: 200, type: [ApiKeyResponseDto] })
  async findAll() {
    // Service ensures keyHash is excluded and only prefix is returned
    return this.apiKeyService.findAllByMerchant();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get API key details' })
  @ApiResponse({ status: 200, type: ApiKeyResponseDto })
  async findOne(@Param('id') id: string) {
    return this.apiKeyService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update API key scopes' })
  async updateScopes(@Param('id') id: string, @Body() dto: UpdateScopesDto) {
    return this.apiKeyService.updateScopes(id, dto.scopes);
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
  async rotate(@Param('id') id: string) {
    return this.apiKeyService.rotate(id);
  }

  @Delete(':id')
  @Throttle({ sensitive: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key' })
  async revoke(@Param('id') id: string) {
    return this.apiKeyService.revoke(id);
  }

  @Get(':id/usage')
  @ApiOperation({ summary: 'Get usage statistics' })
  async getUsage(@Param('id') id: string) {
    return this.usageService.getStatistics(id);
  }

  @Put(':id/whitelist')
  @ApiOperation({ summary: 'Manage IP Whitelist' })
  async updateWhitelist(@Param('id') id: string, @Body() dto: WhitelistDto) {
    return this.apiKeyService.updateIpWhitelist(id, dto.ips);
  }
}

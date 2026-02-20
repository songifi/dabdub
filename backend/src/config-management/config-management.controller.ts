import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RequirePermissionGuard } from '../auth/guards/require-permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ConfigManagementService } from './config-management.service';
import { CreateChainConfigDto } from './dto/create-chain-config.dto';
import { UpdateChainConfigDto } from './dto/update-chain-config.dto';
import { CreateTokenConfigDto } from './dto/create-token-config.dto';
import { UpdateTokenConfigDto } from './dto/update-token-config.dto';
import { BlockchainConfig } from './entities/blockchain-config.entity';
import { TokenConfig } from './entities/token-config.entity';

@ApiTags('Config Management')
@Controller('api/v1/config')
@UseGuards(JwtGuard, RequirePermissionGuard)
export class ConfigManagementController {
  constructor(
    private readonly configService: ConfigManagementService,
  ) {}

  @Post('chains')
  @RequirePermission('config:write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new blockchain configuration' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Chain configuration created successfully',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Chain with this ID already exists',
  })
  async createChain(
    @Body() dto: CreateChainConfigDto,
  ): Promise<BlockchainConfig> {
    return this.configService.createChainConfig(dto);
  }

  @Get('chains')
  @RequirePermission('config:read')
  @ApiOperation({ summary: 'Get all blockchain configurations' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of blockchain configurations',
  })
  async getAllChains(
    @Query('enabledOnly') enabledOnly?: string,
  ): Promise<BlockchainConfig[]> {
    const enabled = enabledOnly === 'true';
    return this.configService.findAllChains(enabled);
  }

  @Get('chains/:chainId')
  @RequirePermission('config:read')
  @ApiOperation({ summary: 'Get blockchain configuration by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Blockchain configuration',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Chain not found',
  })
  async getChainById(@Param('chainId') chainId: string): Promise<BlockchainConfig> {
    return this.configService.findChainById(chainId);
  }

  @Put('chains/:chainId')
  @RequirePermission('config:write')
  @ApiOperation({ summary: 'Update blockchain configuration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chain configuration updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Chain not found',
  })
  async updateChain(
    @Param('chainId') chainId: string,
    @Body() dto: UpdateChainConfigDto,
  ): Promise<BlockchainConfig> {
    return this.configService.updateChainConfig(chainId, dto);
  }

  @Delete('chains/:chainId')
  @RequirePermission('config:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete blockchain configuration' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Chain configuration deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Chain not found',
  })
  async deleteChain(@Param('chainId') chainId: string): Promise<void> {
    await this.configService.deleteChainConfig(chainId);
  }

  @Post('tokens')
  @RequirePermission('config:write')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new token configuration' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Token configuration created successfully',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Token already exists on this chain',
  })
  async createToken(@Body() dto: CreateTokenConfigDto): Promise<TokenConfig> {
    return this.configService.createTokenConfig(dto);
  }

  @Get('tokens')
  @RequirePermission('config:read')
  @ApiOperation({ summary: 'Get all token configurations' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of token configurations',
  })
  async getAllTokens(
    @Query('chainId') chainId?: string,
    @Query('enabledOnly') enabledOnly?: string,
  ): Promise<TokenConfig[]> {
    const enabled = enabledOnly === 'true';
    return this.configService.findAllTokens(chainId, enabled);
  }

  @Get('tokens/:id')
  @RequirePermission('config:read')
  @ApiOperation({ summary: 'Get token configuration by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token configuration',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Token not found',
  })
  async getTokenById(@Param('id') id: string): Promise<TokenConfig> {
    return this.configService.findTokenById(id);
  }

  @Get('tokens/chain/:chainId/address/:address')
  @RequirePermission('config:read')
  @ApiOperation({ summary: 'Get token configuration by chain and address' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token configuration',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Token not found',
  })
  async getTokenByAddress(
    @Param('chainId') chainId: string,
    @Param('address') address: string,
  ): Promise<TokenConfig> {
    return this.configService.findTokenByAddress(chainId, address);
  }

  @Put('tokens/:id')
  @RequirePermission('config:write')
  @ApiOperation({ summary: 'Update token configuration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token configuration updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Token not found',
  })
  async updateToken(
    @Param('id') id: string,
    @Body() dto: UpdateTokenConfigDto,
  ): Promise<TokenConfig> {
    return this.configService.updateTokenConfig(id, dto);
  }

  @Delete('tokens/:id')
  @RequirePermission('config:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete token configuration' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Token configuration deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Token not found',
  })
  async deleteToken(@Param('id') id: string): Promise<void> {
    await this.configService.deleteTokenConfig(id);
  }
}

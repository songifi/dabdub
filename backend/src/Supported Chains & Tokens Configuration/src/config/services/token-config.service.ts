import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TokenConfig } from "../entities/token-config.entity";
import { BlockchainConfig } from "../entities/blockchain-config.entity";
import { CreateTokenConfigDto } from "../dtos/create-token-config.dto";
import { UpdateTokenConfigDto } from "../dtos/update-token-config.dto";
import { AuditService } from "./audit.service";
import { CacheService } from "./cache.service";
import { EventService } from "./event.service";
import { RpcService } from "./rpc.service";
import { EncryptionService } from "./encryption.service";

@Injectable()
export class TokenConfigService {
  private readonly logger = new Logger(TokenConfigService.name);

  constructor(
    @InjectRepository(TokenConfig)
    private readonly tokenRepository: Repository<TokenConfig>,
    @InjectRepository(BlockchainConfig)
    private readonly blockchainRepository: Repository<BlockchainConfig>,
    private readonly auditService: AuditService,
    private readonly cacheService: CacheService,
    private readonly eventService: EventService,
    private readonly rpcService: RpcService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async getAllTokens(
    chainId?: string,
    isEnabled?: boolean,
    symbol?: string,
  ): Promise<TokenConfig[]> {
    const cacheKey = this.cacheService.getTokensKey(chainId);
    let tokens = await this.cacheService.get<TokenConfig[]>(cacheKey);

    if (tokens) {
      return this.filterTokens(tokens, chainId, isEnabled, symbol);
    }

    let query = this.tokenRepository.createQueryBuilder("token");

    if (chainId) {
      query = query.where("token.chainId = :chainId", { chainId });
    }

    tokens = await query
      .orderBy("token.sortOrder", "ASC")
      .addOrderBy("token.createdAt", "ASC")
      .getMany();

    await this.cacheService.set(cacheKey, tokens);
    return this.filterTokens(tokens, chainId, isEnabled, symbol);
  }

  private filterTokens(
    tokens: TokenConfig[],
    chainId?: string,
    isEnabled?: boolean,
    symbol?: string,
  ): TokenConfig[] {
    return tokens.filter((token) => {
      if (chainId && token.chainId !== chainId) return false;
      if (isEnabled !== undefined && token.isEnabled !== isEnabled)
        return false;
      if (symbol && !token.symbol.toLowerCase().includes(symbol.toLowerCase()))
        return false;
      return true;
    });
  }

  async getTokenById(id: string): Promise<TokenConfig | null> {
    const cacheKey = this.cacheService.getTokenKey(id);
    let token = await this.cacheService.get<TokenConfig>(cacheKey);

    if (token) {
      return token;
    }

    token = await this.tokenRepository.findOne({ where: { id } });

    if (token) {
      await this.cacheService.set(cacheKey, token);
    }

    return token;
  }

  async createToken(
    createDto: CreateTokenConfigDto,
    userId?: string,
    ipAddress?: string,
  ): Promise<TokenConfig> {
    // Validate chain exists
    const chain = await this.blockchainRepository.findOne({
      where: { chainId: createDto.chainId },
    });

    if (!chain) {
      throw new BadRequestException(
        `Blockchain config not found for chain ${createDto.chainId}`,
      );
    }

    // Check uniqueness (chainId + tokenAddress)
    const existingToken = await this.tokenRepository.findOne({
      where: {
        chainId: createDto.chainId,
        tokenAddress: createDto.tokenAddress.toLowerCase(),
      },
    });

    if (existingToken) {
      throw new ConflictException(
        `Token already exists for ${createDto.chainId}:${createDto.tokenAddress}`,
      );
    }

    // Verify token on-chain (decrypt RPC URL for verification)
    const rpcUrl = this.encryptionService.decrypt(chain.rpcUrl);
    const isValid = await this.rpcService.verifyTokenOnChain(
      rpcUrl,
      createDto.tokenAddress,
      createDto.symbol,
      createDto.decimals,
    );

    if (!isValid) {
      throw new BadRequestException(
        `Token verification failed for ${createDto.tokenAddress}. Symbol or decimals mismatch.`,
      );
    }

    // Create token with isEnabled = false
    const token = this.tokenRepository.create({
      chainId: createDto.chainId,
      tokenAddress: createDto.tokenAddress.toLowerCase(),
      symbol: createDto.symbol,
      name: createDto.name,
      decimals: createDto.decimals,
      isEnabled: false, // Must be explicitly enabled
      isNative: createDto.tokenAddress.toLowerCase() === "native",
      minimumAcceptedAmount: createDto.minimumAcceptedAmount,
      maximumAcceptedAmount: createDto.maximumAcceptedAmount || null,
      coingeckoId: createDto.coingeckoId || null,
    });

    const savedToken = await this.tokenRepository.save(token);

    // Log audit
    await this.auditService.log(
      "TOKEN_ADDED",
      "token_config",
      savedToken.id,
      `Added new token ${createDto.symbol} on chain ${createDto.chainId}`,
      { token: createDto },
      userId,
      ipAddress,
    );

    // Publish event
    await this.eventService.publishTokenAdded({
      tokenId: savedToken.id,
      chainId: createDto.chainId,
      tokenAddress: createDto.tokenAddress,
      timestamp: new Date(),
    });

    // Invalidate cache
    await this.cacheService.del(
      this.cacheService.getTokensKey(createDto.chainId),
    );
    await this.cacheService.del(this.cacheService.getTokensKey());

    this.logger.log(
      `Created new token ${createDto.symbol} on chain ${createDto.chainId}`,
    );

    return savedToken;
  }

  async updateToken(
    id: string,
    updateDto: UpdateTokenConfigDto,
    userId?: string,
    ipAddress?: string,
  ): Promise<TokenConfig> {
    const token = await this.tokenRepository.findOne({ where: { id } });

    if (!token) {
      throw new NotFoundException(`Token not found with id ${id}`);
    }

    const changes: Record<string, any> = {};
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    if (
      updateDto.isEnabled !== undefined &&
      updateDto.isEnabled !== token.isEnabled
    ) {
      changes["isEnabled"] = true;
      oldValues["isEnabled"] = token.isEnabled;
      newValues["isEnabled"] = updateDto.isEnabled;
      token.isEnabled = updateDto.isEnabled;
    }

    if (
      updateDto.minimumAcceptedAmount !== undefined &&
      updateDto.minimumAcceptedAmount !== token.minimumAcceptedAmount.toString()
    ) {
      changes["minimumAcceptedAmount"] = true;
      oldValues["minimumAcceptedAmount"] = token.minimumAcceptedAmount;
      newValues["minimumAcceptedAmount"] = updateDto.minimumAcceptedAmount;
      token.minimumAcceptedAmount = parseFloat(updateDto.minimumAcceptedAmount);
    }

    if (
      updateDto.maximumAcceptedAmount !== undefined &&
      updateDto.maximumAcceptedAmount !==
        token.maximumAcceptedAmount?.toString()
    ) {
      changes["maximumAcceptedAmount"] = true;
      oldValues["maximumAcceptedAmount"] = token.maximumAcceptedAmount;
      newValues["maximumAcceptedAmount"] = updateDto.maximumAcceptedAmount;
      token.maximumAcceptedAmount = updateDto.maximumAcceptedAmount
        ? parseFloat(updateDto.maximumAcceptedAmount)
        : null;
    }

    if (
      updateDto.sortOrder !== undefined &&
      updateDto.sortOrder !== token.sortOrder
    ) {
      changes["sortOrder"] = true;
      oldValues["sortOrder"] = token.sortOrder;
      newValues["sortOrder"] = updateDto.sortOrder;
      token.sortOrder = updateDto.sortOrder;
    }

    const updatedToken = await this.tokenRepository.save(token);

    // Log audit
    const fullChanges = { old: oldValues, new: newValues };
    await this.auditService.log(
      "TOKEN_UPDATED",
      "token_config",
      id,
      `Updated token ${token.symbol} on chain ${token.chainId}`,
      fullChanges,
      userId,
      ipAddress,
    );

    // Publish event
    await this.eventService.publishTokenUpdated(id, newValues);

    // Invalidate cache
    await this.cacheService.del(this.cacheService.getTokenKey(id));
    await this.cacheService.del(this.cacheService.getTokensKey(token.chainId));
    await this.cacheService.del(this.cacheService.getTokensKey());

    this.logger.log(`Updated token ${token.symbol} (${id})`);

    return updatedToken;
  }

  async deleteToken(
    id: string,
    userId?: string,
    ipAddress?: string,
  ): Promise<void> {
    const token = await this.tokenRepository.findOne({ where: { id } });

    if (!token) {
      throw new NotFoundException(`Token not found with id ${id}`);
    }

    // Check for pending transactions
    const hasPendingTransactions = await this.checkPendingTransactions(
      token.chainId,
      token.tokenAddress,
    );
    if (hasPendingTransactions) {
      throw new BadRequestException(
        `Cannot delete token with pending transactions. ` +
          `Please wait for transactions to complete.`,
      );
    }

    // Soft disable the token
    token.isEnabled = false;
    const updatedToken = await this.tokenRepository.save(token);

    // Log audit
    await this.auditService.log(
      "TOKEN_DISABLED",
      "token_config",
      id,
      `Disabled token ${token.symbol} on chain ${token.chainId}`,
      { previouslyEnabled: true },
      userId,
      ipAddress,
    );

    // Publish event
    await this.eventService.publishTokenDisabled(
      id,
      token.chainId,
      token.symbol,
    );

    // Invalidate cache
    await this.cacheService.del(this.cacheService.getTokenKey(id));
    await this.cacheService.del(this.cacheService.getTokensKey(token.chainId));
    await this.cacheService.del(this.cacheService.getTokensKey());

    this.logger.log(`Disabled token ${token.symbol} (${id})`);
  }

  private async checkPendingTransactions(
    chainId: string,
    tokenAddress: string,
  ): Promise<boolean> {
    // TODO: Implement check for pending transactions for this token
    // This would query the transaction service for pending transactions involving this token
    return false;
  }
}

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BlockchainConfig } from "../entities/blockchain-config.entity";
import { UpdateChainConfigDto } from "../dtos/update-chain-config.dto";
import { AuditService } from "./audit.service";
import { CacheService } from "./cache.service";
import { EventService } from "./event.service";
import { EncryptionService } from "./encryption.service";
import { RpcService } from "./rpc.service";
import { config } from "../../config";

@Injectable()
export class BlockchainConfigService {
  private readonly logger = new Logger(BlockchainConfigService.name);

  constructor(
    @InjectRepository(BlockchainConfig)
    private readonly blockchainRepository: Repository<BlockchainConfig>,
    private readonly auditService: AuditService,
    private readonly cacheService: CacheService,
    private readonly eventService: EventService,
    private readonly encryptionService: EncryptionService,
    private readonly rpcService: RpcService,
  ) {}

  async getAllChains(): Promise<BlockchainConfig[]> {
    const cacheKey = this.cacheService.getChainListKey();
    let chains = await this.cacheService.get<BlockchainConfig[]>(cacheKey);

    if (chains) {
      return chains;
    }

    chains = await this.blockchainRepository.find({
      order: { createdAt: "ASC" },
    });

    // Decrypt RPC URLs
    chains = chains.map((chain) => ({
      ...chain,
      rpcUrl: this.encryptionService.decrypt(chain.rpcUrl),
      fallbackRpcUrl: chain.fallbackRpcUrl
        ? this.encryptionService.decrypt(chain.fallbackRpcUrl)
        : null,
    }));

    // Add node status
    const chainsWithStatus = await Promise.all(
      chains.map(async (chain) => ({
        ...chain,
        nodeStatus: {
          healthy: await this.rpcService.checkNodeHealth(chain.rpcUrl),
          fallbackHealthy: chain.fallbackRpcUrl
            ? await this.rpcService.checkNodeHealth(chain.fallbackRpcUrl)
            : null,
        },
      })),
    );

    await this.cacheService.set(
      cacheKey,
      chainsWithStatus,
      config.cache.chainConfigTtl,
    );
    return chainsWithStatus;
  }

  async getChainById(chainId: string): Promise<BlockchainConfig | null> {
    const cacheKey = this.cacheService.getChainConfigKey(chainId);
    let chain = await this.cacheService.get<BlockchainConfig>(cacheKey);

    if (chain) {
      return chain;
    }

    chain = await this.blockchainRepository.findOne({ where: { chainId } });

    if (!chain) {
      return null;
    }

    // Decrypt RPC URLs
    chain = {
      ...chain,
      rpcUrl: this.encryptionService.decrypt(chain.rpcUrl),
      fallbackRpcUrl: chain.fallbackRpcUrl
        ? this.encryptionService.decrypt(chain.fallbackRpcUrl)
        : null,
    };

    // Add node status
    const chainWithStatus = {
      ...chain,
      nodeStatus: {
        healthy: await this.rpcService.checkNodeHealth(chain.rpcUrl),
        fallbackHealthy: chain.fallbackRpcUrl
          ? await this.rpcService.checkNodeHealth(chain.fallbackRpcUrl)
          : null,
      },
    };

    await this.cacheService.set(
      cacheKey,
      chainWithStatus,
      config.cache.chainConfigTtl,
    );
    return chainWithStatus;
  }

  async updateChain(
    chainId: string,
    updateDto: UpdateChainConfigDto,
    userId?: string,
    ipAddress?: string,
  ): Promise<BlockchainConfig> {
    const chain = await this.blockchainRepository.findOne({
      where: { chainId },
    });

    if (!chain) {
      throw new NotFoundException(
        `Blockchain config not found for chain ${chainId}`,
      );
    }

    // If disabling the chain, check for pending transactions
    if (updateDto.isEnabled === false && chain.isEnabled === true) {
      const hasPendingTransactions =
        await this.checkPendingTransactions(chainId);
      if (hasPendingTransactions) {
        throw new BadRequestException(
          "Cannot disable chain with pending transactions. Please wait for transactions to complete.",
        );
      }
    }

    // Log warning if changing required confirmations
    if (
      updateDto.requiredConfirmations &&
      updateDto.requiredConfirmations !== chain.requiredConfirmations
    ) {
      this.logger.warn(
        `SECURITY WARNING: requiredConfirmations changed for ${chainId} ` +
          `from ${chain.requiredConfirmations} to ${updateDto.requiredConfirmations}`,
      );
    }

    // Track changes for audit
    const changes: Record<string, any> = {};
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    if (
      updateDto.isEnabled !== undefined &&
      updateDto.isEnabled !== chain.isEnabled
    ) {
      changes["isEnabled"] = true;
      oldValues["isEnabled"] = chain.isEnabled;
      newValues["isEnabled"] = updateDto.isEnabled;
      chain.isEnabled = updateDto.isEnabled;
    }

    if (
      updateDto.requiredConfirmations !== undefined &&
      updateDto.requiredConfirmations !== chain.requiredConfirmations
    ) {
      changes["requiredConfirmations"] = true;
      oldValues["requiredConfirmations"] = chain.requiredConfirmations;
      newValues["requiredConfirmations"] = updateDto.requiredConfirmations;
      chain.requiredConfirmations = updateDto.requiredConfirmations;
    }

    if (
      updateDto.pollingIntervalSeconds !== undefined &&
      updateDto.pollingIntervalSeconds !== chain.pollingIntervalSeconds
    ) {
      changes["pollingIntervalSeconds"] = true;
      oldValues["pollingIntervalSeconds"] = chain.pollingIntervalSeconds;
      newValues["pollingIntervalSeconds"] = updateDto.pollingIntervalSeconds;
      chain.pollingIntervalSeconds = updateDto.pollingIntervalSeconds;
    }

    if (updateDto.maxGasLimitGwei !== undefined) {
      const newValue = parseFloat(updateDto.maxGasLimitGwei);
      if (newValue !== chain.maxGasLimitGwei) {
        changes["maxGasLimitGwei"] = true;
        oldValues["maxGasLimitGwei"] = chain.maxGasLimitGwei;
        newValues["maxGasLimitGwei"] = newValue;
        chain.maxGasLimitGwei = newValue;
      }
    }

    if (updateDto.fallbackRpcUrl !== undefined) {
      const newValue = updateDto.fallbackRpcUrl
        ? this.encryptionService.encrypt(updateDto.fallbackRpcUrl)
        : null;
      if (newValue !== chain.fallbackRpcUrl) {
        changes["fallbackRpcUrl"] = true;
        oldValues["fallbackRpcUrl"] = "***encrypted***";
        newValues["fallbackRpcUrl"] = "***encrypted***";
        chain.fallbackRpcUrl = newValue;
      }
    }

    // Save changes
    const updatedChain = await this.blockchainRepository.save(chain);

    // Log audit
    const fullChanges = { old: oldValues, new: newValues };
    await this.auditService.log(
      "CHAIN_CONFIG_UPDATED",
      "blockchain_config",
      chain.id,
      `Updated chain config for ${chainId}: ${Object.keys(changes).join(", ")}`,
      fullChanges,
      userId,
      ipAddress,
    );

    // Publish event
    await this.eventService.publishChainConfigUpdated({
      chainId,
      changes: newValues,
      timestamp: new Date(),
    });

    // Invalidate cache
    await this.cacheService.del(this.cacheService.getChainConfigKey(chainId));
    await this.cacheService.del(this.cacheService.getChainListKey());

    this.logger.log(`Updated blockchain config for chain ${chainId}`);

    return updatedChain;
  }

  private async checkPendingTransactions(chainId: string): Promise<boolean> {
    // TODO: Implement check for pending transactions
    // This would query the transaction service for pending transactions on this chain
    return false;
  }
}

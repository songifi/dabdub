import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppConfig,
  DatabaseConfig,
  BlockchainConfig,
  ApiConfig,
} from './interfaces/config.interface';

@Injectable()
export class GlobalConfigService {
  private readonly logger = new Logger('GlobalConfigService');
  private configCache = new Map<string, any>();
  private initialized = false;

  constructor(private configService: ConfigService) {
    this.validateConfiguration();
  }

  private validateConfiguration(): void {
    try {
      const nodeEnv = process.env.NODE_ENV || 'development';

      // In development, we're more lenient; in production, we're strict
      if (nodeEnv === 'production') {
        const requiredConfigs = [
          'database.host',
          'blockchain.rpcEndpoint',
          'api.jwtSecret',
        ];

        for (const config of requiredConfigs) {
          const value = this.getConfigValue(config);
          if (!value) {
            throw new Error(`Missing required configuration: ${config}`);
          }
        }
      }

      this.initialized = true;
      this.logger.log('✓ Configuration validation passed');
    } catch (error: any) {
      this.logger.error(`✗ Configuration validation failed: ${error.message}`);
      throw error;
    }
  }

  private getConfigValue(path: string): any {
    const keys = path.split('.');
    let config = this.configService.get(keys[0]);

    for (let i = 1; i < keys.length; i++) {
      if (config == null) return null;
      config = config[keys[i]];
    }

    return config;
  }

  // App Configuration
  getAppConfig(): AppConfig {
    return this.getCachedConfig(
      'app',
      () => this.configService.get<AppConfig>('app') || ({} as AppConfig),
    );
  }

  getNodeEnv(): string {
    return this.getAppConfig().nodeEnv;
  }

  getPort(): number {
    return this.getAppConfig().port;
  }

  isProduction(): boolean {
    return this.getNodeEnv() === 'production';
  }

  isStaging(): boolean {
    return this.getNodeEnv() === 'staging';
  }

  isDevelopment(): boolean {
    return this.getNodeEnv() === 'development';
  }

  isDebugEnabled(): boolean {
    return this.getAppConfig().debug;
  }

  // Database Configuration
  getDatabaseConfig(): DatabaseConfig {
    return this.getCachedConfig(
      'database',
      () =>
        this.configService.get<DatabaseConfig>('database') ||
        ({} as DatabaseConfig),
    );
  }

  getDatabase(): DatabaseConfig {
    return this.getDatabaseConfig();
  }

  // Blockchain Configuration
  getBlockchainConfig(): BlockchainConfig {
    return this.getCachedConfig(
      'blockchain',
      () =>
        this.configService.get<BlockchainConfig>('blockchain') ||
        ({} as BlockchainConfig),
    );
  }

  getRpcEndpoint(): string {
    const rpc = this.getBlockchainConfig().rpcEndpoint;
    if (!rpc) {
      throw new Error('RPC_ENDPOINT is not configured');
    }
    return rpc;
  }

  getSettlementPrivateKey(): string {
    const key = this.getBlockchainConfig().settlementPrivateKey;
    if (!key) {
      throw new Error('SETTLEMENT_PRIVATE_KEY is not configured');
    }
    return key;
  }

  getChainId(): number | undefined {
    return this.getBlockchainConfig().chainId;
  }

  // API Configuration
  getApiConfig(): ApiConfig {
    return this.getCachedConfig(
      'api',
      () => this.configService.get<ApiConfig>('api') || ({} as ApiConfig),
    );
  }

  getJwtSecret(): string {
    const secret = this.getApiConfig().jwtSecret;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    return secret;
  }

  getJwtExpiry(): string {
    return this.getApiConfig().jwtExpiry || '24h';
  }

  // Caching
  private getCachedConfig<T>(key: string, getter: () => T): T {
    if (!this.configCache.has(key)) {
      this.configCache.set(key, getter());
    }
    return this.configCache.get(key) as T;
  }

  clearCache(): void {
    this.configCache.clear();
    this.logger.debug('Configuration cache cleared');
  }

  // Configuration summary (for debugging)
  getConfigSummary(): Record<string, any> {
    return {
      environment: this.getNodeEnv(),
      port: this.getPort(),
      debugEnabled: this.isDebugEnabled(),
      database: {
        host: this.getDatabaseConfig().host,
        port: this.getDatabaseConfig().port,
        database: this.getDatabaseConfig().database,
        poolSize: this.getDatabaseConfig().poolSize,
      },
      blockchain: {
        hasRpcEndpoint: !!this.getBlockchainConfig().rpcEndpoint,
        hasPrivateKey: !!this.getBlockchainConfig().settlementPrivateKey,
      },
      api: {
        hasJwtSecret: !!this.getApiConfig().jwtSecret,
        jwtExpiry: this.getJwtExpiry(),
      },
    };
  }
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  debug: boolean;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  poolSize: number;
  synchronize: boolean;
  logging: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
}

export interface BlockchainConfig {
  rpcEndpoint: string;
  settlementPrivateKey: string;
  chainId?: number;
}

export interface ApiConfig {
  jwtSecret: string;
  jwtExpiry?: string;
}

export interface NotificationConfig {
  email: {
    sendgridApiKey?: string;
    fromEmail?: string;
  };
  sms: {
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioPhoneNumber?: string;
  };
  push: {
    firebasePrivateKey?: string;
    firebaseProjectId?: string;
    firebaseClientEmail?: string;
  };
}

export interface ValidationConfig {
  required: string[];
  optional: string[];
}

export interface StellarNetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl: string;
  vaultContractId: string;
  walletFactoryContractId: string;
  usdcTokenId: string;
  backendSecretKey: string;
}

export interface StacksNetworkConfig {
  rpcUrl: string;
  network: 'mainnet' | 'testnet';
  usdcAssetIdentifier: string;
}

export interface StacksConfig {
  activeNetwork: 'testnet' | 'mainnet';
  networks: Record<string, StacksNetworkConfig>;
}

export interface StellarConfig {
  activeNetwork: 'testnet' | 'mainnet' | 'futurenet';
  networks: Record<string, StellarNetworkConfig>;
  defaultExpirationMinutes: number;
  minPaymentAmount: number;
  maxPaymentAmount: number;
}

export interface Config {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  blockchain: BlockchainConfig;
  api: ApiConfig;
  notification: NotificationConfig;
  stellar: StellarConfig;
  stacks: StacksConfig;
}

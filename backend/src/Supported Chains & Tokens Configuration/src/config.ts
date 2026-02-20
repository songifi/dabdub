import { TypeOrmModuleOptions } from "@nestjs/typeorm";

export const typeormConfig: TypeOrmModuleOptions = {
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_DATABASE || "blockchain_config",
  entities: ["dist/**/*.entity{.ts,.js}"],
  migrations: ["dist/migrations/**/*{.ts,.js}"],
  migrationsRun: process.env.NODE_ENV === "production",
  synchronize: process.env.NODE_ENV !== "production",
  logging: process.env.NODE_ENV !== "production",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
};

export const config = {
  database: typeormConfig,
  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || "default-encryption-key",
    algorithm: "aes-256-cbc",
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || "300000"),
    chainConfigTtl: 30000, // 30 seconds for chain config changes
  },
  rpc: {
    timeout: parseInt(process.env.RPC_TIMEOUT || "5000"),
    maxRetries: parseInt(process.env.RPC_MAX_RETRIES || "3"),
  },
};

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { redisConfig } from './redis.config';
import { jwtConfig } from './jwt.config';
import { stellarConfig } from './stellar.config';
import { zeptoConfig } from './zepto.config';
import { r2Config } from './r2.config';
import { queueConfig } from './queue.config';
import { flutterwaveConfig } from './flutterwave.config';
import { paystackConfig } from './paystack.config';
import { firebaseConfig } from './firebase.config';
import { sudoAfricaConfig } from './sudo-africa.config';
import { webPushConfig } from './web-push.config';

/**
 * Combined Joi validation schema for all environment variables.
 * Runs at startup with abortEarly: false so every missing var is reported at once.
 */
const validationSchema = Joi.object({
  // ── App ──────────────────────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development')
    .messages({
      'any.only': 'NODE_ENV must be development | production | test',
    }),
  PORT: Joi.number().integer().positive().default(3000),
  API_PREFIX: Joi.string().default('api'),
  THROTTLE_TTL: Joi.number().integer().positive().default(60),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),
  FRONTEND_URL: Joi.string()
    .uri()
    .required()
    .messages({ 'any.required': 'FRONTEND_URL is required' }),

  // ── Database ─────────────────────────────────────────────────────────────
  DB_HOST: Joi.string()
    .required()
    .messages({ 'any.required': 'DB_HOST is required' }),
  DB_PORT: Joi.number().integer().positive().default(5432),
  DB_USER: Joi.string()
    .required()
    .messages({ 'any.required': 'DB_USER is required' }),
  DB_PASS: Joi.string()
    .required()
    .messages({ 'any.required': 'DB_PASS is required' }),
  DB_NAME: Joi.string()
    .required()
    .messages({ 'any.required': 'DB_NAME is required' }),

  // ── Redis ─────────────────────────────────────────────────────────────────
  REDIS_HOST: Joi.string()
    .required()
    .messages({ 'any.required': 'REDIS_HOST is required' }),
  REDIS_PORT: Joi.number().integer().positive().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  BULL_BOARD_USERNAME: Joi.string()
    .min(1)
    .required()
    .messages({ 'any.required': 'BULL_BOARD_USERNAME is required' }),
  BULL_BOARD_PASSWORD: Joi.string()
    .min(1)
    .required()
    .messages({ 'any.required': 'BULL_BOARD_PASSWORD is required' }),

  // ── JWT ──────────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_ACCESS_SECRET is required',
    'string.min': 'JWT_ACCESS_SECRET must be at least 32 characters',
  }),
  JWT_REFRESH_SECRET: Joi.string().min(32).required().messages({
    'any.required': 'JWT_REFRESH_SECRET is required',
    'string.min': 'JWT_REFRESH_SECRET must be at least 32 characters',
  }),
  JWT_ACCESS_EXPIRY: Joi.string()
    .required()
    .messages({ 'any.required': 'JWT_ACCESS_EXPIRY is required (e.g. "15m")' }),
  JWT_REFRESH_EXPIRY: Joi.string()
    .required()
    .messages({ 'any.required': 'JWT_REFRESH_EXPIRY is required (e.g. "7d")' }),

  // ── Stellar ──────────────────────────────────────────────────────────────
  STELLAR_RPC_URL: Joi.string()
    .uri()
    .required()
    .messages({ 'any.required': 'STELLAR_RPC_URL is required' }),
  STELLAR_NETWORK: Joi.string()
    .valid('testnet', 'mainnet')
    .default('testnet')
    .messages({
      'any.only': 'STELLAR_NETWORK must be testnet | mainnet',
    }),
  STELLAR_NETWORK_PASSPHRASE: Joi.string()
    .required()
    .messages({ 'any.required': 'STELLAR_NETWORK_PASSPHRASE is required' }),
  STELLAR_CONTRACT_ID: Joi.string()
    .required()
    .messages({ 'any.required': 'STELLAR_CONTRACT_ID is required' }),
  STELLAR_ADMIN_SECRET_KEY: Joi.string().min(32).required().messages({
    'any.required': 'STELLAR_ADMIN_SECRET_KEY is required',
    'string.min': 'STELLAR_ADMIN_SECRET_KEY must be at least 32 characters',
  }),
  STELLAR_ADMIN_SECRET_KEY: Joi.string()
    .min(32)
    .required()
    .messages({
      'any.required': 'STELLAR_ADMIN_SECRET_KEY is required',
      'string.min': 'STELLAR_ADMIN_SECRET_KEY must be at least 32 characters',
    }),
  STELLAR_RECEIVE_ADDRESS: Joi.string()
    .length(56)
    .pattern(/^G[A-Z2-7]{55}$/)
    .required()
    .messages({ 'any.required': 'STELLAR_RECEIVE_ADDRESS is required' }),
  STELLAR_USDC_ISSUER: Joi.string()
    .length(56)
    .pattern(/^G[A-Z2-7]{55}$/)
    .required()
    .messages({ 'any.required': 'STELLAR_USDC_ISSUER is required' }),

  // ── Zepto Mail ───────────────────────────────────────────────────────────
  ZEPTOMAIL_API_KEY: Joi.string()
    .required()
    .messages({ 'any.required': 'ZEPTOMAIL_API_KEY is required' }),
  ZEPTOMAIL_FROM_EMAIL: Joi.string().email().required().messages({
    'any.required': 'ZEPTOMAIL_FROM_EMAIL is required',
    'string.email': 'ZEPTOMAIL_FROM_EMAIL must be a valid email address',
  }),

  // ── Cloudflare R2 ─────────────────────────────────────────────────────────
  R2_ACCOUNT_ID: Joi.string()
    .required()
    .messages({ 'any.required': 'R2_ACCOUNT_ID is required' }),
  R2_ACCESS_KEY_ID: Joi.string()
    .required()
    .messages({ 'any.required': 'R2_ACCESS_KEY_ID is required' }),
  R2_SECRET_ACCESS_KEY: Joi.string()
    .required()
    .messages({ 'any.required': 'R2_SECRET_ACCESS_KEY is required' }),
  R2_BUCKET_NAME: Joi.string()
    .required()
    .messages({ 'any.required': 'R2_BUCKET_NAME is required' }),

  // ── Flutterwave ───────────────────────────────────────────────────────────
  FLUTTERWAVE_SECRET_KEY: Joi.string()
    .required()
    .messages({ 'any.required': 'FLUTTERWAVE_SECRET_KEY is required' }),
  FLUTTERWAVE_WEBHOOK_SECRET: Joi.string()
    .required()
    .messages({ 'any.required': 'FLUTTERWAVE_WEBHOOK_SECRET is required' }),
  FLUTTERWAVE_BASE_URL: Joi.string()
    .uri()
    .default('https://api.flutterwave.com'),

  // ── Firebase ─────────────────────────────────────────────────────────────
  FIREBASE_SERVICE_ACCOUNT: Joi.string().required().messages({ 'any.required': 'FIREBASE_SERVICE_ACCOUNT is required' }),
  VAPID_PUBLIC_KEY: Joi.string()
    .required()
    .messages({ 'any.required': 'VAPID_PUBLIC_KEY is required' }),
  VAPID_PRIVATE_KEY: Joi.string()
    .required()
    .messages({ 'any.required': 'VAPID_PRIVATE_KEY is required' }),
  VAPID_SUBJECT: Joi.string()
    .uri({ scheme: [/https?/, 'mailto'] })
    .default('mailto:support@cheesepay.app'),

  // ── Paystack ──────────────────────────────────────────────────────────────
  PAYSTACK_SECRET_KEY: Joi.string()
    .required()
    .messages({ 'any.required': 'PAYSTACK_SECRET_KEY is required' }),
  PAYSTACK_BASE_URL: Joi.string().uri().default('https://api.paystack.co'),

  // ── Sudo Africa ────────────────────────────────────────────────────────────
  SUDO_AFRICA_API_KEY: Joi.string()
    .required()
    .messages({ 'any.required': 'SUDO_AFRICA_API_KEY is required' }),
  SUDO_AFRICA_BASE_URL: Joi.string()
    .uri()
    .default('https://api.sudoafrica.com/v1'),
  SUDO_AFRICA_WEBHOOK_SECRET: Joi.string()
    .required()
    .messages({ 'any.required': 'SUDO_AFRICA_WEBHOOK_SECRET is required' }),
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        stellarConfig,
        zeptoConfig,
        r2Config,
        queueConfig,
        flutterwaveConfig,
        paystackConfig,
        firebaseConfig,
        sudoAfricaConfig,
        webPushConfig,
      ],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),
  ],
})
export class AppConfigModule {}

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
import { flutterwaveConfig } from './flutterwave.config';

/**
 * Combined Joi validation schema for all environment variables.
 * Runs at startup with abortEarly: false so every missing var is reported at once.
 */
const validationSchema = Joi.object({
  // ── App ──────────────────────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development')
    .messages({ 'any.only': 'NODE_ENV must be development | production | test' }),
  PORT: Joi.number().integer().positive().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  THROTTLE_TTL: Joi.number().integer().positive().default(60),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),
  FRONTEND_URL: Joi.string().uri().required().messages({ 'any.required': 'FRONTEND_URL is required' }),

  // ── Database ─────────────────────────────────────────────────────────────
  DB_HOST: Joi.string().required().messages({ 'any.required': 'DB_HOST is required' }),
  DB_PORT: Joi.number().integer().positive().default(5432),
  DB_USER: Joi.string().required().messages({ 'any.required': 'DB_USER is required' }),
  DB_PASS: Joi.string().required().messages({ 'any.required': 'DB_PASS is required' }),
  DB_NAME: Joi.string().required().messages({ 'any.required': 'DB_NAME is required' }),

  // ── Redis ─────────────────────────────────────────────────────────────────
  REDIS_HOST: Joi.string().required().messages({ 'any.required': 'REDIS_HOST is required' }),
  REDIS_PORT: Joi.number().integer().positive().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  // ── JWT ──────────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .required()
    .messages({
      'any.required': 'JWT_ACCESS_SECRET is required',
      'string.min': 'JWT_ACCESS_SECRET must be at least 32 characters',
    }),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .required()
    .messages({
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
  STELLAR_NETWORK_PASSPHRASE: Joi.string()
    .required()
    .messages({ 'any.required': 'STELLAR_NETWORK_PASSPHRASE is required' }),
  STELLAR_CONTRACT_ID: Joi.string()
    .required()
    .messages({ 'any.required': 'STELLAR_CONTRACT_ID is required' }),
  STELLAR_ADMIN_SECRET_KEY: Joi.string()
    .min(32)
    .required()
    .messages({
      'any.required': 'STELLAR_ADMIN_SECRET_KEY is required',
      'string.min': 'STELLAR_ADMIN_SECRET_KEY must be at least 32 characters',
    }),

  // ── Zepto Mail ───────────────────────────────────────────────────────────
  ZEPTOMAIL_API_KEY: Joi.string()
    .required()
    .messages({ 'any.required': 'ZEPTOMAIL_API_KEY is required' }),
  ZEPTOMAIL_FROM_EMAIL: Joi.string()
    .email()
    .required()
    .messages({
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
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig, stellarConfig, zeptoConfig, r2Config, flutterwaveConfig],
      validationSchema,
      validationOptions: { abortEarly: false },
    }),
  ],
})
export class AppConfigModule {}

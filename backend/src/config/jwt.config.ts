import { registerAs } from '@nestjs/config';

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiry: string;
  refreshExpiry: string;
}

export const jwtConfig = registerAs(
  'jwt',
  (): JwtConfig => ({
    accessSecret: process.env['JWT_ACCESS_SECRET']!,
    refreshSecret: process.env['JWT_REFRESH_SECRET']!,
    accessExpiry: process.env['JWT_ACCESS_EXPIRY']!,
    refreshExpiry: process.env['JWT_REFRESH_EXPIRY']!,
  }),
);

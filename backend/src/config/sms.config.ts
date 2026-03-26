import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const smsConfig = registerAs('sms', () => ({
  termiiApiKey: process.env.TERMII_API_KEY!,
  termiiSenderId: process.env.TERMII_SENDER_ID ?? 'Cheese',
}));

export const smsConfigValidation = {
  TERMII_API_KEY: Joi.string().required(),
  TERMII_SENDER_ID: Joi.string().default('Cheese'),
};

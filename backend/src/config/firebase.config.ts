import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const firebaseConfig = registerAs('firebase', () => ({
  serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT!,
}));

export const firebaseConfigValidation = {
  FIREBASE_SERVICE_ACCOUNT: Joi.string().required(),
};

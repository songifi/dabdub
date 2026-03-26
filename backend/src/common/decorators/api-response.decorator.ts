import { SetMetadata } from '@nestjs/common';

/**
 * Sets a custom success message for the response envelope
 * @param message The success message to include in the response
 *
 * @example
 * @ApiResponse('User created successfully')
 * async createUser() { ... }
 */
export const API_RESPONSE_MESSAGE_KEY = 'API_RESPONSE_MESSAGE';
export const ApiResponse = (message: string) => SetMetadata(API_RESPONSE_MESSAGE_KEY, message);

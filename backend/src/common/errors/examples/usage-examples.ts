/**
 * Error Handling Usage Examples
 *
 * This file demonstrates how to use the error handling system in your services and controllers.
 * These are examples only and should not be executed directly.
 */

import { Injectable, Controller, Post, Body, Get, Param } from '@nestjs/common';
import {
  NotFoundException,
  BadRequestException,
  InsufficientFundsException,
  WalletNotFoundException,
  ValidationException,
} from '../exceptions/http-exceptions';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

// ============================================================================
// Example 1: Using Business Exceptions in Services
// ============================================================================

@Injectable()
export class WalletService {
  async getWallet(walletId: string) {
    const wallet = await this.findWallet(walletId);
    if (!wallet) {
      throw new WalletNotFoundException(walletId);
    }
    return wallet;
  }

  async transfer(walletId: string, amount: number) {
    const wallet = await this.getWallet(walletId);

    if (wallet.balance < amount) {
      throw new InsufficientFundsException(wallet.balance, amount, {
        walletId,
        transactionType: 'transfer',
      });
    }

    // Process transfer...
    return { success: true };
  }

  private async findWallet(walletId: string) {
    // Mock implementation
    return null;
  }
}

// ============================================================================
// Example 2: Using Validation with DTOs
// ============================================================================

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

@Controller('users')
export class UserController {
  @Post()
  async createUser(@Body() createUserDto: CreateUserDto) {
    // Validation happens automatically via CustomValidationPipe
    // If validation fails, a ValidationException is thrown with detailed errors
    return { message: 'User created' };
  }
}

// ============================================================================
// Example 3: Manual Validation
// ============================================================================

@Injectable()
export class PaymentService {
  async processPayment(amount: number, paymentMethod: string) {
    // Validate amount
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0', {
        amount,
      });
    }

    // Validate payment method
    const validMethods = ['card', 'bank', 'wallet'];
    if (!validMethods.includes(paymentMethod)) {
      throw new BadRequestException('Invalid payment method', {
        paymentMethod,
        validMethods,
      });
    }

    // Process payment...
    return { success: true };
  }
}

// ============================================================================
// Example 4: Using NotFoundException
// ============================================================================

@Controller('wallets')
export class WalletController {
  @Get(':id')
  async getWallet(@Param('id') id: string) {
    const wallet = await this.walletService.getWallet(id);
    // If wallet not found, WalletNotFoundException is thrown
    // which extends NotFoundException
    return wallet;
  }
}

// ============================================================================
// Example 5: Custom Validation with ValidationException
// ============================================================================

@Injectable()
export class CustomValidationService {
  validateEmailDomain(email: string) {
    const allowedDomains = ['example.com', 'test.com'];
    const domain = email.split('@')[1];

    if (!allowedDomains.includes(domain)) {
      throw new ValidationException(
        [
          {
            field: 'email',
            message: `Email domain must be one of: ${allowedDomains.join(', ')}`,
            rejectedValue: email,
            constraints: {
              allowedDomains: `Email domain must be one of: ${allowedDomains.join(', ')}`,
            },
          },
        ],
        'Email validation failed',
        { email, allowedDomains },
      );
    }
  }
}

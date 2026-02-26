import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  /** Bcrypt rounds for password hashing (spec: ≥12). */
  private readonly saltRounds = 12;
  /** Bcrypt rounds for admin users (spec: 12). */
  private readonly adminSaltRounds = 12;

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /** Hash password for admin users (12 rounds per security spec). */
  async hashPasswordForAdmin(password: string): Promise<string> {
    return bcrypt.hash(password, this.adminSaltRounds);
  }

  async comparePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  validatePasswordStrength(password: string): {
    isStrong: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isStrong: errors.length === 0,
      errors,
    };
  }
}

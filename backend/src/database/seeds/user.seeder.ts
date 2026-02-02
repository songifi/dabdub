import { DataSource } from 'typeorm';
import { UserEntity, UserRole } from '../entities/user.entity';
import * as crypto from 'crypto';

export class UserSeeder {
  static async seed(dataSource: DataSource): Promise<void> {
    const userRepository = dataSource.getRepository(UserEntity);

    // Hash password (in production, use bcrypt)
    const hashPassword = (password: string): string => {
      return crypto.createHash('sha256').update(password).digest('hex');
    };

    const users = [
      {
        id: crypto.randomUUID(),
        email: 'admin@dabdub.com',
        firstName: 'Admin',
        lastName: 'User',
        password: hashPassword('Admin123!'),
        role: UserRole.ADMIN,
        isActive: true,
        isEmailVerified: true,
        twoFactorEnabled: false,
        loginAttempts: 0,
      },
      {
        id: crypto.randomUUID(),
        email: 'merchant@dabdub.com',
        firstName: 'Merchant',
        lastName: 'User',
        password: hashPassword('Merchant123!'),
        role: UserRole.MERCHANT,
        isActive: true,
        isEmailVerified: true,
        twoFactorEnabled: false,
        loginAttempts: 0,
      },
      {
        id: crypto.randomUUID(),
        email: 'user@dabdub.com',
        firstName: 'Regular',
        lastName: 'User',
        password: hashPassword('User123!'),
        role: UserRole.USER,
        isActive: true,
        isEmailVerified: true,
        twoFactorEnabled: false,
        loginAttempts: 0,
      },
      {
        id: crypto.randomUUID(),
        email: 'test@dabdub.com',
        firstName: 'Test',
        lastName: 'User',
        password: hashPassword('Test123!'),
        role: UserRole.USER,
        isActive: true,
        isEmailVerified: false,
        twoFactorEnabled: false,
        loginAttempts: 0,
      },
    ];

    for (const userData of users) {
      const existingUser = await userRepository.findOne({
        where: { email: userData.email },
      });

      if (!existingUser) {
        const user = userRepository.create(userData);
        await userRepository.save(user);
        console.log(`✓ Created user: ${userData.email} (${userData.role})`);
      } else {
        console.log(`- User already exists: ${userData.email}`);
      }
    }

    console.log('\n📝 Default credentials:');
    console.log('Admin: admin@dabdub.com / Admin123!');
    console.log('Merchant: merchant@dabdub.com / Merchant123!');
    console.log('User: user@dabdub.com / User123!');
  }
}

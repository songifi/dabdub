import { DataSource } from 'typeorm';
import { UserEntity, UserRole } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export class AdminUserSeeder {
  static async seed(dataSource: DataSource): Promise<void> {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !password) {
      console.warn(
        '⚠  SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set — skipping bootstrap admin seed',
      );
      return;
    }

    const repo = dataSource.getRepository(UserEntity);
    const existing = await repo.findOne({ where: { email } });

    if (existing) {
      console.log(`  - Super admin already exists: ${email}`);
      return;
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = repo.create({
      id: crypto.randomUUID(),
      email,
      firstName: 'Super',
      lastName: 'Admin',
      password: hashed,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
      twoFactorEnabled: false,
      loginAttempts: 0,
    });

    await repo.save(user);
    console.log(`  ✓ Created super admin: ${email}`);
  }
}

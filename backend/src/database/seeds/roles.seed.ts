import { DataSource } from 'typeorm';
import { RoleEntity } from '../entities/role.entity';
import { UserRole, ROLE_PERMISSIONS } from '../entities/user.entity';

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]:
    'Full system access including finance reporting and queue management',
  [UserRole.ADMIN]: 'Administrative access with analytics and revenue reporting',
  [UserRole.SUPPORT_ADMIN]: 'Support access with read-only analytics',
  [UserRole.MERCHANT]: 'Merchant account access',
  [UserRole.USER]: 'Standard user access',
};

export class RolesSeeder {
  static async seed(dataSource: DataSource): Promise<void> {
    const repo = dataSource.getRepository(RoleEntity);

    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const existing = await repo.findOne({ where: { name: roleName } });

      if (existing) {
        existing.permissions = permissions;
        await repo.save(existing);
        console.log(`  - Updated role: ${roleName}`);
      } else {
        const role = repo.create({
          name: roleName,
          description: ROLE_DESCRIPTIONS[roleName as UserRole] ?? null,
          permissions,
        });
        await repo.save(role);
        console.log(`  ✓ Created role: ${roleName}`);
      }
    }
  }
}

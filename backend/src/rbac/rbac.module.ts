import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminPermission } from './entities/admin-permission.entity';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacService } from './rbac.service';
import { AdminPermissionsController } from './admin-permissions.controller';
import { AdminKycController } from './admin-kyc.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AdminPermission])],
  providers: [RolesGuard, PermissionsGuard, RbacService],
  controllers: [AdminPermissionsController, AdminKycController],
  exports: [RolesGuard, PermissionsGuard, RbacService],
})
export class RbacModule {}


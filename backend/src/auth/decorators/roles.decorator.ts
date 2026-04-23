import { SetMetadata } from '@nestjs/common';
import { MerchantRole } from '../../merchants/entities/merchant.entity';

export const Roles = (...roles: MerchantRole[]) => SetMetadata('roles', roles);

import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminRole } from './entities/admin.entity';
import { Request } from 'express';
import { AuditInterceptor, Audit } from '../audit/audit.interceptor';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@UseInterceptors(AuditInterceptor)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'List all users with pagination and filtering' })
  async listUsers(@Query() query: any) {
    return this.adminService.findAllUsers(query);
  }

  @Get('users/:id')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get full user profile' })
  async getUserProfile(@Param('id') id: string) {
    return this.adminService.findUserById(id);
  }

  @Patch('users/:id/freeze')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @Audit({ action: 'user.freeze', resourceType: 'user', resourceIdParam: 'id' })
  @ApiOperation({ summary: 'Freeze user account' })
  async freezeUser(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    const adminId = req.user.id;
    return this.adminService.freezeUser(id, reason, adminId);
  }

  @Patch('users/:id/unfreeze')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @Audit({ action: 'user.unfreeze', resourceType: 'user', resourceIdParam: 'id' })
  @ApiOperation({ summary: 'Unfreeze user account' })
  async unfreezeUser(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user.id;
    return this.adminService.unfreezeUser(id, adminId);
  }

  @Get('stats')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get dashboard stats' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('transactions')
  @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'List all transactions globally' })
  async listTransactions(@Query() query: any) {
    return this.adminService.findAllTransactions(query);
  }

  @Post('broadcast')
  @Roles(AdminRole.SUPERADMIN)
  @ApiOperation({ summary: 'Broadcast a message to users' })
  async broadcast(
    @Body() dto: { title: string; body: string; segment: string },
  ) {
    return this.adminService.broadcast(dto);
  }
}

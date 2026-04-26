import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AdminAlert } from './admin-alert.entity';
import { AdminAlertService } from './admin-alert.service';

@UseGuards(JwtAuthGuard)
@Controller('admin/alerts')
export class AdminAlertController {
  constructor(private readonly adminAlertService: AdminAlertService) {}

  @Get()
  list(): Promise<AdminAlert[]> {
    return this.adminAlertService.list();
  }

  @Patch(':id/acknowledge')
  acknowledge(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<AdminAlert> {
    const adminId =
      (req as Request & { user?: { merchantId?: string } }).user?.merchantId ??
      'system';
    return this.adminAlertService.acknowledge(id, adminId);
  }
}

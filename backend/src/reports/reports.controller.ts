import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { User } from '../users/entities/user.entity';

type AuthReq = Request & { user: User };

@ApiTags('reports')
@ApiBearerAuth()
@Controller({ version: '1' })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('reports')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Request an async data export' })
  create(@Req() req: AuthReq, @Body() dto: CreateReportDto) {
    return this.reportsService.create(req.user.id, dto);
  }

  @Get('reports')
  @ApiOperation({ summary: "List current user's report jobs" })
  list(@Req() req: AuthReq) {
    return this.reportsService.listForUser(req.user.id);
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get a specific report job (own only)' })
  getOne(@Req() req: AuthReq, @Param('id') id: string) {
    return this.reportsService.getForUser(req.user.id, id);
  }

  @UseGuards(SuperAdminGuard)
  @Get('admin/reports')
  @ApiOperation({ summary: 'Admin: list all report jobs' })
  adminList() {
    return this.reportsService.adminList();
  }
}

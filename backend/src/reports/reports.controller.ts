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
import { AccountStatementRequestDto } from './dto/account-statement-request.dto';

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

  @Post('account/export/data')
  @ApiOperation({ summary: 'Request GDPR data export (one every 30 days)' })
  requestGdprExport(@Req() req: AuthReq) {
    return this.reportsService.requestGdprExport(req.user.id);
  }

  @Post('account/export/statement')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Request account statement export (max 12 months)' })
  requestAccountStatement(
    @Req() req: AuthReq,
    @Body() body: AccountStatementRequestDto,
  ) {
    return this.reportsService.requestAccountStatement(
      req.user.id,
      body.dateFrom,
      body.dateTo,
    );
  }

  @Get('account/exports')
  @ApiOperation({ summary: 'List account export requests for current user' })
  listAccountExports(@Req() req: AuthReq) {
    return this.reportsService.listAccountExports(req.user.id);
  }

  @Get('account/exports/:id')
  @ApiOperation({ summary: 'Get account export status and download URL when ready' })
  getAccountExport(@Req() req: AuthReq, @Param('id') id: string) {
    return this.reportsService.getAccountExport(req.user.id, id);
  }

  @UseGuards(SuperAdminGuard)
  @Get('admin/reports')
  @ApiOperation({ summary: 'Admin: list all report jobs' })
  adminList() {
    return this.reportsService.adminList();
  }
}

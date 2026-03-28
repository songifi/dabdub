import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { KycService } from './kyc.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { RejectKycDto } from './dto/reject-kyc.dto';
import { AdminKycQueryDto } from './dto/admin-kyc-query.dto';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { User } from '../users/entities/user.entity';

type AuthReq = Request & { user: User };

@ApiTags('kyc')
@ApiBearerAuth()
@Controller({ version: '1' })
export class KycController {
  constructor(private readonly kycService: KycService) {}

  // ── User routes ─────────────────────────────────────────────────────────────

  @Post('kyc')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Submit a KYC application' })
  submit(@Req() req: AuthReq, @Body() dto: SubmitKycDto) {
    return this.kycService.submit(req.user.id, dto);
  }

  @Get('kyc')
  @ApiOperation({ summary: "Get current user's most recent KYC submission" })
  getMySubmission(@Req() req: AuthReq) {
    return this.kycService.getMySubmission(req.user.id);
  }

  // ── Admin routes ────────────────────────────────────────────────────────────

  @UseGuards(SuperAdminGuard)
  @Get('admin/kyc')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Admin: paginated KYC queue with filters' })
  adminList(@Query() query: AdminKycQueryDto) {
    return this.kycService.adminList(query);
  }

  @UseGuards(SuperAdminGuard)
  @Get('admin/kyc/:id')
  @ApiOperation({ summary: 'Admin: full KYC detail with presigned document URLs' })
  adminGetDetail(@Param('id') id: string) {
    return this.kycService.adminGetDetail(id);
  }

  @UseGuards(SuperAdminGuard)
  @Patch('admin/kyc/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: approve KYC and upgrade user tier' })
  approve(@Param('id') id: string, @Req() req: AuthReq) {
    return this.kycService.approve(id, req.user.id);
  }

  @UseGuards(SuperAdminGuard)
  @Patch('admin/kyc/:id/reject')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Admin: reject KYC with a reason' })
  reject(
    @Param('id') id: string,
    @Req() req: AuthReq,
    @Body() dto: RejectKycDto,
  ) {
    return this.kycService.reject(id, req.user.id, dto);
  }

  @UseGuards(SuperAdminGuard)
  @Patch('admin/kyc/:id/request-info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: set submission to under_review' })
  requestInfo(@Param('id') id: string, @Req() req: AuthReq) {
    return this.kycService.requestInfo(id, req.user.id);
  }
}

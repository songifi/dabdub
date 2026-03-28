import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { Roles } from '../rbac/decorators/roles.decorator';
import { Role } from '../rbac/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { DisputeService } from './dispute.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { QueryDisputesDto, RejectDisputeDto } from './dto/query-dispute.dto';

type AuthReq = Request & { user: User };

@ApiTags('disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ version: '1' })
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  // ── User routes ───────────────────────────────────────────────────────────

  @Post('disputes')
  @ApiOperation({ summary: 'Create a transaction dispute' })
  create(@Req() req: AuthReq, @Body() dto: CreateDisputeDto) {
    return this.disputeService.create(req.user.id, dto);
  }

  @Get('disputes')
  @ApiOperation({ summary: "List authenticated user's disputes" })
  list(@Req() req: AuthReq) {
    return this.disputeService.list(req.user.id);
  }

  @Get('disputes/:id')
  @ApiOperation({ summary: 'Get dispute detail' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthReq) {
    return this.disputeService.findOne(id, req.user.id);
  }

  // ── Admin routes ──────────────────────────────────────────────────────────

  @Get('admin/disputes')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin: list all disputes with filters' })
  adminList(@Query() query: QueryDisputesDto) {
    return this.disputeService.adminList(query);
  }

  @Get('admin/disputes/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin: full dispute detail with suggested resolution' })
  adminDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.disputeService.adminDetail(id);
  }

  @Patch('admin/disputes/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin: approve dispute and execute reversal' })
  approve(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthReq) {
    return this.disputeService.approve(id, req.user.id);
  }

  @Patch('admin/disputes/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Admin: reject dispute with resolution reason' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthReq,
    @Body() dto: RejectDisputeDto,
  ) {
    return this.disputeService.reject(id, req.user.id, dto.resolution);
  }
}

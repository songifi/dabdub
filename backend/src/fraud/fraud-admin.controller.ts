import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { FraudService, AuditLogPort, UserFreezePort } from './fraud.service';
import { QueryFlagsDto } from './dto/query-flags.dto';
import { ResolveFlagDto } from './dto/resolve-flag.dto';
import { FraudFlag as FraudFlagClass } from './entities/fraud-flag.entity';
import { Logger } from '@nestjs/common';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

/** Stub ports — replace with real injected services when available */
class StubUserFreezePort implements UserFreezePort {
  async freezeUser(_userId: string): Promise<void> {}
  async unfreezeUser(_userId: string): Promise<void> {}
}

class StubAuditLogPort implements AuditLogPort {
  private readonly logger = new Logger('AuditLog');
  async log(adminId: string, action: string, detail: string): Promise<void> {
    this.logger.log(
      `[AUDIT] adminId=${adminId} action=${action} detail=${detail}`,
    );
  }
}

@ApiTags('admin / fraud')
@ApiBearerAuth()
@Controller('admin/fraud')
export class FraudAdminController {
  constructor(private readonly fraudService: FraudService) {}

  @Get('flags')
  @ApiOperation({ summary: 'List fraud flags with optional filters and pagination' })
  @ApiPaginatedResponse(FraudFlagClass)
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async listFlags(
    @Query() query: QueryFlagsDto,
  ) {
    return this.fraudService.findFlags(query);
  }

  @Patch('flags/:id/resolve')
  @ApiOperation({ summary: 'Resolve or mark a fraud flag as false positive' })
  @ApiParam({ name: 'id', description: 'UUID of the fraud flag', example: 'a1b2c3d4-...' })
  @ApiResponse({ status: 200, type: FraudFlagClass })
  @ApiResponse({ status: 400, description: 'Invalid resolution status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Fraud flag not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async resolveFlag(
    @Param('id') id: string,
    @Body() dto: ResolveFlagDto,
    @Req() req: Request,
  ) {
    const adminId: string = (req as any).user?.id ?? 'system';

    return this.fraudService.resolveFlag(id, adminId, dto, {
      userFreeze: new StubUserFreezePort(),
      auditLog: new StubAuditLogPort(),
    });
  }
}

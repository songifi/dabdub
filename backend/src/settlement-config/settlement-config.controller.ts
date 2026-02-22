import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SettlementConfigService } from './settlement-config.service';
import {
  CreateSettlementRuleDto,
  UpdateSettlementRuleDto,
  ReorderSettlementRulesDto,
  TestSettlementRuleDto,
} from './dto/settlement-rule.dto';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Settlement Configuration')
@ApiBearerAuth()
@Controller('api/v1/config/settlement-rules')
@UseGuards(AdminJwtGuard, PermissionGuard)
export class SettlementConfigController {
  constructor(private readonly configService: SettlementConfigService) {}

  @Get()
  @Permissions('config:read')
  @ApiOperation({ summary: 'List settlement rules with match stats' })
  findAll() {
    return this.configService.findAll();
  }

  @Post()
  @Permissions('config:write')
  @ApiOperation({ summary: 'Create a new settlement rule' })
  create(@Body() dto: CreateSettlementRuleDto, @Req() req: any) {
    return this.configService.create(dto, req.user.id);
  }

  @Patch(':id')
  @Permissions('config:write')
  @ApiOperation({ summary: 'Update a settlement rule' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSettlementRuleDto,
    @Req() req: any,
  ) {
    return this.configService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Permissions('config:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a settlement rule' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.configService.remove(id, req.user.id);
  }

  @Post('reorder')
  @Permissions('config:write')
  @ApiOperation({ summary: 'Reorder settlement rule priorities' })
  reorder(@Body() dto: ReorderSettlementRulesDto, @Req() req: any) {
    return this.configService.reorder(dto.orderedIds, req.user.id);
  }

  @Post(':id/test')
  @Permissions('config:read')
  @ApiOperation({ summary: 'Test a settlement rule against sample data' })
  test(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TestSettlementRuleDto,
  ) {
    // Note: The service test function evaluates all rules to provide a trace
    // as per requirements. The :id in the URL is slightly redundant if we follow 
    // "Test rule against a hypothetical" but usually implies testing the whole system 
    // or specific trace. The requirement said "Returns which rule (if any) would match".
    return this.configService.test(dto);
  }
}

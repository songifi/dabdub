import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MerchantTagService } from '../services/merchant-tag.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';

@ApiTags('Merchants')
@Controller('merchants')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MerchantListController {
  constructor(private readonly tagService: MerchantTagService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Get merchants list with optional tag filtering' })
  @ApiResponse({
    status: 200,
    description: 'Merchants list retrieved successfully',
  })
  async getMerchants(@Query('tags') tagsQuery?: string): Promise<any> {
    // If tags parameter is provided, return merchant IDs that have all specified tags
    if (tagsQuery) {
      const tagNames = tagsQuery.split(',').map((t) => t.trim());
      const merchantIds = await this.tagService.getMerchantsByTags(tagNames);
      return { merchantIds, count: merchantIds.length };
    }

    // Otherwise, return all merchants (implementation would be in MerchantService)
    return { message: 'Implement standard merchant list endpoint' };
  }
}

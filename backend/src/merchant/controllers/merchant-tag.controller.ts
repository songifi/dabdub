import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MerchantTagService } from '../services/merchant-tag.service';
import {
  CreateTagDto,
  UpdateTagDto,
  MerchantTagResponseDto,
  AssignTagDto,
  MerchantTagAssignmentResponseDto,
} from '../dto/merchant-tag.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { UserEntity } from '../../database/entities/user.entity';

@ApiTags('Tags')
@Controller('tags')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MerchantTagController {
  constructor(private readonly tagService: MerchantTagService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Get all tags' })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
    type: [MerchantTagResponseDto],
  })
  async getAllTags(): Promise<MerchantTagResponseDto[]> {
    return this.tagService.getAllTags();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PermissionGuard)
  @Permissions('config:write')
  @ApiOperation({ summary: 'Create a new tag' })
  @ApiResponse({ status: 201, description: 'Tag created successfully' })
  async createTag(@Body() dto: CreateTagDto): Promise<MerchantTagResponseDto> {
    return this.tagService.createTag(dto);
  }

  @Patch(':tagId')
  @UseGuards(PermissionGuard)
  @Permissions('config:write')
  @ApiOperation({ summary: 'Update a tag' })
  @ApiResponse({ status: 200, description: 'Tag updated successfully' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async updateTag(
    @Param('tagId') tagId: string,
    @Body() dto: UpdateTagDto,
  ): Promise<MerchantTagResponseDto> {
    return this.tagService.updateTag(tagId, dto);
  }

  @Delete(':tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(PermissionGuard)
  @Permissions('config:write')
  @ApiOperation({ summary: 'Delete a tag' })
  @ApiResponse({ status: 204, description: 'Tag deleted successfully' })
  @ApiResponse({
    status: 409,
    description: 'Tag has active assignments',
  })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async deleteTag(@Param('tagId') tagId: string): Promise<void> {
    return this.tagService.deleteTag(tagId);
  }
}

@ApiTags('Merchant Tags')
@Controller('merchants/:merchantId/tags')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MerchantTagAssignmentController {
  constructor(private readonly tagService: MerchantTagService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Get tags for a merchant' })
  @ApiResponse({
    status: 200,
    description: 'Merchant tags retrieved successfully',
    type: [MerchantTagAssignmentResponseDto],
  })
  async getMerchantTags(
    @Param('merchantId') merchantId: string,
  ): Promise<MerchantTagAssignmentResponseDto[]> {
    return this.tagService.getMerchantTags(merchantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PermissionGuard)
  @Permissions('merchants:write')
  @ApiOperation({ summary: 'Assign tag to merchant' })
  @ApiResponse({ status: 201, description: 'Tag assigned successfully' })
  @ApiResponse({ status: 404, description: 'Tag or merchant not found' })
  @ApiResponse({
    status: 409,
    description: 'Tag already assigned to merchant',
  })
  async assignTagToMerchant(
    @Param('merchantId') merchantId: string,
    @Body() dto: AssignTagDto,
    @CurrentUser() user: UserEntity,
  ): Promise<MerchantTagAssignmentResponseDto> {
    return this.tagService.assignTagToMerchant(merchantId, user.id, dto);
  }

  @Delete(':tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(PermissionGuard)
  @Permissions('merchants:write')
  @ApiOperation({ summary: 'Remove tag from merchant' })
  @ApiResponse({ status: 204, description: 'Tag removed successfully' })
  @ApiResponse({ status: 404, description: 'Tag assignment not found' })
  async removeTagFromMerchant(
    @Param('merchantId') merchantId: string,
    @Param('tagId') tagId: string,
  ): Promise<void> {
    return this.tagService.removeTagFromMerchant(merchantId, tagId);
  }
}

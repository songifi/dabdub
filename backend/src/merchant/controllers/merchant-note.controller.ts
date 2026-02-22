import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
import { MerchantNoteService } from '../services/merchant-note.service';
import {
  CreateMerchantNoteDto,
  UpdateMerchantNoteDto,
  MerchantNoteResponseDto,
  MerchantNotesListResponseDto,
} from '../dto/merchant-note.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { NoteCategory } from '../entities/merchant-note.entity';

@ApiTags('Merchant Notes')
@Controller('merchants/:merchantId/notes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MerchantNoteController {
  constructor(private readonly noteService: MerchantNoteService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Get merchant notes' })
  @ApiResponse({
    status: 200,
    description: 'Notes retrieved successfully',
    type: [MerchantNotesListResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  async getNotes(
    @Param('merchantId') merchantId: string,
    @Query('category') category?: NoteCategory,
    @Query('search') search?: string,
  ): Promise<MerchantNotesListResponseDto[]> {
    return this.noteService.getNotes(merchantId, category, search);
  }

  @Get(':noteId')
  @UseGuards(PermissionGuard)
  @Permissions('merchants:read')
  @ApiOperation({ summary: 'Get merchant note by ID' })
  @ApiResponse({ status: 200, description: 'Note retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async getNoteById(
    @Param('merchantId') merchantId: string,
    @Param('noteId') noteId: string,
  ): Promise<MerchantNoteResponseDto> {
    return this.noteService.getNoteById(merchantId, noteId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PermissionGuard)
  @Permissions('merchants:write')
  @ApiOperation({ summary: 'Create a merchant note' })
  @ApiResponse({ status: 201, description: 'Note created successfully' })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  async createNote(
    @Param('merchantId') merchantId: string,
    @Body() dto: CreateMerchantNoteDto,
    @CurrentUser() user: UserEntity,
  ): Promise<MerchantNoteResponseDto> {
    return this.noteService.createNote(merchantId, user.id, dto);
  }

  @Patch(':noteId')
  @UseGuards(PermissionGuard)
  @Permissions('merchants:write')
  @ApiOperation({ summary: 'Update a merchant note' })
  @ApiResponse({ status: 200, description: 'Note updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only note author can edit',
  })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async updateNote(
    @Param('merchantId') merchantId: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateMerchantNoteDto,
    @CurrentUser() user: UserEntity,
  ): Promise<MerchantNoteResponseDto> {
    return this.noteService.updateNote(
      merchantId,
      noteId,
      user.id,
      user.role,
      dto,
    );
  }

  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(PermissionGuard)
  @Permissions('merchants:write')
  @ApiOperation({ summary: 'Delete a merchant note' })
  @ApiResponse({ status: 204, description: 'Note deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only note author can delete',
  })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async deleteNote(
    @Param('merchantId') merchantId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: UserEntity,
  ): Promise<void> {
    return this.noteService.deleteNote(merchantId, noteId, user.id, user.role);
  }

  @Patch(':noteId/pin')
  @UseGuards(PermissionGuard)
  @Permissions('merchants:write')
  @ApiOperation({ summary: 'Toggle pin status of a note' })
  @ApiResponse({ status: 200, description: 'Note pin status updated' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  @ApiResponse({ status: 400, description: 'Maximum pinned notes reached' })
  async togglePin(
    @Param('merchantId') merchantId: string,
    @Param('noteId') noteId: string,
  ): Promise<MerchantNoteResponseDto> {
    return this.noteService.togglePin(merchantId, noteId);
  }
}

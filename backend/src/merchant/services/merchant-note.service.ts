import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MerchantNote, NoteCategory } from '../entities/merchant-note.entity';
import { Merchant } from '../../database/entities/merchant.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import {
  CreateMerchantNoteDto,
  UpdateMerchantNoteDto,
  MerchantNoteResponseDto,
  MerchantNotesListResponseDto,
  FollowUpNoteDto,
} from '../dto/merchant-note.dto';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class MerchantNoteService {
  constructor(
    @InjectRepository(MerchantNote)
    private readonly noteRepository: Repository<MerchantNote>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
  ) {}

  async createNote(
    merchantId: string,
    authorId: string,
    dto: CreateMerchantNoteDto,
  ): Promise<MerchantNoteResponseDto> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const author = await this.userRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new NotFoundException('Author not found');
    }

    const note = this.noteRepository.create({
      merchantId,
      authorId,
      content: dto.content,
      category: dto.category,
      mentionedAdminIds: dto.mentionedAdminIds || [],
      followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : null,
    });

    const savedNote = await this.noteRepository.save(note);

    // Send email notifications to mentioned admins
    if (dto.mentionedAdminIds && dto.mentionedAdminIds.length > 0) {
      await this.notifyMentionedAdmins(savedNote, author, merchant);
    }

    return this.mapToResponseDto(savedNote, author);
  }

  async getNotes(
    merchantId: string,
    category?: NoteCategory,
    search?: string,
  ): Promise<MerchantNotesListResponseDto[]> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    let query = this.noteRepository
      .createQueryBuilder('note')
      .where('note.merchantId = :merchantId', { merchantId })
      .leftJoinAndSelect('note.author', 'author')
      .orderBy('note.isPinned', 'DESC')
      .addOrderBy('note.createdAt', 'DESC');

    if (category) {
      query = query.andWhere('note.category = :category', { category });
    }

    if (search) {
      query = query.andWhere('note.content ILIKE :search', {
        search: `%${search}%`,
      });
    }

    const notes = await query.getMany();

    return notes.map((note) => ({
      id: note.id,
      merchantId: note.merchantId,
      authorId: note.authorId,
      author: {
        id: note.author.id,
        email: note.author.email,
      },
      content: note.content,
      isPinned: note.isPinned,
      category: note.category,
      mentionedAdminIds: note.mentionedAdminIds,
      isEdited: note.isEdited,
      editedAt: note.editedAt,
      followUpAt: note.followUpAt,
      createdAt: note.createdAt,
    }));
  }

  async getNoteById(
    merchantId: string,
    noteId: string,
  ): Promise<MerchantNoteResponseDto> {
    const note = await this.noteRepository
      .createQueryBuilder('note')
      .where('note.id = :noteId', { noteId })
      .andWhere('note.merchantId = :merchantId', { merchantId })
      .leftJoinAndSelect('note.author', 'author')
      .getOne();

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return this.mapToResponseDto(note, note.author);
  }

  async updateNote(
    merchantId: string,
    noteId: string,
    authorId: string,
    userRole: UserRole,
    dto: UpdateMerchantNoteDto,
  ): Promise<MerchantNoteResponseDto> {
    const note = await this.noteRepository
      .createQueryBuilder('note')
      .where('note.id = :noteId', { noteId })
      .andWhere('note.merchantId = :merchantId', { merchantId })
      .leftJoinAndSelect('note.author', 'author')
      .getOne();

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Only author or SUPER_ADMIN can edit
    if (note.authorId !== authorId && userRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only note author can edit this note');
    }

    if (dto.content !== undefined) {
      note.content = dto.content;
    }
    if (dto.category !== undefined) {
      note.category = dto.category;
    }
    if (dto.mentionedAdminIds !== undefined) {
      note.mentionedAdminIds = dto.mentionedAdminIds;
    }
    if (dto.followUpAt !== undefined) {
      note.followUpAt = dto.followUpAt ? new Date(dto.followUpAt) : null;
    }

    note.isEdited = true;
    note.editedAt = new Date();

    const updatedNote = await this.noteRepository.save(note);

    return this.mapToResponseDto(updatedNote, updatedNote.author);
  }

  async deleteNote(
    merchantId: string,
    noteId: string,
    authorId: string,
    userRole: UserRole,
  ): Promise<void> {
    const note = await this.noteRepository.findOne({
      where: { id: noteId, merchantId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Only author or SUPER_ADMIN can delete
    if (note.authorId !== authorId && userRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only note author can delete this note');
    }

    await this.noteRepository.softDelete(noteId);
  }

  async togglePin(
    merchantId: string,
    noteId: string,
  ): Promise<MerchantNoteResponseDto> {
    const note = await this.noteRepository
      .createQueryBuilder('note')
      .where('note.id = :noteId', { noteId })
      .andWhere('note.merchantId = :merchantId', { merchantId })
      .leftJoinAndSelect('note.author', 'author')
      .getOne();

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Check max pinned notes constraint
    if (!note.isPinned) {
      const pinnedCount = await this.noteRepository.count({
        where: { merchantId, isPinned: true },
      });

      if (pinnedCount >= 3) {
        throw new BadRequestException(
          'Maximum 3 pinned notes per merchant allowed',
        );
      }
    }

    note.isPinned = !note.isPinned;
    const updatedNote = await this.noteRepository.save(note);

    return this.mapToResponseDto(updatedNote, updatedNote.author);
  }

  async getFollowUps(
    authorId: string,
    userRole: UserRole,
  ): Promise<FollowUpNoteDto[]> {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let query = this.noteRepository
      .createQueryBuilder('note')
      .where('note.followUpAt IS NOT NULL')
      .andWhere('note.followUpAt <= :sevenDaysFromNow', {
        sevenDaysFromNow,
      })
      .leftJoinAndSelect('note.author', 'author')
      .leftJoinAndSelect('note.merchant', 'merchant')
      .orderBy('note.followUpAt', 'ASC');

    // Filter by author unless SUPER_ADMIN
    if (userRole !== UserRole.SUPER_ADMIN) {
      query = query.andWhere('note.authorId = :authorId', { authorId });
    }

    const notes = await query.getMany();

    return notes.map((note) => ({
      id: note.id,
      merchantId: note.merchantId,
      merchantName: note.merchant.name,
      authorId: note.authorId,
      author: {
        id: note.author.id,
        email: note.author.email,
      },
      content: note.content,
      category: note.category,
      followUpAt: note.followUpAt,
      createdAt: note.createdAt,
    }));
  }

  private async notifyMentionedAdmins(
    note: MerchantNote,
    author: UserEntity,
    merchant: Merchant,
  ): Promise<void> {
    const mentionedAdmins = await this.userRepository.find({
      where: note.mentionedAdminIds.map((id) => ({ id })),
    });

    const adminDashboardUrl =
      process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000';

    for (const admin of mentionedAdmins) {
      try {
        await this.notificationQueue.add(
          'send-email',
          {
            to: admin.email,
            subject: `You were mentioned in a merchant note for ${merchant.name}`,
            template: 'merchant-note-mention',
            data: {
              mentionedAdminName: admin.email.split('@')[0],
              authorName: author.email.split('@')[0],
              merchantName: merchant.name,
              merchantId: note.merchantId,
              noteExcerpt: note.content.substring(0, 200),
              noteCategory: note.category,
              noteUrl: `${adminDashboardUrl}/merchants/${note.merchantId}/notes/${note.id}`,
            },
          },
          { removeOnComplete: true, removeOnFail: false },
        );
      } catch (error) {
        console.error(
          `Failed to queue notification for admin ${admin.id}:`,
          error,
        );
      }
    }
  }

  private mapToResponseDto(
    note: MerchantNote,
    author: UserEntity,
  ): MerchantNoteResponseDto {
    return {
      id: note.id,
      merchantId: note.merchantId,
      authorId: note.authorId,
      author: {
        id: author.id,
        email: author.email,
      },
      content: note.content,
      isPinned: note.isPinned,
      category: note.category,
      mentionedAdminIds: note.mentionedAdminIds,
      isEdited: note.isEdited,
      editedAt: note.editedAt,
      followUpAt: note.followUpAt,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }
}

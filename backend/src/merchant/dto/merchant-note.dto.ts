import {
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  IsArray,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { NoteCategory } from '../entities/merchant-note.entity';

export class CreateMerchantNoteDto {
  @IsString()
  @MinLength(5)
  @MaxLength(10000)
  content: string;

  @IsEnum(NoteCategory)
  category: NoteCategory;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mentionedAdminIds?: string[];

  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}

export class UpdateMerchantNoteDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsEnum(NoteCategory)
  category?: NoteCategory;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mentionedAdminIds?: string[];

  @IsOptional()
  @IsDateString()
  followUpAt?: string | null;
}

export class MerchantNoteResponseDto {
  id: string;
  merchantId: string;
  authorId: string;
  author: {
    id: string;
    email: string;
  };
  content: string;
  isPinned: boolean;
  category: NoteCategory;
  mentionedAdminIds: string[];
  isEdited: boolean;
  editedAt: Date | null;
  followUpAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MerchantNotesListResponseDto {
  id: string;
  merchantId: string;
  authorId: string;
  author: {
    id: string;
    email: string;
  };
  content: string;
  isPinned: boolean;
  category: NoteCategory;
  mentionedAdminIds: string[];
  isEdited: boolean;
  editedAt: Date | null;
  followUpAt: Date | null;
  createdAt: Date;
}

export class FollowUpNoteDto {
  id: string;
  merchantId: string;
  merchantName: string;
  authorId: string;
  author: {
    id: string;
    email: string;
  };
  content: string;
  category: NoteCategory;
  followUpAt: Date;
  createdAt: Date;
}

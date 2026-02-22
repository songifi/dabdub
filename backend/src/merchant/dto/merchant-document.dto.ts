import { IsEnum, IsString, MinLength, IsOptional, IsDateString } from 'class-validator';
import { DocumentType } from '../enums/merchant-document.enums';

export class RequestDocumentDto {
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsString()
  @MinLength(20)
  message: string; // Shown to merchant explaining why it's needed

  @IsOptional()
  @IsDateString()
  deadline?: string; // Optional submission deadline
}

export class RejectDocumentDto {
  @IsString()
  @MinLength(20)
  rejectionReason: string;
}

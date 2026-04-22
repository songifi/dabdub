import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiResponse,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { PresignDto } from './dto/presign.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { PresignResponseDto } from './dto/presign-response.dto';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('uploads')
@ApiBearerAuth('bearer')
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presign')
  @ApiOperation({ summary: 'Request a presigned URL for direct upload' })
  @ApiOkResponse({ type: PresignResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  presign(
    @Req() req: AuthRequest,
    @Body() dto: PresignDto,
  ): Promise<PresignResponseDto> {
    return this.uploadService.getPresignedUrl(req.user.id, dto);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm an upload completed to the given key' })
  @ApiOkResponse({ type: FileUploadResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Upload record not found for key' })
  @ApiForbiddenResponse({ description: 'Key belongs to another user' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async confirm(
    @Req() req: AuthRequest,
    @Body() dto: ConfirmUploadDto,
  ): Promise<FileUploadResponseDto> {
    const row = await this.uploadService.confirmUpload(req.user.id, dto.key);
    return row as FileUploadResponseDto;
  }
}

import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { PresignDto } from './dto/presign.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { FileUpload } from './entities/file-upload.entity';

interface AuthRequest {
  user: { id: string };
}

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presign')
  presign(
    @Req() req: AuthRequest,
    @Body() dto: PresignDto,
  ): Promise<{ url: string; key: string }> {
    return this.uploadService.getPresignedUrl(req.user.id, dto);
  }

  @Post('confirm')
  confirm(
    @Req() req: AuthRequest,
    @Body() dto: ConfirmUploadDto,
  ): Promise<FileUpload> {
    return this.uploadService.confirmUpload(req.user.id, dto.key);
  }
}

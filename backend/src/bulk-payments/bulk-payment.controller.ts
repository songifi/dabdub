import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Query,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserId } from '../auth/decorators/user-id.decorator';
import { BulkPaymentService } from './bulk-payment.service';
import { BulkPaymentUploadDto } from './dto/bulk-payment-upload.dto';
import { BulkPaymentRowsQueryDto } from './dto/bulk-payment-rows-query.dto';
import { BulkPaymentResponseDto, BulkPaymentUploadResponseDto } from './dto/bulk-payment-response.dto';
import { BulkPaymentRowsResponseDto } from './dto/bulk-payment-row-response.dto';

@Controller('payments/bulk')
@UseGuards(JwtAuthGuard)
export class BulkPaymentController {
  constructor(private readonly bulkPaymentService: BulkPaymentService) {}

  @Post()
  @UseInterceptors(FileInterceptor('csv'))
  async upload(
    @UserId() userId: string,
    @Body() dto: BulkPaymentUploadDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 }), // 1MB
          new FileTypeValidator({ fileType: 'text/csv' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<BulkPaymentUploadResponseDto> {
    return this.bulkPaymentService.upload(userId, file.buffer, dto);
  }

  @Get()
  async findAll(@UserId() userId: string): Promise<BulkPaymentResponseDto[]> {
    return this.bulkPaymentService.findAll(userId);
  }

  @Get(':id')
  async findOne(
    @UserId() userId: string,
    @Param('id') id: string,
  ): Promise<BulkPaymentResponseDto> {
    return this.bulkPaymentService.findOne(userId, id);
  }

  @Get(':id/rows')
  async findRows(
    @UserId() userId: string,
    @Param('id') bulkPaymentId: string,
    @Query() query: BulkPaymentRowsQueryDto,
  ): Promise<BulkPaymentRowsResponseDto> {
    return this.bulkPaymentService.findRows(userId, bulkPaymentId, query);
  }

  @Get(':id/export')
  async exportCsv(
    @UserId() userId: string,
    @Param('id') bulkPaymentId: string,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.bulkPaymentService.exportCsv(userId, bulkPaymentId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bulk-payment-${bulkPaymentId}.csv"`);
    res.send(csv);
  }
}
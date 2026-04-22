import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional } from 'class-validator';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

class CreateWebhookDto {
  @IsString() url: string;
  @IsArray() events: string[];
  @IsOptional() @IsString() secret?: string;
}

@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'List webhooks' })
  findAll(@Request() req) {
    return this.webhooksService.findAll(req.user.merchantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create webhook' })
  create(@Request() req, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(req.user.merchantId, dto.url, dto.events, dto.secret);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete webhook' })
  remove(@Request() req, @Param('id') id: string) {
    return this.webhooksService.remove(id, req.user.merchantId);
  }
}

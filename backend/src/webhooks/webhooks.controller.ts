import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CreateWebhookDto } from './dto/create-webhook.dto';

@ApiTags('webhooks')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'List webhooks' })
  @ApiOkResponse({ description: 'Webhook subscriptions' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  findAll(@Request() req: { user: { merchantId: string } }) {
    return this.webhooksService.findAll(req.user.merchantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create webhook' })
  @ApiCreatedResponse({ description: 'Webhook created' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  create(@Request() req: { user: { merchantId: string } }, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(req.user.merchantId, dto.url, dto.events, dto.secret);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete webhook' })
  @ApiParam({ name: 'id', description: 'Webhook id' })
  @ApiOkResponse({ description: 'Deleted' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiNotFoundResponse({ description: 'Webhook not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  remove(@Request() req: { user: { merchantId: string } }, @Param('id', ParseUUIDPipe) id: string) {
    return this.webhooksService.remove(id, req.user.merchantId);
  }
}

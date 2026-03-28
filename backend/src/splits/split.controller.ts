import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { SplitService } from './split.service';
import { CreateSplitDto } from './dto/create-split.dto';
import { QuerySplitsDto } from './dto/query-splits.dto';

type AuthReq = Request & { user: User };

@ApiTags('splits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'splits', version: '1' })
export class SplitController {
  constructor(private readonly splitService: SplitService) {}

  @Post()
  @ApiOperation({ summary: 'Create a split payment request' })
  create(@Req() req: AuthReq, @Body() dto: CreateSplitDto) {
    return this.splitService.create(req.user.id, req.user.username, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List splits where user is initiator or participant' })
  list(@Req() req: AuthReq, @Query() query: QuerySplitsDto) {
    return this.splitService.list(req.user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get split detail with all participants' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthReq) {
    return this.splitService.findOne(id, req.user.id);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Pay your share of a split' })
  pay(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthReq) {
    return this.splitService.pay(id, req.user.id, req.user.username);
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Decline participation in a split' })
  decline(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthReq) {
    return this.splitService.decline(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a split (initiator only)' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthReq) {
    return this.splitService.cancel(id, req.user.id);
  }
}

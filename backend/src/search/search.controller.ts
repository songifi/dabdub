import {
  Controller,
  Get,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SearchService } from './search.service';
import { SearchQueryDto, SearchResultsDto } from './dto/search.dto';

type AuthRequest = Request & { user: { id: string } };

@ApiTags('search')
@ApiBearerAuth()
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Global search across users, transactions, and paylinks' })
  search(
    @Req() req: AuthRequest,
    @Query() query: SearchQueryDto,
  ): Promise<SearchResultsDto> {
    return this.searchService.search(req.user.id, query.q, query.types);
  }
}

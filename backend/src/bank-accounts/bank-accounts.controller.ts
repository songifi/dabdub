import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { User } from '../users/entities/user.entity';
import { BankListResponseDto } from './dto/bank-list-response.dto';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { BankAccount } from './entities/bank-account.entity';
import { BankAccountsService } from './bank-accounts.service';

type AuthenticatedRequest = Request & { user: User };

@ApiTags('bank-accounts')
@ApiBearerAuth()
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Link a Nigerian bank account for payouts/settlement',
  })
  @ApiResponse({ status: 201, type: BankAccount })
  @ApiResponse({
    status: 400,
    description: 'Invalid account details or business rule violation',
  })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateBankAccountDto,
  ): Promise<BankAccount> {
    return this.bankAccountsService.createForUser(req.user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List verified bank accounts for current user' })
  @ApiResponse({ status: 200, type: [BankAccount] })
  list(@Req() req: AuthenticatedRequest): Promise<BankAccount[]> {
    return this.bankAccountsService.listVerifiedForUser(req.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a linked bank account' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 400, description: 'Set a new default first' })
  async remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.bankAccountsService.deleteForUser(req.user, id);
  }

  @Patch(':id/set-default')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a linked bank account as default' })
  @ApiResponse({ status: 204, description: 'Default updated' })
  async setDefault(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.bankAccountsService.setDefaultForUser(req.user, id);
  }

  @Get('banks')
  @ApiOperation({
    summary: 'List supported Nigerian banks (cached from Paystack)',
  })
  @ApiResponse({ status: 200, type: BankListResponseDto })
  async getBanks(): Promise<BankListResponseDto> {
    const banks = await this.bankAccountsService.getBanks();
    return { banks };
  }
}

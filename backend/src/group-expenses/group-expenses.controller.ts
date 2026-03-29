import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupExpensesService } from './group-expenses.service';
import { CreateGroupExpenseDto } from './dto/create-group-expense.dto';
import { UpdateSplitsDto } from './dto/update-splits.dto';
import { QueryGroupExpensesDto } from './dto/query-group-expenses.dto';

@ApiTags('GroupExpenses')
@Controller()
export class GroupExpensesController {
  constructor(private readonly service: GroupExpensesService) {}

  @Post('groups/:id/expenses')
  @ApiOperation({ summary: 'Create group expense' })
  createExpense(@Req() req: any, @Param('id', ParseUUIDPipe) groupId: string, @Body() dto: CreateGroupExpenseDto) {
    return this.service.createExpense(req.user.id, dto, groupId);
  }

  @Get('groups/:id/expenses')
  @ApiOperation({ summary: 'List group expenses by group id' })
  getExpenses(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) groupId: string,
    @Query() query: QueryGroupExpensesDto,
  ) {
    return this.service.getExpenses(req.user.id, groupId, query);
  }

  @Get('groups/:id/expenses/balance')
  @ApiOperation({ summary: 'Get group balance summary' })
  getGroupBalanceSummary(@Req() req: any, @Param('id', ParseUUIDPipe) groupId: string) {
    return this.service.getGroupBalanceSummary(req.user.id, groupId);
  }

  @Post('expenses/:id/settle')
  @ApiOperation({ summary: 'Settle current user share via transfer' })
  settleExpense(@Req() req: any, @Param('id', ParseUUIDPipe) expenseId: string) {
    return this.service.settleViaTransfer(expenseId, req.user.id, req.user.username);
  }

  @Patch('expenses/:id/splits')
  @ApiOperation({ summary: 'Update expense split amounts' })
  updateSplits(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) expenseId: string,
    @Body() dto: UpdateSplitsDto,
  ) {
    return this.service.updateSplits(req.user.id, expenseId, dto);
  }
}

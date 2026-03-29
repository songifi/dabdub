import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FlutterwaveService } from './flutterwave.service';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller({ path: 'admin/flutterwave', version: '1' })
export class FlutterwaveController {
  constructor(private readonly flutterwaveService: FlutterwaveService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Admin: return Flutterwave NGN wallet balance' })
  getBalance() {
    return this.flutterwaveService.getBalance();
  }
}

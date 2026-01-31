import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { StellarService } from './stellar.service';

@Controller('stellar')
export class StellarController {
    constructor(private readonly stellarService: StellarService) { }

    @Post('account')
    async createAccount() {
        return this.stellarService.createAccount();
    }

    @Get('balance/:accountId')
    async getBalance(@Param('accountId') accountId: string) {
        return this.stellarService.getBalance(accountId);
    }

    @Post('payment')
    async makePayment(@Body() body: { secret: string; destination: string; amount: string; asset?: string; memo?: string }) {
        const xdr = await this.stellarService.buildPaymentTransaction(
            body.secret,
            body.destination,
            body.amount,
            body.asset,
            body.memo
        );
        return this.stellarService.submitTransaction(xdr);
    }

    @Post('trustline')
    async addTrustline(@Body() body: { secret: string; asset: string; issuer: string }) {
        return this.stellarService.addTrustline(body.secret, body.asset, body.issuer);
    }

    @Get('history/:accountId')
    async getHistory(@Param('accountId') accountId: string) {
        return this.stellarService.getTransactionHistory(accountId);
    }
}

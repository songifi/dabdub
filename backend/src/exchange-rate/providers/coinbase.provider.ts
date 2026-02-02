import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { RateProvider } from '../interfaces/rate-provider.interface';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class CoinbaseProvider implements RateProvider {
    public readonly name = 'Coinbase';
    private readonly logger = new Logger(CoinbaseProvider.name);

    constructor(private readonly httpService: HttpService) { }

    async getRate(pair: string): Promise<number> {
        try {
            // Assuming pair is something like 'BTC-USD'
            const [base, quote] = pair.split('-');
            const response = await lastValueFrom(
                this.httpService.get(`https://api.coinbase.com/v2/exchange-rates?currency=${base}`)
            );
            const rate = response.data.data.rates[quote];
            if (!rate) {
                throw new Error(`Rate for ${quote} not found in Coinbase response`);
            }
            return parseFloat(rate);
        } catch (error: any) {
            this.logger.error(`Failed to fetch rate from Coinbase for ${pair}: ${error.message}`);
            throw error;
        }
    }
}

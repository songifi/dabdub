import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { RateProvider } from '../interfaces/rate-provider.interface';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class BinanceProvider implements RateProvider {
    public readonly name = 'Binance';
    private readonly logger = new Logger(BinanceProvider.name);

    constructor(private readonly httpService: HttpService) { }

    async getRate(pair: string): Promise<number> {
        try {
            // Mapping BTC-USD to BTCUSDT for Binance usually
            let [base, quote] = pair.split('-');
            if (quote === 'USD') {
                quote = 'USDT';
            }
            const symbol = `${base}${quote}`;

            const response = await lastValueFrom(
                this.httpService.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`)
            );

            return parseFloat(response.data.price);
        } catch (error: any) {
            this.logger.error(`Failed to fetch rate from Binance for ${pair}: ${error.message}`);
            throw error;
        }
    }
}

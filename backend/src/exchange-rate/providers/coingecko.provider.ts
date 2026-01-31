import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { RateProvider } from '../interfaces/rate-provider.interface';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class CoinGeckoProvider implements RateProvider {
    public readonly name = 'CoinGecko';
    private readonly logger = new Logger(CoinGeckoProvider.name);

    private readonly coinMap: Record<string, string> = {
        'BTC': 'bitcoin',
        'ETH': 'ethereum',
        'SOL': 'solana',
        // Add more as needed
    };

    constructor(private readonly httpService: HttpService) { }

    async getRate(pair: string): Promise<number> {
        try {
            const [base, quote] = pair.split('-');
            const coinId = this.coinMap[base];

            if (!coinId) {
                throw new Error(`Coin mapping not found for ${base}`);
            }

            const quoteLower = quote.toLowerCase();

            const response = await lastValueFrom(
                this.httpService.get(`https://api.coingecko.com/api/v3/simple/price`, {
                    params: {
                        ids: coinId,
                        vs_currencies: quoteLower
                    }
                })
            );

            const rate = response.data[coinId]?.[quoteLower];
            if (!rate) {
                throw new Error(`Rate for ${base}-${quote} not found in CoinGecko response`);
            }
            return parseFloat(rate);
        } catch (error: any) {
            this.logger.error(`Failed to fetch rate from CoinGecko for ${pair}: ${error.message}`);
            throw error;
        }
    }
}

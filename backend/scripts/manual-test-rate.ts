import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExchangeRateService } from '../src/exchange-rate/exchange-rate.service';



async function bootstrap() {
    console.log('Bootstrapping application context...');
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });

    try {
        const service = app.get(ExchangeRateService);
        const pair = 'BTC-USD';

        console.log(`Fetching rate for ${pair}...`);
        const rate = await service.getRate(pair);
        console.log('------------------------------------------------');
        console.log(`✅ Success! Current Rate for ${pair}: $${rate}`);
        console.log('------------------------------------------------');

        // Also test conversion
        const amount = 1;
        const converted = await service.convertAmount(amount, 'BTC', 'USD');
        console.log(`1 BTC = $${converted}`);

    } catch (error) {
        console.error('❌ Failed to get rate:', error);
    } finally {
        await app.close();
    }
}

bootstrap();

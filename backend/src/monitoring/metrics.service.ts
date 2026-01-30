import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
    constructor(
        @InjectMetric('payment_success_total') public paymentSuccessTotal: Counter<string>,
        @InjectMetric('payment_amount_total') public paymentAmountTotal: Counter<string>,
        @InjectMetric('active_merchants') public activeMerchants: Gauge<string>,
        @InjectMetric('stellar_transaction_duration') public stellarTransactionDuration: Histogram<string>,
    ) { }

    incrementPaymentSuccess(asset: string) {
        this.paymentSuccessTotal.inc({ asset });
    }

    incrementPaymentAmount(amount: number, asset: string) {
        this.paymentAmountTotal.inc({ asset }, amount);
    }

    setActiveMerchants(count: number) {
        this.activeMerchants.set(count);
    }

    startStellarTransactionTimer() {
        return this.stellarTransactionDuration.startTimer();
    }
}

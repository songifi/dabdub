import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity({ name: 'mv_daily_payment_volume', synchronize: false })
export class DailyPaymentVolume {
  @ViewColumn()
  day: Date;

  @ViewColumn()
  merchantId: string;

  @ViewColumn({ name: 'payment_count' })
  paymentCount: string;

  @ViewColumn({ name: 'volume_usd' })
  volumeUsd: string;
}

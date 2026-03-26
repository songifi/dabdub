import { YieldEntry } from '../entities/yield-entry.entity';

export class YieldHistoryDto {
  items!: YieldEntry[];
  total!: number;
  page!: number;
  limit!: number;
  runningTotalUsdc!: string;
}

import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { AnalyticsService } from './analytics.service';
import { Logger } from '@nestjs/common';

const ANALYTICS_QUEUE = 'analytics';

@Processor(ANALYTICS_QUEUE)
export class AnalyticsProcessor {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Process('update-dashboard-stats')
  async updateDashboardStats(job: Job) {
    this.logger.log('Updating dashboard stats cache...');
    // Just call getDashboardStats - it will compute if miss & cache
    await this.analyticsService.getDashboardStats();
    this.logger.log('Dashboard stats cache updated');
  }
}


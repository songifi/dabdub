import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PaymentRequest } from '../database/entities/payment-request.entity';
import { AlertController } from './alert.controller';
import { AlertEvent } from './entities/alert-event.entity';
import { AlertRule } from './entities/alert-rule.entity';
import { IncidentTimelineEntry } from './entities/incident-timeline-entry.entity';
import { Incident } from './entities/incident.entity';
import { IncidentController } from './incident.controller';
import { AlertEventService } from './services/alert-event.service';
import { AlertRuleService } from './services/alert-rule.service';
import { IncidentService } from './services/incident.service';
import { MetricEvaluatorService } from './services/metric-evaluator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AlertRule,
      AlertEvent,
      Incident,
      IncidentTimelineEntry,
      PaymentRequest,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AlertController, IncidentController],
  providers: [
    AlertRuleService,
    AlertEventService,
    MetricEvaluatorService,
    IncidentService,
  ],
  exports: [AlertRuleService, AlertEventService, IncidentService],
})
export class AlertingModule {}

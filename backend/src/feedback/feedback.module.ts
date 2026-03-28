import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudFlag } from '../fraud/entities/fraud-flag.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { FeedbackController } from './feedback.controller';
import { AdminFeedbackController } from './admin-feedback.controller';
import { FeedbackService } from './feedback.service';
import { Feedback } from './entities/feedback.entity';
import { SupportTicket } from './entities/support-ticket.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Feedback,
      SupportTicket,
      Transaction,
      User,
      FraudFlag,
    ]),
  ],
  providers: [FeedbackService],
  controllers: [FeedbackController, AdminFeedbackController],
  exports: [FeedbackService],
})
export class FeedbackModule {}

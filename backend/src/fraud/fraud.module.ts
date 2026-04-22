import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { FraudFlag } from './entities/fraud-flag.entity';
import { FraudService, FRAUD_QUEUE } from './fraud.service';
import { FraudProcessor } from './fraud.processor';
import { FraudAdminController } from './fraud-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([FraudFlag]),
    BullModule.registerQueue({ name: FRAUD_QUEUE }),
  ],
  providers: [FraudService, FraudProcessor],
  controllers: [FraudAdminController],
  exports: [FraudService],
})
export class FraudModule {}

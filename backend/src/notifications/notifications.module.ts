import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { NotificationsService } from "./notifications.service";
import { EmailProcessor } from "./email.processor";
import { EmailDeliveryLog } from "./entities/email-delivery-log.entity";
import { QueueModule } from "../queue/queue.module";
import { EMAIL_DELIVERY_QUEUE } from "../queue/queue.constants";

@Module({
  imports: [
    QueueModule,
    TypeOrmModule.forFeature([EmailDeliveryLog]),
    BullModule.registerQueue({ name: EMAIL_DELIVERY_QUEUE }),
  ],
  providers: [NotificationsService, EmailProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SettlementCompletedEventDto } from '../stellar/soroban-event.dto';
import { SettlementsService } from './settlements.service';

@Injectable()
export class SettlementsSorobanListener {
  constructor(private readonly settlementsService: SettlementsService) {}

  @OnEvent('soroban.settlement.completed', { async: true })
  async handleSettlementCompleted(event: SettlementCompletedEventDto): Promise<void> {
    await this.settlementsService.applySorobanSettlementCompleted(event);
  }
}

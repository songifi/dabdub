import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
export class LeaderboardGateway implements OnGatewayInit {
  private readonly logger = new Logger(LeaderboardGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit() {
    this.logger.log('LeaderboardGateway initialised');
  }

  emitRankChanged(top10: object[]): void {
    this.server.emit('rank_changed', top10);
  }
}

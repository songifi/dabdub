import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

export interface ChainConfigUpdatedEvent {
  chainId: string;
  changes: Record<string, any>;
  timestamp: Date;
}

export interface TokenAddedEvent {
  tokenId: string;
  chainId: string;
  tokenAddress: string;
  timestamp: Date;
}

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  async publishChainConfigUpdated(
    event: ChainConfigUpdatedEvent,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Publishing chain.config.updated event for ${event.chainId}`,
      );
      this.eventEmitter.emit("chain.config.updated", event);
    } catch (error) {
      this.logger.error(
        `Failed to publish chain config updated event: ${error.message}`,
        error,
      );
    }
  }

  async publishTokenAdded(event: TokenAddedEvent): Promise<void> {
    try {
      this.logger.debug(`Publishing token.added event for ${event.tokenId}`);
      this.eventEmitter.emit("token.added", event);
    } catch (error) {
      this.logger.error(
        `Failed to publish token added event: ${error.message}`,
        error,
      );
    }
  }

  async publishTokenUpdated(
    tokenId: string,
    changes: Record<string, any>,
  ): Promise<void> {
    try {
      this.logger.debug(`Publishing token.updated event for ${tokenId}`);
      this.eventEmitter.emit("token.updated", {
        tokenId,
        changes,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish token updated event: ${error.message}`,
        error,
      );
    }
  }

  async publishTokenDisabled(
    tokenId: string,
    chainId: string,
    symbol: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Publishing token.disabled event for ${tokenId}`);
      this.eventEmitter.emit("token.disabled", {
        tokenId,
        chainId,
        symbol,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish token disabled event: ${error.message}`,
        error,
      );
    }
  }
}

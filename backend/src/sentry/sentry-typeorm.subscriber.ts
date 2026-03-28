import { Injectable } from '@nestjs/common';
import { EventSubscriber, EntitySubscriberInterface } from 'typeorm';
import * as Sentry from '@sentry/nestjs';
import { QueryFailedEvent, QueryStartedEvent, QuerySucceededEvent } from 'typeorm/subscriber';

/**
 * TypeORM event subscriber for Sentry performance monitoring.
 * Captures slow queries and database errors.
 */
@Injectable()
@EventSubscriber()
export class SentryTypeORMSubscriber implements EntitySubscriberInterface {
  private readonly slowQueryThresholdMs = 1000;

  beforeQuery(event: QueryStartedEvent): void {
    // Start a span for this query
    Sentry.startSpan(
      {
        op: 'db.query',
        name: this.getQueryName(event),
        attributes: {
          'db.system': 'postgresql',
          'db.query': event.query,
        },
      },
      () => {
        // Store start time for duration calculation
        (event as QueryStartedEvent & { __sentryStartTime?: number }).__sentryStartTime = Date.now();
      },
    );
  }

  afterQuery(event: QuerySucceededEvent): void {
    const startTime = (event as QueryStartedEvent & { __sentryStartTime?: number }).__sentryStartTime;

    if (startTime) {
      const duration = Date.now() - startTime;

      // Log slow queries
      if (duration > this.slowQueryThresholdMs) {
        Sentry.withScope((scope) => {
          scope.setLevel('warning');
          scope.setExtra('query', event.query);
          scope.setExtra('durationMs', duration);
          scope.setExtra('parameters', event.parameters);
          Sentry.captureMessage(`Slow query detected: ${duration}ms`);
        });
      }
    }
  }

  queryFailed(event: QueryFailedEvent): void {
    // Capture query errors to Sentry
    Sentry.withScope((scope) => {
      scope.setTag('module', 'database');
      scope.setExtra('query', event.query);
      scope.setExtra('parameters', event.parameters);
      scope.setExtra('error', event.error.message);
      Sentry.captureException(event.error);
    });
  }

  /**
   * Extract a readable query name for span identification.
   */
  private getQueryName(event: QueryStartedEvent): string {
    const query = event.query.trim().split(/\s+/)[0].toUpperCase();
    const table = this.extractTableName(event.query);
    return table ? `${query} ${table}` : query;
  }

  /**
   * Extract table name from SQL query.
   */
  private extractTableName(query: string): string | null {
    const patterns = [
      /FROM\s+["']?(\w+)["']?/i,
      /INTO\s+["']?(\w+)["']?/i,
      /UPDATE\s+["']?(\w+)["']?/i,
      /DELETE\s+FROM\s+["']?(\w+)["']?/i,
      /INSERT\s+INTO\s+["']?(\w+)["']?/i,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }
}

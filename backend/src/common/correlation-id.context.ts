import { AsyncLocalStorage } from 'node:async_hooks';

type CorrelationStore = {
  correlationId?: string;
};

const correlationIdStorage = new AsyncLocalStorage<CorrelationStore>();

export function runWithCorrelationId<T>(correlationId: string, callback: () => T): T {
  return correlationIdStorage.run({ correlationId }, callback);
}

export function getCorrelationId(): string | undefined {
  return correlationIdStorage.getStore()?.correlationId;
}

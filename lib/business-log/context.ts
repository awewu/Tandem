import { AsyncLocalStorage } from 'node:async_hooks';

export interface BusinessLogContext {
  requestId: string | null;
  tenantId: string;
  actorId: string;
  actorType: string;
}

const storage = new AsyncLocalStorage<BusinessLogContext>();

export function runWithBusinessLogContext<T>(
  context: BusinessLogContext,
  callback: () => T,
): T {
  return storage.run(context, callback);
}

export function getBusinessLogContext(): BusinessLogContext | undefined {
  return storage.getStore();
}

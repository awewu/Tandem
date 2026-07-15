import type { Repository, TandemStore } from '@/lib/storage/repository';
import { getBusinessLogContext } from './context';
import { redactBusinessLogData, redactErrorMessage } from './redact';
import type { BusinessLogOutcome } from './types';

type Mutation = 'create' | 'update' | 'delete';

const INSTRUMENTED = Symbol('business-log-instrumented');
const ACTION_LABELS: Record<Mutation, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
};

function toObjectType(moduleName: string): string {
  return moduleName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function targetIdFor(
  mutation: Mutation,
  args: unknown[],
  result: unknown,
): string | null {
  if (mutation !== 'create') return typeof args[0] === 'string' ? args[0] : null;
  if (!result || typeof result !== 'object') return null;
  const id = (result as Record<string, unknown>).id;
  return typeof id === 'string' ? id : null;
}

function mutationData(mutation: Mutation, args: unknown[]): Record<string, unknown> | null {
  const value = mutation === 'create' ? args[0] : mutation === 'update' ? args[1] : null;
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function deferRepositoryBusinessLog(input: {
  moduleName: string;
  mutation: Mutation;
  args: unknown[];
  result?: unknown;
  outcome: BusinessLogOutcome;
  error?: unknown;
}): void {
  const context = getBusinessLogContext();
  if (!context) return;

  const objectType = toObjectType(input.moduleName);
  const targetId = targetIdFor(input.mutation, input.args, input.result);
  const changes = mutationData(input.mutation, input.args);
  const changedFields = changes ? Object.keys(changes).filter((key) => key !== 'id').slice(0, 60) : [];
  const error = input.error;
  const details = redactBusinessLogData({
    changedFields,
    changes,
    ...(error ? {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: redactErrorMessage(error instanceof Error ? error.message : String(error)),
    } : {}),
  });

  queueMicrotask(() => {
    void import('./service').then(({ appendBusinessLog }) => appendBusinessLog({
      ...context,
      source: 'repository',
      category: objectType.split('_')[0] || 'system',
      operation: `${objectType}.${input.mutation}`,
      action: input.mutation,
      targetType: objectType,
      targetId,
      outcome: input.outcome,
      level: input.outcome === 'success' ? 'info' : 'error',
      summary: `${ACTION_LABELS[input.mutation]} ${objectType}${targetId ? ` ${targetId}` : ''}${input.outcome === 'success' ? '' : '失败'}`,
      details,
    })).catch(() => undefined);
  });
}

function isRepository(value: unknown): value is Repository<{ id: string }> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return ['get', 'list', 'create', 'update', 'delete'].every((key) => typeof candidate[key] === 'function');
}

export function instrumentBusinessRepositories(store: TandemStore): TandemStore {
  for (const [moduleName, value] of Object.entries(store)) {
    if (!isRepository(value)) continue;
    const repository = value as Repository<{ id: string }> & { [INSTRUMENTED]?: boolean };
    if (repository[INSTRUMENTED]) continue;

    for (const mutation of ['create', 'update', 'delete'] as const) {
      const original = repository[mutation].bind(repository) as (...args: unknown[]) => Promise<unknown>;
      Object.assign(repository, {
        [mutation]: async (...args: unknown[]) => {
          try {
            const result = await original(...args);
            deferRepositoryBusinessLog({ moduleName, mutation, args, result, outcome: 'success' });
            return result;
          } catch (error) {
            deferRepositoryBusinessLog({ moduleName, mutation, args, outcome: 'error', error });
            throw error;
          }
        },
      });
    }
    repository[INSTRUMENTED] = true;
  }
  return store;
}

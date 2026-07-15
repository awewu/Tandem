export type BusinessLogOutcome = 'success' | 'failure' | 'denied' | 'error';
export type BusinessLogLevel = 'info' | 'warn' | 'error';

export interface BusinessLogInput {
  id?: string;
  requestId?: string | null;
  tenantId?: string;
  actorId?: string;
  actorType?: string;
  source?: 'audit' | 'repository' | 'domain' | string;
  category?: string;
  operation: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  outcome: BusinessLogOutcome;
  level?: BusinessLogLevel;
  summary: string;
  details?: Record<string, unknown> | null;
  createdAt?: Date | string;
}

export interface BusinessLogEntry {
  id: string;
  requestId: string | null;
  tenantId: string;
  actorId: string;
  actorType: string;
  source: string;
  category: string;
  operation: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  outcome: BusinessLogOutcome;
  level: BusinessLogLevel;
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface BusinessLogQuery {
  tenantId: string;
  actorId?: string;
  requestId?: string;
  source?: string;
  category?: string;
  operation?: string;
  action?: string;
  outcome?: BusinessLogOutcome;
  targetType?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface BusinessLogQueryResult {
  entries: BusinessLogEntry[];
  hasMore: boolean;
  limit: number;
  offset: number;
}

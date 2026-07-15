export type ApiLogOutcome = 'success' | 'failure' | 'denied' | 'error';
export type ApiLogLevel = 'info' | 'warn' | 'error';

export interface ApiLogInput {
  id?: string;
  requestId?: string | null;
  tenantId?: string;
  actorId?: string;
  actorType?: string;
  source?: 'api' | 'middleware' | 'edge' | string;
  category?: string;
  operation: string;
  action: string;
  method: string;
  path: string;
  route?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  statusCode: number;
  outcome: ApiLogOutcome;
  level?: ApiLogLevel;
  durationMs?: number | null;
  summary: string;
  requestData?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  createdAt?: Date | string;
}

export interface ApiLogEntry extends Required<Omit<ApiLogInput,
  'id' | 'requestId' | 'route' | 'targetType' | 'targetId' | 'durationMs' |
  'requestData' | 'details' | 'createdAt'
>> {
  id: string;
  requestId: string | null;
  route: string | null;
  targetType: string | null;
  targetId: string | null;
  durationMs: number | null;
  requestData: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface ApiLogQuery {
  tenantId: string;
  actorId?: string;
  requestId?: string;
  source?: string;
  category?: string;
  method?: string;
  route?: string;
  outcome?: ApiLogOutcome;
  statusCode?: number;
  from?: Date;
  to?: Date;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface ApiLogQueryResult {
  entries: ApiLogEntry[];
  hasMore: boolean;
  limit: number;
  offset: number;
}

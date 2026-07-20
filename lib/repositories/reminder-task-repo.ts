import type { ReminderTask, ReminderTaskStatus } from '@/lib/types/reminder';

export interface ReminderTaskRepository {
  create(draft: Omit<ReminderTask, 'id'> & { id?: string }): Promise<ReminderTask>;
  update(id: string, patch: Partial<Omit<ReminderTask, 'id' | 'createdAt'>>): Promise<ReminderTask>;
  findById(id: string): Promise<ReminderTask | null>;
  findByDedupeKey(tenantId: string, dedupeKey: string): Promise<ReminderTask | null>;
  list(filter?: {
    tenantId?: string;
    userId?: string;
    sourceType?: string;
    sourceId?: string;
    status?: ReminderTaskStatus;
  }): Promise<ReminderTask[]>;
  listDue(nowIso: string, filter?: { tenantId?: string; userId?: string; limit?: number; maxRetryCount?: number }): Promise<ReminderTask[]>;
  claimDue(nowIso: string, filter?: { tenantId?: string; userId?: string; limit?: number; maxRetryCount?: number }): Promise<ReminderTask[]>;
  cancelBySource(tenantId: string, sourceType: string, sourceId: string): Promise<number>;
}

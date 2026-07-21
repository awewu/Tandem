import type { ReminderTask, ReminderTaskStatus } from '@/lib/types/reminder';
import type { ReminderTaskRepository } from './reminder-task-repo';

let nextId = 0;

export class InMemoryReminderTaskRepository implements ReminderTaskRepository {
  private data = new Map<string, ReminderTask>();

  async create(draft: Omit<ReminderTask, 'id'> & { id?: string }): Promise<ReminderTask> {
    const task = { ...draft, id: draft.id ?? `reminder_task_${++nextId}` };
    this.data.set(task.id, task);
    return task;
  }

  async update(id: string, patch: Partial<Omit<ReminderTask, 'id' | 'createdAt'>>): Promise<ReminderTask> {
    const current = this.data.get(id);
    if (!current) throw new Error(`ReminderTask ${id} not found`);
    const next = { ...current, ...patch };
    this.data.set(id, next);
    return next;
  }

  async findById(id: string): Promise<ReminderTask | null> {
    return this.data.get(id) ?? null;
  }

  async findByDedupeKey(tenantId: string, dedupeKey: string): Promise<ReminderTask | null> {
    return Array.from(this.data.values()).find((task) => task.tenantId === tenantId && task.dedupeKey === dedupeKey) ?? null;
  }

  async list(filter?: {
    tenantId?: string;
    userId?: string;
    sourceType?: string;
    sourceId?: string;
    status?: ReminderTaskStatus;
  }): Promise<ReminderTask[]> {
    return Array.from(this.data.values()).filter((task) => (
      (!filter?.tenantId || task.tenantId === filter.tenantId) &&
      (!filter?.userId || task.userId === filter.userId) &&
      (!filter?.sourceType || task.sourceType === filter.sourceType) &&
      (!filter?.sourceId || task.sourceId === filter.sourceId) &&
      (!filter?.status || task.status === filter.status)
    ));
  }

  async listDue(nowIso: string, filter?: { tenantId?: string; userId?: string; limit?: number; maxRetryCount?: number }): Promise<ReminderTask[]> {
    const maxRetryCount = filter?.maxRetryCount ?? 3;
    const due = Array.from(this.data.values())
      .filter((task) => (
        (task.status === 'pending' || (task.status === 'failed' && task.retryCount < maxRetryCount)) &&
        task.remindAt <= nowIso &&
        (!filter?.tenantId || task.tenantId === filter.tenantId) &&
        (!filter?.userId || task.userId === filter.userId)
      ))
      .sort((a, b) => a.remindAt.localeCompare(b.remindAt));
    return typeof filter?.limit === 'number' ? due.slice(0, filter.limit) : due;
  }

  async claimDue(nowIso: string, filter?: { tenantId?: string; userId?: string; limit?: number; maxRetryCount?: number }): Promise<ReminderTask[]> {
    const maxRetryCount = filter?.maxRetryCount ?? 3;
    const due = Array.from(this.data.values())
      .filter((task) => (
        (task.status === 'pending' || (task.status === 'failed' && task.retryCount < maxRetryCount)) &&
        task.remindAt <= nowIso &&
        (!filter?.tenantId || task.tenantId === filter.tenantId) &&
        (!filter?.userId || task.userId === filter.userId)
      ))
      .sort((a, b) => a.remindAt.localeCompare(b.remindAt));
    const claimedTasks = typeof filter?.limit === 'number' ? due.slice(0, filter.limit) : due;
    const processingAt = new Date().toISOString();
    return claimedTasks.map((task) => {
      const claimed = { ...task, status: 'processing' as const, processingAt, updatedAt: processingAt };
      this.data.set(task.id, claimed);
      return claimed;
    });
  }

  async cancelBySource(tenantId: string, sourceType: string, sourceId: string): Promise<number> {
    let count = 0;
    const nowIso = new Date().toISOString();
    for (const task of Array.from(this.data.values())) {
      if (task.tenantId === tenantId && task.sourceType === sourceType && task.sourceId === sourceId && ['pending', 'processing', 'failed'].includes(task.status)) {
        this.data.set(task.id, { ...task, status: 'cancelled', updatedAt: nowIso });
        count += 1;
      }
    }
    return count;
  }
}

import type { LaunchpadRepository, LaunchpadAppFilter } from './launchpad-repo';
import type { LaunchpadApp, LaunchpadClick, LaunchpadStats } from '@/lib/types/launchpad';

let _appSeq = 0;
let _clickSeq = 0;
const newAppId = () => `lpa_${++_appSeq}_${Date.now().toString(36)}`;
const newClickId = () => `lpc_${++_clickSeq}_${Date.now().toString(36)}`;

export class InMemoryLaunchpadRepository implements LaunchpadRepository {
  private apps = new Map<string, LaunchpadApp>();
  private clicks: LaunchpadClick[] = [];

  async findAppById(id: string): Promise<LaunchpadApp | null> {
    return this.apps.get(id) ?? null;
  }

  async listApps(filter?: LaunchpadAppFilter): Promise<LaunchpadApp[]> {
    let arr = Array.from(this.apps.values());
    if (filter?.tenantId) arr = arr.filter((a) => a.tenantId === filter.tenantId);
    if (filter?.category) arr = arr.filter((a) => a.category === filter.category);
    if (filter?.status && filter.status !== 'any') arr = arr.filter((a) => a.status === filter.status);
    return arr.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }

  async createApp(draft: Omit<LaunchpadApp, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<LaunchpadApp> {
    const now = new Date().toISOString();
    const app: LaunchpadApp = { ...(draft as LaunchpadApp), id: draft.id ?? newAppId(), createdAt: now, updatedAt: now };
    this.apps.set(app.id, app);
    return app;
  }

  async updateApp(id: string, patch: Partial<Omit<LaunchpadApp, 'id' | 'createdAt'>>): Promise<LaunchpadApp> {
    const cur = this.apps.get(id);
    if (!cur) throw new Error(`launchpad app not found: ${id}`);
    const next: LaunchpadApp = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    this.apps.set(id, next);
    return next;
  }

  async deleteApp(id: string): Promise<void> {
    this.apps.delete(id);
  }

  async reorderApps(orderMap: Array<{ id: string; order: number }>): Promise<void> {
    for (const { id, order } of orderMap) {
      const cur = this.apps.get(id);
      if (cur) this.apps.set(id, { ...cur, order, updatedAt: new Date().toISOString() });
    }
  }

  async recordClick(click: Omit<LaunchpadClick, 'id' | 'clickedAt'> & { id?: string; clickedAt?: string }): Promise<LaunchpadClick> {
    const c: LaunchpadClick = {
      ...(click as LaunchpadClick),
      id: click.id ?? newClickId(),
      clickedAt: click.clickedAt ?? new Date().toISOString(),
    };
    this.clicks.push(c);
    return c;
  }

  async statsByApp(appId: string): Promise<LaunchpadStats> {
    const all = this.clicks.filter((c) => c.appId === appId);
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return {
      appId,
      totalClicks: all.length,
      uniqueUsers: new Set(all.map((c) => c.userId)).size,
      last7DaysClicks: all.filter((c) => new Date(c.clickedAt).getTime() >= sevenDaysAgo).length,
    };
  }

  async statsAll(tenantId?: string): Promise<LaunchpadStats[]> {
    const apps = await this.listApps(tenantId ? { tenantId, status: 'any' } : { status: 'any' });
    return Promise.all(apps.map((a) => this.statsByApp(a.id)));
  }
}

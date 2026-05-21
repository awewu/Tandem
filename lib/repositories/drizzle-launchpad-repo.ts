import { eq, and, desc, gte, count, countDistinct, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/infra/drizzle-client';
import type { LaunchpadRepository, LaunchpadAppFilter } from './launchpad-repo';
import type {
  LaunchpadApp,
  LaunchpadClick,
  LaunchpadStats,
  LaunchpadCategory,
  SsoMode,
  LaunchpadStatus,
  UnreadAdapterConfig,
} from '@/lib/types/launchpad';

const apps = schema.launchpadApp;
const clicks = schema.launchpadClick;

function cuid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function toAppDomain(row: typeof apps.$inferSelect): LaunchpadApp {
  return {
    id: row.id,
    category: row.category as LaunchpadCategory,
    name: row.name,
    description: row.description,
    iconUrl: row.iconUrl,
    url: row.url,
    ssoMode: row.ssoMode as SsoMode,
    ssoConfig: row.ssoConfig as Record<string, unknown> | null,
    visibleTo: row.visibleTo,
    visibleToRoles: row.visibleToRoles,
    order: row.order,
    recommendKeywords: row.recommendKeywords,
    unreadAdapter: row.unreadAdapter as UnreadAdapterConfig | null,
    status: row.status as LaunchpadStatus,
    tenantId: row.tenantId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toClickDomain(row: typeof clicks.$inferSelect): LaunchpadClick {
  return {
    id: row.id,
    appId: row.appId,
    userId: row.userId,
    clickedAt: row.clickedAt.toISOString(),
    source: row.source,
    tenantId: row.tenantId,
  };
}

export class DrizzleLaunchpadRepository implements LaunchpadRepository {
  async findAppById(id: string): Promise<LaunchpadApp | null> {
    const rows = await db.select().from(apps).where(eq(apps.id, id)).limit(1);
    return rows[0] ? toAppDomain(rows[0]) : null;
  }

  async listApps(filter?: LaunchpadAppFilter): Promise<LaunchpadApp[]> {
    const conds = [];
    if (filter?.tenantId) conds.push(eq(apps.tenantId, filter.tenantId));
    if (filter?.category) conds.push(eq(apps.category, filter.category));
    if (filter?.status && filter.status !== 'any') conds.push(eq(apps.status, filter.status));
    const q = conds.length
      ? db.select().from(apps).where(and(...conds))
      : db.select().from(apps);
    const rows = await q.orderBy(apps.order, apps.name);
    return rows.map(toAppDomain);
  }

  async createApp(draft: Omit<LaunchpadApp, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<LaunchpadApp> {
    const now = new Date();
    const row = {
      id: draft.id ?? cuid('lpa'),
      category: draft.category,
      name: draft.name,
      description: draft.description ?? null,
      iconUrl: draft.iconUrl ?? null,
      url: draft.url,
      ssoMode: draft.ssoMode ?? 'none',
      ssoConfig: (draft.ssoConfig ?? null) as object | null,
      visibleTo: draft.visibleTo ?? [],
      visibleToRoles: draft.visibleToRoles ?? [],
      order: draft.order ?? 0,
      recommendKeywords: draft.recommendKeywords ?? [],
      unreadAdapter: (draft.unreadAdapter ?? null) as object | null,
      status: draft.status ?? 'active',
      tenantId: draft.tenantId ?? 'default',
      createdAt: now,
      updatedAt: now,
    };
    const [inserted] = await db.insert(apps).values(row).returning();
    return toAppDomain(inserted);
  }

  async updateApp(id: string, patch: Partial<Omit<LaunchpadApp, 'id' | 'createdAt'>>): Promise<LaunchpadApp> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of Object.keys(patch) as Array<keyof typeof patch>) {
      if (patch[k] !== undefined) set[k] = patch[k];
    }
    const [row] = await db.update(apps).set(set).where(eq(apps.id, id)).returning();
    if (!row) throw new Error(`launchpad app not found: ${id}`);
    return toAppDomain(row);
  }

  async deleteApp(id: string): Promise<void> {
    await db.delete(apps).where(eq(apps.id, id));
  }

  async reorderApps(orderMap: Array<{ id: string; order: number }>): Promise<void> {
    if (orderMap.length === 0) return;
    await db.transaction(async (tx) => {
      for (const { id, order } of orderMap) {
        await tx.update(apps).set({ order, updatedAt: new Date() }).where(eq(apps.id, id));
      }
    });
  }

  async recordClick(click: Omit<LaunchpadClick, 'id' | 'clickedAt'> & { id?: string; clickedAt?: string }): Promise<LaunchpadClick> {
    const row = {
      id: click.id ?? cuid('lpc'),
      appId: click.appId,
      userId: click.userId,
      clickedAt: click.clickedAt ? new Date(click.clickedAt) : new Date(),
      source: click.source ?? 'home',
      tenantId: click.tenantId ?? 'default',
    };
    const [inserted] = await db.insert(clicks).values(row).returning();
    return toClickDomain(inserted);
  }

  async statsByApp(appId: string): Promise<LaunchpadStats> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [agg] = await db
      .select({
        total: count(),
        uniq: countDistinct(clicks.userId),
      })
      .from(clicks)
      .where(eq(clicks.appId, appId));
    const [recent] = await db
      .select({ c: count() })
      .from(clicks)
      .where(and(eq(clicks.appId, appId), gte(clicks.clickedAt, sevenDaysAgo)));
    return {
      appId,
      totalClicks: Number(agg?.total ?? 0),
      uniqueUsers: Number(agg?.uniq ?? 0),
      last7DaysClicks: Number(recent?.c ?? 0),
    };
  }

  async statsAll(tenantId?: string): Promise<LaunchpadStats[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const tenantFilter = tenantId ? eq(clicks.tenantId, tenantId) : sql`true`;
    const totals = await db
      .select({
        appId: clicks.appId,
        total: count(),
        uniq: countDistinct(clicks.userId),
      })
      .from(clicks)
      .where(tenantFilter)
      .groupBy(clicks.appId);
    const recents = await db
      .select({ appId: clicks.appId, c: count() })
      .from(clicks)
      .where(and(tenantFilter, gte(clicks.clickedAt, sevenDaysAgo)))
      .groupBy(clicks.appId);
    const recentMap = new Map(recents.map((r) => [r.appId, Number(r.c)]));
    return totals.map((row) => ({
      appId: row.appId,
      totalClicks: Number(row.total),
      uniqueUsers: Number(row.uniq),
      last7DaysClicks: recentMap.get(row.appId) ?? 0,
    }));
  }
}

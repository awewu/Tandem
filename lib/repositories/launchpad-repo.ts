import type { LaunchpadApp, LaunchpadClick, LaunchpadStats } from '@/lib/types/launchpad';

export interface LaunchpadAppFilter {
  category?: string;
  status?: 'active' | 'disabled' | 'any';
  tenantId?: string;
}

export interface LaunchpadRepository {
  // Apps
  findAppById(id: string): Promise<LaunchpadApp | null>;
  listApps(filter?: LaunchpadAppFilter): Promise<LaunchpadApp[]>;
  createApp(draft: Omit<LaunchpadApp, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<LaunchpadApp>;
  updateApp(id: string, patch: Partial<Omit<LaunchpadApp, 'id' | 'createdAt'>>): Promise<LaunchpadApp>;
  deleteApp(id: string): Promise<void>;
  reorderApps(orderMap: Array<{ id: string; order: number }>): Promise<void>;

  // Clicks
  recordClick(click: Omit<LaunchpadClick, 'id' | 'clickedAt'> & { id?: string; clickedAt?: string }): Promise<LaunchpadClick>;
  statsByApp(appId: string): Promise<LaunchpadStats>;
  statsAll(tenantId?: string): Promise<LaunchpadStats[]>;
}

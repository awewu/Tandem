import { getStore } from '@/lib/storage/repository';
import {
  DEFAULT_MOBILE_BOTTOM_NAV,
  DEFAULT_MOBILE_DASHBOARD_CARDS,
  DEFAULT_MOBILE_ENABLED_FEATURES,
  MOBILE_FEATURE_KEYS,
  type MobileFeatureConfig,
  type MobileFeatureKey,
} from '@/lib/types/mobile-features';

const FEATURE_SET = new Set<string>(MOBILE_FEATURE_KEYS);

export function normalizeMobileFeatureKeys(values: unknown): MobileFeatureKey[] {
  if (!Array.isArray(values)) return [];
  const out: MobileFeatureKey[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    if (!FEATURE_SET.has(value)) continue;
    if (!out.includes(value as MobileFeatureKey)) out.push(value as MobileFeatureKey);
  }
  return out;
}

export function defaultMobileFeatureConfig(tenantId: string): MobileFeatureConfig {
  const now = new Date().toISOString();
  return {
    id: `mfc_${tenantId}`,
    tenantId,
    enabledFeatures: [...DEFAULT_MOBILE_ENABLED_FEATURES],
    bottomNav: [...DEFAULT_MOBILE_BOTTOM_NAV],
    dashboardCards: [...DEFAULT_MOBILE_DASHBOARD_CARDS],
    updatedBy: 'system',
    createdAt: now,
    updatedAt: now,
  };
}

export async function getMobileFeatureConfig(tenantId: string): Promise<MobileFeatureConfig> {
  const store = getStore();
  const all = await store.mobileFeatureConfigs.list({ tenantId } as Partial<MobileFeatureConfig>);
  const existing = all.find((item) => item.tenantId === tenantId);
  if (!existing) return defaultMobileFeatureConfig(tenantId);

  const enabled = normalizeMobileFeatureKeys(existing.enabledFeatures);
  const enabledSet = new Set(enabled);
  const bottomNav = normalizeMobileFeatureKeys(existing.bottomNav).filter((key) => enabledSet.has(key));
  const dashboardCards = normalizeMobileFeatureKeys(existing.dashboardCards).filter((key) => enabledSet.has(key));

  return {
    ...existing,
    enabledFeatures: enabled,
    bottomNav: bottomNav.length > 0 ? bottomNav : DEFAULT_MOBILE_BOTTOM_NAV.filter((key) => enabledSet.has(key)),
    dashboardCards:
      dashboardCards.length > 0
        ? dashboardCards
        : DEFAULT_MOBILE_DASHBOARD_CARDS.filter((key) => enabledSet.has(key)),
  };
}

export async function upsertMobileFeatureConfig(
  tenantId: string,
  patch: {
    enabledFeatures?: unknown;
    bottomNav?: unknown;
    dashboardCards?: unknown;
  },
  updatedBy: string,
): Promise<MobileFeatureConfig> {
  const store = getStore();
  const current = await getMobileFeatureConfig(tenantId);
  const now = new Date().toISOString();

  const enabled =
    patch.enabledFeatures !== undefined
      ? normalizeMobileFeatureKeys(patch.enabledFeatures)
      : current.enabledFeatures;
  const enabledSet = new Set(enabled);
  const bottomNav =
    patch.bottomNav !== undefined
      ? normalizeMobileFeatureKeys(patch.bottomNav).filter((key) => enabledSet.has(key))
      : current.bottomNav.filter((key) => enabledSet.has(key));
  const dashboardCards =
    patch.dashboardCards !== undefined
      ? normalizeMobileFeatureKeys(patch.dashboardCards).filter((key) => enabledSet.has(key))
      : current.dashboardCards.filter((key) => enabledSet.has(key));

  const next = {
    tenantId,
    enabledFeatures: enabled,
    bottomNav,
    dashboardCards,
    updatedBy,
    updatedAt: now,
  };

  const existing = await store.mobileFeatureConfigs.get(current.id);
  if (existing) {
    return store.mobileFeatureConfigs.update(current.id, next);
  }

  return store.mobileFeatureConfigs.create({
    id: `mfc_${tenantId}_${Date.now().toString(36)}`,
    ...next,
    createdAt: now,
  });
}

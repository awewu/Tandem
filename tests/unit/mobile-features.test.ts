import { beforeEach, describe, expect, it } from 'vitest';
import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  defaultMobileFeatureConfig,
  getMobileFeatureConfig,
  normalizeMobileFeatureKeys,
  upsertMobileFeatureConfig,
} from '@/lib/settings/mobile-features';

describe('mobile feature config', () => {
  beforeEach(() => {
    setStore(createInMemoryStore());
  });

  it('returns the accepted mobile baseline by default', () => {
    const config = defaultMobileFeatureConfig('default');

    expect(config.enabledFeatures).toEqual([
      'home_dashboard',
      'central_ai',
      'shouchao',
      'mail',
      'calendar',
      'daily_report',
      'naba',
    ]);
    expect(config.bottomNav).toEqual([
      'home_dashboard',
      'shouchao',
      'daily_report',
      'calendar',
      'naba',
    ]);
    expect(config.dashboardCards).toContain('mail');
  });

  it('filters unknown feature keys and removes duplicates', () => {
    expect(normalizeMobileFeatureKeys(['mail', 'nope', 'mail', 'calendar', 1])).toEqual([
      'mail',
      'calendar',
    ]);
  });

  it('persists admin selections and prunes disabled nav/card entries', async () => {
    await upsertMobileFeatureConfig(
      'default',
      {
        enabledFeatures: ['home_dashboard', 'central_ai', 'mail'],
        bottomNav: ['home_dashboard', 'mail', 'calendar'],
        dashboardCards: ['mail', 'naba', 'central_ai'],
      },
      'admin-user',
    );

    const config = await getMobileFeatureConfig('default');
    expect(config.enabledFeatures).toEqual(['home_dashboard', 'central_ai', 'mail']);
    expect(config.bottomNav).toEqual(['home_dashboard', 'mail']);
    expect(config.dashboardCards).toEqual(['mail', 'central_ai']);
    expect(config.updatedBy).toBe('admin-user');
  });

  it('allows admins to disable every mobile feature', async () => {
    await upsertMobileFeatureConfig(
      'default',
      {
        enabledFeatures: [],
        bottomNav: ['home_dashboard'],
        dashboardCards: ['mail'],
      },
      'admin-user',
    );

    const config = await getMobileFeatureConfig('default');
    expect(config.enabledFeatures).toEqual([]);
    expect(config.bottomNav).toEqual([]);
    expect(config.dashboardCards).toEqual([]);
  });
});


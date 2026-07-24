import { describe, it, expect } from 'vitest';
import {
  campaignProgress,
  isCampaignActive,
} from '@/lib/pms/campaign-service';

describe('PMS campaign · campaignProgress', () => {
  it('进度 (%) 保留一位', () => {
    expect(campaignProgress(50, 100)).toBe(50);
    expect(campaignProgress(150, 100)).toBe(150);
    expect(campaignProgress(1, 3)).toBe(33.3);
  });
  it('target<=0 → 0', () => {
    expect(campaignProgress(50, 0)).toBe(0);
  });
});

describe('PMS campaign · isCampaignActive', () => {
  const now = new Date('2026-06-15T12:00:00Z');
  it('周期内 → true', () => {
    expect(isCampaignActive('2026-06-01', '2026-06-30', now)).toBe(true);
  });
  it('周期外 → false', () => {
    expect(isCampaignActive('2026-07-01', '2026-07-31', now)).toBe(false);
    expect(isCampaignActive('2026-05-01', '2026-05-31', now)).toBe(false);
  });
  it('非法日期 → false', () => {
    expect(isCampaignActive('bad', '2026-06-30', now)).toBe(false);
  });
});

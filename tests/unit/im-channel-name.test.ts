import { describe, expect, it } from 'vitest';
import { getDmPeerId, normalizeOrgChannelName } from '@/lib/im/channel-name';

describe('IM channel name helpers', () => {
  it('does not guess a DM peer before the current user is loaded', () => {
    expect(getDmPeerId({ memberIds: ['user-a', 'user-b'] }, '')).toBeNull();
    expect(getDmPeerId({ memberIds: ['user-a', 'user-b'] }, null)).toBeNull();
  });

  it('returns the other DM member for the loaded current user', () => {
    expect(getDmPeerId({ memberIds: ['user-a', 'user-b'] }, 'user-a')).toBe('user-b');
  });

  it('normalizes organization group suffixes', () => {
    expect(normalizeOrgChannelName('销售部 部门群')).toBe('销售部');
  });
});

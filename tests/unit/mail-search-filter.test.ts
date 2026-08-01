import { describe, expect, it } from 'vitest';
import {
  emailMatchesSearch,
  mergeMailSearchResults,
  normalizeMailSearchQuery,
} from '@/lib/mail/search-filter';

describe('mail search filter', () => {
  it('matches Chinese keywords in subject', () => {
    const query = normalizeMailSearchQuery(' 日程 ');
    expect(emailMatchesSearch({
      uid: 1,
      subject: '网易邮箱日程提醒',
      from: [{ address: 'notice@example.com' }],
    }, query)).toBe(true);
  });

  it('matches resolved display names and addresses', () => {
    const query = normalizeMailSearchQuery('平艳');
    expect(emailMatchesSearch({
      uid: 2,
      subject: '会议纪要',
      from: [{ address: 'pingyan@rhenext.com' }],
    }, query, (address) => address === 'pingyan@rhenext.com' ? '平艳' : undefined)).toBe(true);
  });

  it('merges remote and local results without duplicates', () => {
    expect(mergeMailSearchResults(
      [{ uid: 2, subject: 'remote' }],
      [{ uid: 1, subject: 'local' }, { uid: 2, subject: 'duplicate' }],
    )).toEqual([
      { uid: 2, subject: 'remote' },
      { uid: 1, subject: 'local' },
    ]);
  });
});

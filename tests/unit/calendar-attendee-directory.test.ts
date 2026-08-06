import { describe, expect, it } from 'vitest';
import { matchesCalendarAttendeeQuery, shouldSearchCalendarAttendeesInline } from '@/lib/calendar/attendee-directory';

describe('calendar attendee directory search', () => {
  it('matches Chinese names directly instead of only matching email text', () => {
    const user = {
      id: 'user-1',
      name: '伍旭涛',
      email: 'wxt@example.com',
      disabled: false,
    };

    expect(matchesCalendarAttendeeQuery(user, '伍')).toBe(true);
    expect(matchesCalendarAttendeeQuery(user, '伍旭涛')).toBe(true);
    expect(matchesCalendarAttendeeQuery(user, 'wxt')).toBe(true);
    expect(matchesCalendarAttendeeQuery(user, '张三')).toBe(false);
  });

  it('starts inline search for a single Chinese character but keeps ASCII search at two characters', () => {
    expect(shouldSearchCalendarAttendeesInline('伍')).toBe(true);
    expect(shouldSearchCalendarAttendeesInline('w')).toBe(false);
    expect(shouldSearchCalendarAttendeesInline('wx')).toBe(true);
  });
});

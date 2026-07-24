import { describe, expect, it } from 'vitest';
import { parseICalendarEvents, NeteaseCalDavClient } from '@/lib/integrations/netease-caldav';
import { syncNeteaseCalDavCalendar } from '@/lib/calendar/netease-caldav-sync';
import { InMemoryCalendarEventRepository } from '@/lib/repositories/memory-calendar-repo';
import type { NeteaseCalendarEvent } from '@/lib/integrations/netease-calendar';

const ics = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:event-1',
  'SUMMARY:CalDAV同步会',
  'DESCRIPTION:来自网易企业邮箱 CalDAV',
  'DTSTART;TZID=Asia/Shanghai:20260722T200000',
  'DTEND;TZID=Asia/Shanghai:20260722T210000',
  'LOCATION:A会议室',
  'ATTENDEE:mailto:colleague@example.com',
  'STATUS:CONFIRMED',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const july25Ics = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:event-725',
  'SUMMARY:研发会议',
  'DTSTART;TZID=Asia/Shanghai:20260725T090000',
  'DTEND;TZID=Asia/Shanghai:20260725T160000',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const neteaseLooseIcs = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:event-loose',
  'SUMMARY:研发会议',
  'DTSTART;TZID="China Standard Time":20260725T0900',
  'DURATION:PT7H',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

function multistatus(body: string): Response {
  return new Response(body, { status: 207, headers: { 'Content-Type': 'application/xml' } });
}

describe('Netease CalDAV calendar sync', () => {
  it('parses VEVENT time and metadata from iCalendar', () => {
    const events = parseICalendarEvents(ics, {
      calendarHref: '/calendars/user/default/',
      calendarName: '个人日历',
      resourceHref: '/calendars/user/default/event-1.ics',
    });

    expect(events[0]).toMatchObject({
      title: 'CalDAV同步会',
      startAt: '2026-07-22T12:00:00.000Z',
      endAt: '2026-07-22T13:00:00.000Z',
      timezone: 'Asia/Shanghai',
      location: 'A会议室',
      attendeeEmails: ['colleague@example.com'],
      status: 'confirmed',
    });
  });

  it('parses NetEase-style VEVENT without DTEND and with quoted timezone', () => {
    const events = parseICalendarEvents(neteaseLooseIcs, {
      calendarHref: '/caldav/owner/default/',
      calendarName: '我的日历',
      resourceHref: '/caldav/owner/default/event-loose.ics',
    });

    expect(events[0]).toMatchObject({
      title: '研发会议',
      startAt: '2026-07-25T01:00:00.000Z',
      endAt: '2026-07-25T08:00:00.000Z',
      timezone: 'China Standard Time',
    });
  });

  it('discovers calendar collections and imports events', async () => {
    const requests: Array<{ url: string; method: string }> = [];
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      requests.push({ url: String(url), method: init?.method ?? 'GET' });
      const body = String(init?.body ?? '');
      if (body.includes('current-user-principal')) {
        return multistatus('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/principals/owner/</d:href></d:current-user-principal></d:prop></d:propstat></d:response></d:multistatus>');
      }
      if (body.includes('calendar-home-set')) {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/principals/owner/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>/calendars/owner/</d:href></c:calendar-home-set></d:prop></d:propstat></d:response></d:multistatus>');
      }
      if (init?.method === 'PROPFIND') {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/calendars/owner/default/</d:href><d:displayname>个人日历</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:response></d:multistatus>');
      }
      return multistatus(`<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/calendars/owner/default/event-1.ics</d:href><c:calendar-data>${ics}</c:calendar-data></d:response></d:multistatus>`);
    };
    const client = new NeteaseCalDavClient(
      { account: 'owner@example.com', password: 'secret', serverUrl: 'https://caldav.qiye.163.com/' },
      { fetch: fetchImpl as typeof fetch },
    );

    const events = await client.listEvents({
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(events).toHaveLength(1);
    expect(events[0].externalId).toContain('netease-caldav:');
    expect(requests.map((request) => request.method)).toEqual(['PROPFIND', 'PROPFIND', 'PROPFIND', 'REPORT']);
  });

  it('uses nested hrefs from current-user-principal and calendar-home-set props', async () => {
    const requests: Array<{ url: string; method: string }> = [];
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      requests.push({ url: String(url), method: init?.method ?? 'GET' });
      const body = String(init?.body ?? '');
      if (body.includes('current-user-principal')) {
        return multistatus('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/principals/users/owner@example.com/</d:href></d:current-user-principal></d:prop></d:propstat></d:response></d:multistatus>');
      }
      if (body.includes('calendar-home-set')) {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/principals/users/owner@example.com/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>/caldav/owner@example.com/</d:href></c:calendar-home-set></d:prop></d:propstat></d:response></d:multistatus>');
      }
      if (String(url).endsWith('/caldav/owner@example.com/') && init?.method === 'PROPFIND') {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/caldav/owner@example.com/default/</d:href><d:displayname>个人日历</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:response></d:multistatus>');
      }
      return multistatus(`<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/caldav/owner@example.com/default/event-1.ics</d:href><c:calendar-data>${ics}</c:calendar-data></d:response></d:multistatus>`);
    };
    const client = new NeteaseCalDavClient(
      { account: 'owner@example.com', password: 'secret', serverUrl: 'https://caldav.qiye.163.com/' },
      { fetch: fetchImpl as typeof fetch },
    );

    const events = await client.listEvents({
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(events).toHaveLength(1);
    expect(requests.map((request) => request.url)).toContain('https://caldav.qiye.163.com/principals/users/owner@example.com/');
    expect(requests.map((request) => request.url)).toContain('https://caldav.qiye.163.com/caldav/owner@example.com/');
  });

  it('falls back to NetEase user calendar paths when root discovery returns HTTP 400', async () => {
    const requests: Array<{ url: string; method: string; depth?: string }> = [];
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = init?.headers as Record<string, string> | undefined;
      requests.push({ url: String(url), method: init?.method ?? 'GET', depth: headers?.Depth });
      const body = String(init?.body ?? '');
      if (body.includes('current-user-principal')) {
        return new Response('bad request', { status: 400 });
      }
      if (String(url).includes('/caldav/owner@example.com/') && init?.method === 'PROPFIND' && headers?.Depth === '0') {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/caldav/owner@example.com/</d:href><d:displayname>个人日历</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:response></d:multistatus>');
      }
      if (String(url).includes('/caldav/owner@example.com/') && init?.method === 'REPORT') {
        return multistatus(`<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/caldav/owner@example.com/event-1.ics</d:href><c:calendar-data>${ics}</c:calendar-data></d:response></d:multistatus>`);
      }
      return new Response('not found', { status: 404 });
    };
    const client = new NeteaseCalDavClient(
      { account: 'owner@example.com', password: 'secret', serverUrl: 'https://caldav.qiye.163.com/' },
      { fetch: fetchImpl as typeof fetch },
    );

    const events = await client.listEvents({
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ title: 'CalDAV同步会' });
    expect(requests.some((request) => request.url === 'https://caldav.qiye.163.com/caldav/owner@example.com/')).toBe(true);
  });

  it('does not run calendar-query against a calendar home collection', async () => {
    const requests: Array<{ url: string; method: string; depth?: string }> = [];
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = init?.headers as Record<string, string> | undefined;
      requests.push({ url: String(url), method: init?.method ?? 'GET', depth: headers?.Depth });
      const body = String(init?.body ?? '');
      if (body.includes('current-user-principal')) {
        return new Response('bad request', { status: 400 });
      }
      if (String(url).endsWith('/caldav/owner@example.com/') && init?.method === 'PROPFIND' && headers?.Depth === '0') {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/caldav/owner@example.com/</d:href><d:displayname>calendar-home</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:response></d:multistatus>');
      }
      if (String(url).endsWith('/caldav/owner@example.com/') && init?.method === 'PROPFIND' && headers?.Depth === '1') {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/caldav/owner@example.com/default/</d:href><d:displayname>个人日历</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:response></d:multistatus>');
      }
      if (String(url).endsWith('/caldav/owner@example.com/default/') && init?.method === 'REPORT') {
        return multistatus(`<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/caldav/owner@example.com/default/event-1.ics</d:href><c:calendar-data>${ics}</c:calendar-data></d:response></d:multistatus>`);
      }
      return new Response('not found', { status: 404 });
    };
    const client = new NeteaseCalDavClient(
      { account: 'owner@example.com', password: 'secret', serverUrl: 'https://caldav.qiye.163.com/' },
      { fetch: fetchImpl as typeof fetch },
    );

    const events = await client.listEvents({
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(events).toHaveLength(1);
    expect(requests.some((request) => request.method === 'REPORT' && request.url.endsWith('/caldav/owner@example.com/'))).toBe(false);
    expect(requests.some((request) => request.method === 'REPORT' && request.url.endsWith('/caldav/owner@example.com/default/'))).toBe(true);
  });

  it('does not treat .well-known calendar-home-set as an event calendar', async () => {
    const requests: Array<{ url: string; method: string; depth?: string }> = [];
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = init?.headers as Record<string, string> | undefined;
      requests.push({ url: String(url), method: init?.method ?? 'GET', depth: headers?.Depth });
      const body = String(init?.body ?? '');
      if (body.includes('current-user-principal')) {
        return new Response('bad request', { status: 400 });
      }
      if (String(url).endsWith('/.well-known/caldav') && init?.method === 'PROPFIND') {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/.well-known/caldav</d:href><c:calendar-home-set><d:href>/caldav/owner@example.com/</d:href></c:calendar-home-set></d:response></d:multistatus>');
      }
      if (String(url).endsWith('/caldav/owner@example.com/') && init?.method === 'PROPFIND' && headers?.Depth === '0') {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/caldav/owner@example.com/</d:href><d:displayname>calendar-home</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:response></d:multistatus>');
      }
      if (String(url).endsWith('/caldav/owner@example.com/') && init?.method === 'PROPFIND' && headers?.Depth === '1') {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/caldav/owner@example.com/default/</d:href><d:displayname>个人日历</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:response></d:multistatus>');
      }
      if (String(url).endsWith('/caldav/owner@example.com/default/') && init?.method === 'REPORT') {
        return multistatus(`<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/caldav/owner@example.com/default/event-1.ics</d:href><c:calendar-data>${ics}</c:calendar-data></d:response></d:multistatus>`);
      }
      return new Response('not found', { status: 404 });
    };
    const client = new NeteaseCalDavClient(
      { account: 'owner@example.com', password: 'secret', serverUrl: 'https://caldav.qiye.163.com/' },
      { fetch: fetchImpl as typeof fetch },
    );

    const events = await client.listEvents({
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(events).toHaveLength(1);
    expect(requests.some((request) => request.method === 'REPORT' && request.url.endsWith('/.well-known/caldav'))).toBe(false);
  });

  it('does not list calendars from .well-known when it is not a calendar collection', async () => {
    const requests: Array<{ url: string; method: string; depth?: string }> = [];
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = init?.headers as Record<string, string> | undefined;
      requests.push({ url: String(url), method: init?.method ?? 'GET', depth: headers?.Depth });
      const body = String(init?.body ?? '');
      if (body.includes('current-user-principal')) return new Response('bad request', { status: 400 });
      if (String(url).endsWith('/.well-known/caldav')) {
        return multistatus('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/.well-known/caldav</d:href><d:resourcetype><d:collection/></d:resourcetype></d:response></d:multistatus>');
      }
      if (String(url).endsWith('/caldav/owner@example.com/calendar/') && init?.method === 'PROPFIND') {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/caldav/owner@example.com/calendar/</d:href><d:displayname>个人日历</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:response></d:multistatus>');
      }
      if (String(url).endsWith('/caldav/owner@example.com/calendar/') && init?.method === 'REPORT') {
        return multistatus(`<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/caldav/owner@example.com/calendar/event-1.ics</d:href><c:calendar-data>${ics}</c:calendar-data></d:response></d:multistatus>`);
      }
      return new Response('not found', { status: 404 });
    };
    const client = new NeteaseCalDavClient(
      { account: 'owner@example.com', password: 'secret', serverUrl: 'https://caldav.qiye.163.com/' },
      { fetch: fetchImpl as typeof fetch },
    );

    const events = await client.listEvents({
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(events).toHaveLength(1);
    expect(requests.some((request) => (
      request.url.endsWith('/.well-known/caldav') && request.method === 'PROPFIND' && request.depth === '1'
    ))).toBe(false);
  });

  it('falls back to an unbounded calendar-query when time-range query returns no resources', async () => {
    const reports: string[] = [];
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const body = String(init?.body ?? '');
      if (body.includes('current-user-principal')) {
        return multistatus('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/principals/owner/</d:href></d:current-user-principal></d:prop></d:propstat></d:response></d:multistatus>');
      }
      if (body.includes('calendar-home-set')) {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/principals/owner/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>/calendars/owner/</d:href></c:calendar-home-set></d:prop></d:propstat></d:response></d:multistatus>');
      }
      if (init?.method === 'PROPFIND') {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/calendars/owner/default/</d:href><d:displayname>个人日历</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype></d:response></d:multistatus>');
      }
      reports.push(body);
      if (body.includes('time-range')) {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"></d:multistatus>');
      }
      return multistatus(`<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/calendars/owner/default/event-725.ics</d:href><c:calendar-data>${july25Ics}</c:calendar-data></d:response></d:multistatus>`);
    };
    const client = new NeteaseCalDavClient(
      { account: 'owner@example.com', password: 'secret', serverUrl: 'https://caldav.qiye.163.com/' },
      { fetch: fetchImpl as typeof fetch },
    );

    const events = await client.listEvents({
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(reports).toHaveLength(2);
    expect(events[0]).toMatchObject({
      title: '研发会议',
      startAt: '2026-07-25T01:00:00.000Z',
      endAt: '2026-07-25T08:00:00.000Z',
    });
  });

  it('uses calendar-multiget when calendar-query returns resource hrefs without full VEVENT data', async () => {
    const reports: string[] = [];
    const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const body = String(init?.body ?? '');
      if (body.includes('current-user-principal')) {
        return multistatus('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/principals/owner/</d:href></d:current-user-principal></d:prop></d:propstat></d:response></d:multistatus>');
      }
      if (body.includes('calendar-home-set')) {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/principals/owner/</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>/calendars/owner/</d:href></c:calendar-home-set></d:prop></d:propstat></d:response></d:multistatus>');
      }
      if (init?.method === 'PROPFIND') {
        return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/calendars/owner/default/</d:href><d:displayname>个人日历</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype></d:response></d:multistatus>');
      }
      reports.push(body);
      if (body.includes('calendar-multiget')) {
        return multistatus(`<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/calendars/owner/default/event-725.ics</d:href><c:calendar-data><![CDATA[${july25Ics}]]></c:calendar-data></d:response></d:multistatus>`);
      }
      return multistatus('<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/calendars/owner/default/event-725.ics</d:href><d:getetag>"abc"</d:getetag></d:response><d:response><d:href>/calendars/owner/default/event-empty.ics</d:href><d:getetag>"def"</d:getetag></d:response></d:multistatus>');
    };
    const client = new NeteaseCalDavClient(
      { account: 'owner@example.com', password: 'secret', serverUrl: 'https://caldav.qiye.163.com/' },
      { fetch: fetchImpl as typeof fetch },
    );

    const events = await client.listEvents({
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    });

    const multigetReports = reports.filter((body) => body.includes('calendar-multiget'));
    expect(multigetReports).toHaveLength(1);
    expect(multigetReports[0]).toContain('/calendars/owner/default/event-empty.ics');
    expect(events[0]).toMatchObject({
      title: '研发会议',
      startAt: '2026-07-25T01:00:00.000Z',
    });
  });

  it('upserts CalDAV events into the system calendar', async () => {
    const repo = new InMemoryCalendarEventRepository();
    const event: NeteaseCalendarEvent = {
      externalId: 'netease-caldav:default:event-1',
      catalogId: '/calendars/owner/default/',
      title: 'CalDAV同步会',
      description: '来自 CalDAV',
      startAt: '2026-07-22T12:00:00.000Z',
      endAt: '2026-07-22T13:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      location: 'A会议室',
      meetingUrl: null,
      attendeeEmails: ['colleague@example.com'],
      status: 'confirmed',
      raw: {},
    };

    const result = await syncNeteaseCalDavCalendar({
      userId: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    }, {
      calendarRepo: repo,
      getCredentials: async () => ({ account: 'owner@example.com', password: 'secret' }),
      createClient: () => ({ listEvents: async () => [event] }),
      listUsers: async () => [
        { id: 'owner-1', email: 'owner@example.com', name: 'Owner' },
        { id: 'user-2', email: 'colleague@example.com', name: 'Colleague' },
      ],
      now: () => new Date('2026-07-22T10:00:00.000Z'),
    });

    const events = await repo.list({ ownerId: 'owner-1', tenantId: 'tenant-1' });
    expect(result).toMatchObject({ source: 'netease_caldav', created: 1, updated: 0, skipped: 0 });
    expect(events[0]).toMatchObject({
      title: 'CalDAV同步会',
      calendarSource: 'netease',
      externalId: 'netease-caldav:default:event-1',
      attendees: ['user-2'],
    });
  });

  it('merges a CalDAV event with an older email reminder import for the same title and time', async () => {
    const repo = new InMemoryCalendarEventRepository();
    await repo.create({
      title: '周六开会',
      description: '从邮箱“日程提醒”邮件自动导入。',
      startAt: '2026-07-22T12:00:00.000Z',
      endAt: '2026-07-22T13:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      recurringRule: null,
      ownerId: 'owner-1',
      attendees: [],
      attendeeEmails: [],
      externalAttendeeEmails: [],
      reminderMinutes: null,
      seriesId: null,
      recurrenceIndex: null,
      location: null,
      meetingUrl: null,
      calendarSource: 'netease',
      externalId: 'netease:mail-reminder:old',
      status: 'confirmed',
      tenantId: 'tenant-1',
      createdAt: '2026-07-22T10:00:00.000Z',
      updatedAt: '2026-07-22T10:00:00.000Z',
    });
    await repo.create({
      title: '周六开会',
      description: '来自 CalDAV',
      startAt: '2026-07-22T12:00:00.000Z',
      endAt: '2026-07-22T13:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      recurringRule: null,
      ownerId: 'owner-1',
      attendees: [],
      attendeeEmails: [],
      externalAttendeeEmails: [],
      reminderMinutes: null,
      seriesId: null,
      recurrenceIndex: null,
      location: null,
      meetingUrl: null,
      calendarSource: 'netease',
      externalId: 'netease-caldav:default:event-1',
      status: 'confirmed',
      tenantId: 'tenant-1',
      createdAt: '2026-07-22T10:01:00.000Z',
      updatedAt: '2026-07-22T10:01:00.000Z',
    });

    const result = await syncNeteaseCalDavCalendar({
      userId: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    }, {
      calendarRepo: repo,
      getCredentials: async () => ({ account: 'owner@example.com', password: 'secret' }),
      createClient: () => ({
        listEvents: async () => [{
          externalId: 'netease-caldav:default:event-1',
          catalogId: '/calendars/owner/default/',
          title: '周六开会',
          description: '来自 CalDAV',
          startAt: '2026-07-22T12:00:00.000Z',
          endAt: '2026-07-22T13:00:00.000Z',
          timezone: 'Asia/Shanghai',
          allDay: false,
          location: null,
          meetingUrl: null,
          attendeeEmails: [],
          status: 'confirmed',
          raw: {},
        }],
      }),
      listUsers: async () => [{ id: 'owner-1', email: 'owner@example.com', name: 'Owner' }],
      now: () => new Date('2026-07-22T10:02:00.000Z'),
    });

    const events = await repo.list({ ownerId: 'owner-1', tenantId: 'tenant-1' });
    expect(result).toMatchObject({ created: 0, cancelled: 1 });
    expect(events.filter((event) => event.status !== 'cancelled')).toHaveLength(1);
    expect(events.filter((event) => event.status === 'cancelled')).toHaveLength(1);
  });

  it('labels busy events from subscribed CalDAV calendars with the subscribed owner name', async () => {
    const repo = new InMemoryCalendarEventRepository();

    await syncNeteaseCalDavCalendar({
      userId: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    }, {
      calendarRepo: repo,
      getCredentials: async () => ({ account: 'owner@example.com', password: 'secret' }),
      createClient: () => ({
        listEvents: async () => [{
          externalId: 'netease-caldav:busy:event-1',
          catalogId: '/calendars/owner/busy/',
          title: '忙碌',
          description: '',
          startAt: '2026-07-15T07:00:00.000Z',
          endAt: '2026-07-15T08:00:00.000Z',
          timezone: 'Asia/Shanghai',
          allDay: false,
          location: null,
          meetingUrl: null,
          attendeeEmails: [],
          status: 'confirmed',
          raw: { calendarName: '李永胜的日历(忙闲)' },
        }],
      }),
      listUsers: async () => [{ id: 'owner-1', email: 'owner@example.com', name: 'Owner' }],
      now: () => new Date('2026-07-22T10:00:00.000Z'),
    });

    const events = await repo.list({ ownerId: 'owner-1', tenantId: 'tenant-1' });
    expect(events[0]).toMatchObject({
      title: '李永胜，忙碌',
      description: '来源日历：李永胜的日历(忙闲)',
    });
  });

  it('cancels existing CalDAV events in the sync range when they disappear from NetEase', async () => {
    const repo = new InMemoryCalendarEventRepository();
    await repo.create({
      title: '研发会议',
      description: null,
      startAt: '2026-07-25T01:00:00.000Z',
      endAt: '2026-07-25T08:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      recurringRule: null,
      ownerId: 'owner-1',
      attendees: [],
      attendeeEmails: [],
      externalAttendeeEmails: [],
      reminderMinutes: null,
      seriesId: null,
      recurrenceIndex: null,
      location: null,
      meetingUrl: null,
      calendarSource: 'netease',
      externalId: 'netease-caldav:default:event-725',
      status: 'confirmed',
      tenantId: 'tenant-1',
      createdAt: '2026-07-22T10:00:00.000Z',
      updatedAt: '2026-07-22T10:00:00.000Z',
    });

    const result = await syncNeteaseCalDavCalendar({
      userId: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    }, {
      calendarRepo: repo,
      getCredentials: async () => ({ account: 'owner@example.com', password: 'secret' }),
      createClient: () => ({
        listEvents: async () => [{
          externalId: 'netease-caldav:default:event-724',
          catalogId: '/calendars/owner/default/',
          title: '周五周例会',
          description: '',
          startAt: '2026-07-24T02:00:00.000Z',
          endAt: '2026-07-24T03:00:00.000Z',
          timezone: 'Asia/Shanghai',
          allDay: false,
          location: null,
          meetingUrl: null,
          attendeeEmails: [],
          status: 'confirmed',
          raw: {},
        }],
      }),
      listUsers: async () => [{ id: 'owner-1', email: 'owner@example.com', name: 'Owner' }],
      now: () => new Date('2026-07-23T10:00:00.000Z'),
    });

    const events = await repo.list({ ownerId: 'owner-1', tenantId: 'tenant-1' });
    expect(result).toMatchObject({ created: 1, cancelled: 1 });
    expect(events.find((event) => event.externalId === 'netease-caldav:default:event-725')?.status).toBe('cancelled');
    expect(events.find((event) => event.externalId === 'netease-caldav:default:event-724')?.status).toBe('confirmed');
  });

  it('cancels subscribed CalDAV events when an unsubscribed calendar returns no events', async () => {
    const repo = new InMemoryCalendarEventRepository();
    await repo.create({
      title: '李永胜，忙碌',
      description: '来源日历：李永胜的日历(忙闲)',
      startAt: '2026-07-15T07:00:00.000Z',
      endAt: '2026-07-15T08:00:00.000Z',
      timezone: 'Asia/Shanghai',
      allDay: false,
      recurringRule: null,
      ownerId: 'owner-1',
      attendees: [],
      attendeeEmails: [],
      externalAttendeeEmails: [],
      reminderMinutes: null,
      seriesId: null,
      recurrenceIndex: null,
      location: null,
      meetingUrl: null,
      calendarSource: 'netease',
      externalId: 'netease-caldav:busy:event-1',
      status: 'confirmed',
      tenantId: 'tenant-1',
      createdAt: '2026-07-22T10:00:00.000Z',
      updatedAt: '2026-07-22T10:00:00.000Z',
    });

    const result = await syncNeteaseCalDavCalendar({
      userId: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@example.com',
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-08-01T00:00:00.000Z'),
    }, {
      calendarRepo: repo,
      getCredentials: async () => ({ account: 'owner@example.com', password: 'secret' }),
      createClient: () => ({
        listEvents: async () => [],
        getLastStats: () => ({
          serverUrl: 'https://caldav.qiye.163.com/',
          calendarCount: 1,
          calendars: [{
            href: '/caldav/owner@example.com/default/',
            displayName: '我的日历',
            resourceCount: 0,
            eventCount: 0,
            parseFailures: [],
          }],
        }),
      }),
      listUsers: async () => [{ id: 'owner-1', email: 'owner@example.com', name: 'Owner' }],
      now: () => new Date('2026-07-23T10:00:00.000Z'),
    });

    const events = await repo.list({ ownerId: 'owner-1', tenantId: 'tenant-1' });
    expect(result).toMatchObject({ total: 0, cancelled: 1 });
    expect(events.find((event) => event.externalId === 'netease-caldav:busy:event-1')?.status).toBe('cancelled');
  });
});

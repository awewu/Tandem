import type { NeteaseCalendarEvent } from '@/lib/integrations/netease-calendar';

export interface NeteaseCalDavCredentials {
  account: string;
  password: string;
  serverUrl?: string;
}

export interface NeteaseCalDavClientLike {
  listEvents(range: { from: Date; to: Date }): Promise<NeteaseCalendarEvent[]>;
}

export interface NeteaseCalDavSyncStats {
  serverUrl: string;
  calendarCount: number;
  calendars: Array<{
    href: string;
    displayName: string;
    resourceCount: number;
    eventCount: number;
    parseFailures: string[];
  }>;
}

interface CalDavRequest {
  method: 'PROPFIND' | 'REPORT';
  url: string;
  body: string;
  depth: '0' | '1';
  label: string;
}

interface CalendarCollection {
  href: string;
  displayName: string;
}

interface CalendarResource {
  href: string;
  ics: string;
}

interface CalDavAttemptError {
  serverUrl: string;
  message: string;
}

const CALDAV_REQUEST_TIMEOUT_MS = 12_000;
const MULTIGET_BATCH_SIZE = 20;

export const NETEASE_CALDAV_SERVER_URLS = [
  'https://caldav.qiye.163.com/',
  'https://caldavhz.qiye.163.com/',
] as const;

export class NeteaseCalDavClient implements NeteaseCalDavClientLike {
  private readonly account: string;
  private readonly password: string;
  private readonly serverUrls: string[];
  private readonly fetchImpl: typeof fetch;
  private lastStats: NeteaseCalDavSyncStats | null = null;

  constructor(
    credentials: NeteaseCalDavCredentials,
    options: { fetch?: typeof fetch; serverUrls?: string[] } = {},
  ) {
    this.account = credentials.account;
    this.password = credentials.password;
    this.serverUrls = credentials.serverUrl
      ? [credentials.serverUrl]
      : options.serverUrls?.length
        ? options.serverUrls
        : [...NETEASE_CALDAV_SERVER_URLS];
    this.fetchImpl = options.fetch ?? fetch;
  }

  async listEvents(range: { from: Date; to: Date }): Promise<NeteaseCalendarEvent[]> {
    const errors: CalDavAttemptError[] = [];
    for (const serverUrl of this.serverUrls) {
      try {
        return await this.listEventsFromServer(normalizeServerUrl(serverUrl), range);
      } catch (error) {
        errors.push({
          serverUrl,
          message: error instanceof Error ? error.message : '未知错误',
        });
      }
    }
    throw new Error(`网易企业邮箱 CalDAV 同步失败：${summarizeAttemptErrors(errors, this.account)}`);
  }

  getLastStats(): NeteaseCalDavSyncStats | null {
    return this.lastStats;
  }

  private async listEventsFromServer(serverUrl: string, range: { from: Date; to: Date }): Promise<NeteaseCalendarEvent[]> {
    const calendars = await this.discoverCalendars(serverUrl);
    const events: NeteaseCalendarEvent[] = [];
    const stats: NeteaseCalDavSyncStats = {
      serverUrl,
      calendarCount: calendars.length,
      calendars: [],
    };

    for (const calendar of calendars) {
      let resources = await this.queryCalendar(serverUrl, calendar, range);
      if (resources.length === 0) resources = await this.queryCalendar(serverUrl, calendar);
      const detailByHref = await this.fetchCalendarResources(
        serverUrl,
        calendar,
        resources.filter((resource) => !parseICalendarEvents(resource.ics, {
          calendarHref: calendar.href,
          calendarName: calendar.displayName,
          resourceHref: resource.href,
        }).some((event) => eventOverlapsRange(event, range))).map((resource) => resource.href),
      ).catch(() => new Map<string, CalendarResource>());
      let eventCount = 0;
      const parseFailures: string[] = [];
      for (const resource of resources) {
        let failureIcs = resource.ics;
        let parsed = parseICalendarEvents(resource.ics, {
          calendarHref: calendar.href,
          calendarName: calendar.displayName,
          resourceHref: resource.href,
        }).filter((event) => eventOverlapsRange(event, range));
        if (parsed.length === 0) {
          const detailed = detailByHref.get(normalizeHrefKey(resource.href));
          if (detailed) {
            failureIcs = detailed.ics;
            parsed = parseICalendarEvents(detailed.ics, {
              calendarHref: calendar.href,
              calendarName: calendar.displayName,
              resourceHref: detailed.href,
            }).filter((event) => eventOverlapsRange(event, range));
          }
        }
        if (parsed.length === 0) parseFailures.push(describeICalParseFailure(failureIcs));
        eventCount += parsed.length;
        events.push(...parsed);
      }
      stats.calendars.push({
        href: calendar.href,
        displayName: calendar.displayName,
        resourceCount: resources.length,
        eventCount,
        parseFailures: uniqueStrings(parseFailures).slice(0, 3),
      });
    }

    this.lastStats = stats;
    return dedupeEvents(events);
  }

  private async discoverCalendars(serverUrl: string): Promise<CalendarCollection[]> {
    const errors: string[] = [];

    try {
      const principalHref = await this.discoverCurrentUserPrincipal(serverUrl);
      const homeHref = await this.discoverCalendarHome(serverUrl, principalHref);
      return await this.listCalendars(serverUrl, homeHref);
    } catch (error) {
      errors.push(`标准发现失败：${error instanceof Error ? error.message : '未知错误'}`);
    }

    for (const href of this.buildCandidateHrefs()) {
      try {
        const inspected = await this.inspectCalendarPath(serverUrl, href);
        if (inspected.kind === 'calendar') return [inspected.calendar];
        if (inspected.kind === 'home') return await this.listCalendars(serverUrl, inspected.href);
      } catch (error) {
        errors.push(`${maskAccount(href, this.account)}：${error instanceof Error ? error.message : '未知错误'}`);
      }
      if (isWellKnownHref(href)) continue;
      try {
        return await this.listCalendars(serverUrl, href);
      } catch (error) {
        errors.push(`${maskAccount(href, this.account)}/*：${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    throw new Error(errors.slice(0, 6).join('；') || '未发现可同步日历');
  }

  private buildCandidateHrefs(): string[] {
    const raw = this.account.trim();
    const encoded = encodeURIComponent(raw);
    const localPart = raw.split('@')[0] || raw;
    return uniqueStrings([
      `/.well-known/caldav`,
      `/principals/users/${raw}/`,
      `/principals/users/${encoded}/`,
      `/principals/${raw}/`,
      `/principals/${encoded}/`,
      `/users/${raw}/`,
      `/users/${encoded}/`,
      `/caldav/principals/users/${raw}/`,
      `/caldav/principals/users/${encoded}/`,
      `/caldav/principals/${raw}/`,
      `/caldav/principals/${encoded}/`,
      `/caldav/${raw}/`,
      `/caldav/${raw}/calendar/`,
      `/caldav/${raw}/default/`,
      `/caldav/${raw}/events/`,
      `/caldav/${raw}/personal/`,
      `/caldav/${encoded}/`,
      `/caldav/${encoded}/calendar/`,
      `/caldav/${encoded}/default/`,
      `/caldav/${encoded}/events/`,
      `/caldav/${encoded}/personal/`,
      `/calendars/${raw}/`,
      `/calendars/${raw}/calendar/`,
      `/calendars/${raw}/default/`,
      `/calendars/${raw}/events/`,
      `/calendars/${encoded}/`,
      `/calendars/${encoded}/calendar/`,
      `/calendars/${encoded}/default/`,
      `/calendars/${encoded}/events/`,
      `/calendar/${raw}/`,
      `/calendar/${raw}/calendar/`,
      `/calendar/${raw}/default/`,
      `/calendar/${encoded}/`,
      `/calendar/${encoded}/calendar/`,
      `/calendar/${encoded}/default/`,
      `/dav/${raw}/`,
      `/dav/${raw}/calendar/`,
      `/dav/${raw}/default/`,
      `/dav/${raw}/events/`,
      `/dav/${encoded}/`,
      `/dav/${encoded}/calendar/`,
      `/dav/${encoded}/default/`,
      `/dav/${encoded}/events/`,
      `/${raw}/`,
      `/${encoded}/`,
      `/caldav/${localPart}/`,
      `/caldav/${localPart}/calendar/`,
      `/caldav/${localPart}/default/`,
      `/calendars/${localPart}/`,
      `/calendars/${localPart}/calendar/`,
      `/calendars/${localPart}/default/`,
      `/calendar/`,
      `/caldav/`,
    ]);
  }

  private async discoverCurrentUserPrincipal(serverUrl: string): Promise<string> {
    const xml = await this.caldav({
      method: 'PROPFIND',
      url: serverUrl,
      depth: '0',
      label: '发现当前用户',
      body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal /><d:principal-URL /></d:prop>
</d:propfind>`,
    });
    const href = nestedHref(xml, 'current-user-principal') ?? nestedHref(xml, 'principal-URL');
    if (!href) throw new Error('网易企业邮箱 CalDAV 未返回 current-user-principal');
    return href;
  }

  private async discoverCalendarHome(serverUrl: string, principalHref: string): Promise<string> {
    const xml = await this.caldav({
      method: 'PROPFIND',
      url: resolveCalDavUrl(serverUrl, principalHref),
      depth: '0',
      label: '发现日历目录',
      body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set /></d:prop>
</d:propfind>`,
    });
    const href = nestedHref(xml, 'calendar-home-set');
    if (!href) throw new Error('网易企业邮箱 CalDAV 未返回 calendar-home-set');
    return href;
  }

  private async listCalendars(serverUrl: string, homeHref: string): Promise<CalendarCollection[]> {
    const xml = await this.caldav({
      method: 'PROPFIND',
      url: resolveCalDavUrl(serverUrl, homeHref),
      depth: '1',
      label: '列出日历',
      body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
    <c:supported-calendar-component-set />
  </d:prop>
</d:propfind>`,
    });
    const calendars = splitResponses(xml)
      .map((response) => ({
        href: firstTag(response, 'href') ?? '',
        displayName: textContent(firstTag(response, 'displayname') ?? '') || '网易日历',
        raw: response,
      }))
      .filter((item) => item.href && isCalendarCollection(item.raw))
      .map(({ href, displayName }) => ({ href, displayName }));
    if (calendars.length === 0) throw new Error('网易企业邮箱 CalDAV 未发现可同步日历，请确认已开启 CalDAV 服务。');
    return calendars;
  }

  private async inspectCalendarPath(
    serverUrl: string,
    href: string,
  ): Promise<{ kind: 'calendar'; calendar: CalendarCollection } | { kind: 'home'; href: string } | { kind: 'none' }> {
    const xml = await this.caldav({
      method: 'PROPFIND',
      url: resolveCalDavUrl(serverUrl, href),
      depth: '0',
      label: '检查日历路径',
      body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
    <c:supported-calendar-component-set />
  </d:prop>
</d:propfind>`,
    });
    if (isCalendarCollection(xml)) {
      return {
        kind: 'calendar',
        calendar: {
          href,
          displayName: textContent(firstTag(xml, 'displayname') ?? '') || '网易日历',
        },
      };
    }
    const calendarHomeHref = nestedHref(xml, 'calendar-home-set');
    if (calendarHomeHref) return { kind: 'home', href: calendarHomeHref };
    return {
      kind: 'none',
    };
  }

  private async queryCalendar(
    serverUrl: string,
    calendar: CalendarCollection,
    range?: { from: Date; to: Date },
  ): Promise<CalendarResource[]> {
    const timeRange = range
      ? `<c:time-range start="${formatCalDavDate(range.from)}" end="${formatCalDavDate(range.to)}" />`
      : '';
    const xml = await this.caldav({
      method: 'REPORT',
      url: resolveCalDavUrl(serverUrl, calendar.href),
      depth: '1',
      label: range ? '拉取日程' : '拉取日程(无时间过滤)',
      body: `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:getetag /><c:calendar-data /></d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">${timeRange}</c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`,
    });
    return splitResponses(xml)
      .map((response) => ({
        href: firstTag(response, 'href') ?? '',
        ics: extractCalendarData(response),
      }))
      .filter((item) => item.href);
  }

  private async fetchCalendarResources(
    serverUrl: string,
    calendar: CalendarCollection,
    hrefs: string[],
  ): Promise<Map<string, CalendarResource>> {
    const result = new Map<string, CalendarResource>();
    const uniqueHrefs = uniqueStrings(hrefs).filter(Boolean);
    for (let i = 0; i < uniqueHrefs.length; i += MULTIGET_BATCH_SIZE) {
      const batch = uniqueHrefs.slice(i, i + MULTIGET_BATCH_SIZE);
      if (batch.length === 0) continue;
      const xml = await this.caldav({
        method: 'REPORT',
        url: resolveCalDavUrl(serverUrl, calendar.href),
        depth: '1',
        label: '拉取日程详情',
        body: `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-multiget xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:getetag /><c:calendar-data /></d:prop>
  ${batch.map((href) => `<d:href>${escapeXml(href)}</d:href>`).join('\n  ')}
</c:calendar-multiget>`,
      });
      for (const response of splitResponses(xml)) {
        const href = firstTag(response, 'href') ?? '';
        const ics = extractCalendarData(response);
        if (href && ics) result.set(normalizeHrefKey(href), { href, ics });
      }
    }
    return result;
  }

  private async caldav(request: CalDavRequest): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CALDAV_REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(request.url, {
        method: request.method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.account}:${this.password}`).toString('base64')}`,
          Accept: 'application/xml,text/xml,*/*',
          'Content-Type': 'application/xml; charset=utf-8',
          Depth: request.depth,
          'User-Agent': 'Hermes-Tandem-CalDAV/1.0',
        },
        body: request.body,
        cache: 'no-store',
        signal: controller.signal,
      });
      const text = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error(`${request.label} ${safeUrlPath(request.url)} 认证失败，请确认邮箱已开启 CalDAV，且使用的是允许客户端登录的密码。`);
      }
      if (!response.ok && response.status !== 207) {
        throw new Error(`${request.label} ${safeUrlPath(request.url)} 请求失败：HTTP ${response.status}`);
      }
      return text;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${request.label} ${safeUrlPath(request.url)} 请求超时`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function parseICalendarEvents(
  ics: string,
  ctx: { calendarHref: string; calendarName: string; resourceHref: string },
): NeteaseCalendarEvent[] {
  const blocks = splitBlocks(unfoldICalLines(ics), 'VEVENT');
  return blocks
    .map((block) => parseEventBlock(block, ctx))
    .filter((event): event is NeteaseCalendarEvent => event !== null);
}

function parseEventBlock(
  block: string,
  ctx: { calendarHref: string; calendarName: string; resourceHref: string },
): NeteaseCalendarEvent | null {
  const uid = getICalProperty(block, 'UID') || ctx.resourceHref;
  const summary = getICalProperty(block, 'SUMMARY') || '未命名日程';
  const dtStart = getICalDate(block, 'DTSTART');
  const dtEnd = getICalDate(block, 'DTEND') ?? deriveEndDate(block, dtStart);
  if (!dtStart || !dtEnd || dtEnd.date <= dtStart.date) return null;
  const statusRaw = (getICalProperty(block, 'STATUS') ?? '').toUpperCase();
  const attendeeEmails = getICalProperties(block, 'ATTENDEE')
    .map((value) => value.replace(/^mailto:/i, '').trim())
    .filter(Boolean);

  return {
    externalId: `netease-caldav:${stableHash(ctx.calendarHref)}:${uid}`,
    catalogId: ctx.calendarHref,
    title: decodeICalText(summary),
    description: decodeICalText(getICalProperty(block, 'DESCRIPTION') ?? ''),
    startAt: dtStart.date.toISOString(),
    endAt: dtEnd.date.toISOString(),
    timezone: dtStart.timezone ?? 'Asia/Shanghai',
    allDay: dtStart.allDay,
    location: decodeICalText(getICalProperty(block, 'LOCATION') ?? ''),
    meetingUrl: null,
    attendeeEmails,
    status: statusRaw === 'CANCELLED' ? 'cancelled' : statusRaw === 'TENTATIVE' ? 'tentative' : 'confirmed',
    raw: { calendarName: ctx.calendarName, resourceHref: ctx.resourceHref },
  };
}

function getICalProperty(block: string, name: string): string | null {
  return getICalProperties(block, name)[0] ?? null;
}

function getICalProperties(block: string, name: string): string[] {
  const prefix = name.toUpperCase();
  return block
    .split(/\r?\n/)
    .filter((line) => line.toUpperCase().startsWith(prefix + ':') || line.toUpperCase().startsWith(prefix + ';'))
    .map((line) => line.slice(line.indexOf(':') + 1));
}

function getICalDate(block: string, name: string): { date: Date; timezone?: string; allDay: boolean } | null {
  const line = block
    .split(/\r?\n/)
    .find((item) => item.toUpperCase().startsWith(name + ':') || item.toUpperCase().startsWith(name + ';'));
  if (!line) return null;
  const [meta, rawValue] = splitOnce(line, ':');
  const value = rawValue.trim();
  const allDay = /VALUE=DATE/i.test(meta);
  const timezone = cleanParamValue(meta.match(/TZID=([^;:]+)/i)?.[1] ?? '');
  const date = parseICalDate(value, { allDay, timezone });
  if (!date) return null;
  return { date, timezone: timezone || (allDay ? 'Asia/Shanghai' : undefined), allDay };
}

function parseICalDate(value: string, opts: { allDay: boolean; timezone?: string }): Date | null {
  const normalized = value.trim();
  if (opts.allDay) {
    const match = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  const match = normalized.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(?:(\d{2}))?(Z|[+-]\d{2}:?\d{2})?$/);
  if (!match) return null;
  const utcBase = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  );
  const suffix = match[7] ?? '';
  if (suffix === 'Z') return new Date(utcBase);
  if (/^[+-]\d{2}:?\d{2}$/.test(suffix)) {
    return new Date(utcBase - parseTimezoneOffsetMinutes(suffix) * 60 * 1000);
  }
  const timezone = normalizeTimezone(opts.timezone);
  if (timezone === 'Asia/Shanghai' || timezone === 'Asia/Chongqing' || timezone === 'Asia/Harbin' || timezone === 'Asia/Beijing' || timezone === 'China Standard Time') {
    return new Date(utcBase - 8 * 60 * 60 * 1000);
  }
  return new Date(utcBase);
}

function deriveEndDate(
  block: string,
  dtStart: { date: Date; timezone?: string; allDay: boolean } | null,
): { date: Date; timezone?: string; allDay: boolean } | null {
  if (!dtStart) return null;
  const duration = getICalProperty(block, 'DURATION');
  if (duration) {
    const durationMs = parseICalDuration(duration);
    if (durationMs > 0) return { ...dtStart, date: new Date(dtStart.date.getTime() + durationMs) };
  }
  const fallbackMs = dtStart.allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  return { ...dtStart, date: new Date(dtStart.date.getTime() + fallbackMs) };
}

function parseICalDuration(value: string): number {
  const match = value.trim().match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return 0;
  const weeks = Number(match[1] ?? 0);
  const days = Number(match[2] ?? 0);
  const hours = Number(match[3] ?? 0);
  const minutes = Number(match[4] ?? 0);
  const seconds = Number(match[5] ?? 0);
  return (((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000;
}

function parseTimezoneOffsetMinutes(value: string): number {
  const match = value.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function cleanParamValue(value: string): string {
  return value.trim().replace(/^"|"$/g, '');
}

function normalizeTimezone(value?: string): string {
  return cleanParamValue(value ?? '');
}

function unfoldICalLines(ics: string): string {
  return ics.replace(/\r?\n[ \t]/g, '');
}

function splitBlocks(text: string, name: string): string[] {
  const regex = new RegExp(`BEGIN:${name}([\\s\\S]*?)END:${name}`, 'gi');
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) blocks.push(match[1]);
  return blocks;
}

function decodeICalText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function splitResponses(xml: string): string[] {
  const matches = xml.match(/<[^>]*response\b[\s\S]*?<\/[^>]*response>/gi);
  return matches ?? [];
}

function isCalendarCollection(xml: string): boolean {
  return /<[^>\s:]+:calendar(?:\s|\/?>)/i.test(xml)
    || /<calendar(?:\s|\/?>)/i.test(xml)
    || /<[^>\s:]+:comp\b[^>]*\bname=["']VEVENT["'][^>]*\/?>/i.test(xml)
    || /<comp\b[^>]*\bname=["']VEVENT["'][^>]*\/?>/i.test(xml);
}

function firstTag(xml: string, localName: string): string | null {
  const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`<[^>]*(?:^|:)${escaped}[^>]*>([\\s\\S]*?)<\\/[^>]*(?:^|:)${escaped}>`, 'i');
  return xml.match(regex)?.[1] ?? null;
}

function nestedHref(xml: string, localName: string): string | null {
  const container = firstTag(xml, localName);
  return container ? firstTag(container, 'href') : null;
}

function textContent(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function extractCalendarData(responseXml: string): string {
  const raw = firstTag(responseXml, 'calendar-data');
  return raw ? textContent(raw) : '';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveCalDavUrl(serverUrl: string, href: string): string {
  return new URL(href, serverUrl).toString();
}

function normalizeServerUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isWellKnownHref(href: string): boolean {
  return href.startsWith('/.well-known/');
}

function maskAccount(value: string, account: string): string {
  if (!account) return value;
  return value
    .replaceAll(account, '<account>')
    .replaceAll(encodeURIComponent(account), '<account>');
}

function safeUrlPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || '/';
  } catch {
    return url;
  }
}

function normalizeHrefKey(href: string): string {
  try {
    const parsed = new URL(href);
    return parsed.pathname;
  } catch {
    return href;
  }
}

function summarizeAttemptErrors(errors: CalDavAttemptError[], account: string): string {
  return errors
    .map((error) => `${maskAccount(error.serverUrl, account)}：${maskAccount(error.message, account)}`)
    .join('；');
}

function formatCalDavDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function splitOnce(value: string, separator: string): [string, string] {
  const index = value.indexOf(separator);
  if (index === -1) return [value, ''];
  return [value.slice(0, index), value.slice(index + separator.length)];
}

function stableHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function dedupeEvents(events: NeteaseCalendarEvent[]): NeteaseCalendarEvent[] {
  const byId = new Map<string, NeteaseCalendarEvent>();
  for (const event of events) byId.set(event.externalId, event);
  return Array.from(byId.values());
}

function eventOverlapsRange(event: NeteaseCalendarEvent, range: { from: Date; to: Date }): boolean {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  return end > range.from && start < range.to;
}

function describeICalParseFailure(ics: string): string {
  const unfolded = unfoldICalLines(ics);
  const blocks = splitBlocks(unfolded, 'VEVENT');
  if (blocks.length === 0) return '未找到 VEVENT';
  const reasons = new Set<string>();
  for (const block of blocks) {
    const start = getICalDate(block, 'DTSTART');
    const end = getICalDate(block, 'DTEND') ?? deriveEndDate(block, start);
    if (!start) reasons.add('缺少或无法解析 DTSTART');
    else if (!end) reasons.add('缺少或无法解析 DTEND/DURATION');
    else if (end.date <= start.date) reasons.add('结束时间不晚于开始时间');
    else reasons.add('VEVENT 在当前同步范围外');
  }
  return Array.from(reasons).join('/');
}

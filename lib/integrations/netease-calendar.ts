export interface NeteaseCalendarCredentials {
  account: string;
  password: string;
  verifyCode?: string;
  baseUrl?: string;
}

export interface NeteaseCalendarCatalog {
  id: string;
  name?: string;
  raw: Record<string, unknown>;
}

export interface NeteaseCalendarEvent {
  externalId: string;
  catalogId: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  allDay: boolean;
  location?: string | null;
  meetingUrl?: string | null;
  attendeeEmails: string[];
  status: 'confirmed' | 'tentative' | 'cancelled';
  raw: Record<string, unknown>;
}

export interface NeteaseCalendarClientLike {
  listEvents(range: { from: Date; to: Date }): Promise<NeteaseCalendarEvent[]>;
}

interface JsonObject {
  [key: string]: unknown;
}

export class NeteaseCalendarClient implements NeteaseCalendarClientLike {
  private static readonly REQUEST_TIMEOUT_MS = 15_000;
  private static readonly EVENT_CHUNK_CONCURRENCY = 4;
  private readonly baseUrl: string;
  private readonly cookies = new Map<string, string>();
  private uid = '';
  private sid = '';

  constructor(private readonly credentials: NeteaseCalendarCredentials) {
    this.baseUrl = (credentials.baseUrl ?? 'https://mail.qiye.163.com').replace(/\/$/, '');
  }

  async listEvents(range: { from: Date; to: Date }): Promise<NeteaseCalendarEvent[]> {
    await this.login();
    const catalogs = await this.listCatalogs();
    const catalogIds = catalogs.map((catalog) => catalog.id).filter(Boolean);
    if (catalogIds.length === 0) return [];

    const chunks = splitRange(range.from, range.to, 2);
    const chunkEvents = await mapWithConcurrency(chunks, NeteaseCalendarClient.EVENT_CHUNK_CONCURRENCY, async (chunk) => {
      const rawEvents = await this.requestJson('/bjschedulemanager/web/event/list', {
        method: 'POST',
        query: this.scheduleQuery(),
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          catalogIds,
          start: chunk.from.getTime(),
          end: chunk.to.getTime(),
        }),
      });
      return extractArray(rawEvents).flatMap((raw) => normalizeEvent(raw, catalogs));
    });

    return dedupeEvents(chunkEvents.flat());
  }

  private async login(): Promise<void> {
    const account = this.credentials.account.trim();
    const domain = account.includes('@') ? account.split('@').pop() ?? '' : '';
    const accountName = account.includes('@') ? account.slice(0, account.lastIndexOf('@')) : account;
    const deviceId = `tandem-${Math.random().toString(36).slice(2, 12)}-${Date.now().toString(36)}`;

    const preLogin = await this.requestJson('/corp-mail/auth/preLogin', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: formBody({
        p: 'web',
        output: 'json',
        account,
        account_name: accountName,
        domain,
      }),
    });
    this.captureSession(preLogin);

    const login = await this.requestJson('/corp-mail/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: formBody({
        p: 'web',
        hl: 'zh_CN',
        all_secure: '1',
        secure: '1',
        deviceid: deviceId,
        _deviceId: deviceId,
        support_verify_code: '1',
        verify_code: this.credentials.verifyCode ?? '',
        output: 'json',
        passtype: '2',
        account,
        account_name: accountName,
        domain,
        sid: this.sid,
        password: this.credentials.password,
      }),
    });

    if (requiresVerification(login)) {
      throw new Error('网易企业邮箱要求验证码或风险验证，暂不能在后台自动同步。请先在网页端完成验证后再重试。');
    }
    if (isFailed(login)) {
      throw new Error(readErrorMessage(login) ?? '后台网页登录网易企业邮箱失败。请确认邮箱设置里保存的是网页端登录密码；如果网页端可以登录但这里仍失败，说明网易还要求额外验证或登录参数。');
    }
    this.captureSession(login);
    if (!this.uid) this.uid = account;
  }

  private async listCatalogs(): Promise<NeteaseCalendarCatalog[]> {
    const raw = await this.requestJson('/bjschedulemanager/web/catalog/list', {
      method: 'POST',
      query: this.scheduleQuery(),
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: formBody(this.scheduleQuery()),
    });
    return extractArray(raw)
      .map((item) => normalizeCatalog(item))
      .filter((item): item is NeteaseCalendarCatalog => item !== null);
  }

  private async requestJson(path: string, init: {
    method: 'GET' | 'POST';
    query?: Record<string, string | number | undefined>;
    headers?: Record<string, string>;
    body?: BodyInit;
  }): Promise<JsonObject> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NeteaseCalendarClient.REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        method: init.method,
        headers: {
          accept: 'application/json, text/plain, */*',
          cookie: this.cookieHeader(),
          referer: `${this.baseUrl}/static/sirius-web/`,
          ...init.headers,
        },
        body: init.body,
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('连接网易企业邮箱日历接口超时，请稍后重试或检查服务器网络。');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    this.rememberCookies(response.headers.get('set-cookie'));
    const text = await response.text();
    if (!response.ok && (response.status < 300 || response.status >= 400)) {
      throw new Error(`网易企业邮箱请求失败 (${response.status})`);
    }
    return parseJsonLike(text);
  }

  private scheduleQuery(): Record<string, string | number> {
    return {
      uid: this.uid || this.credentials.account,
      searchTime: Date.now(),
      sid: this.sid,
    };
  }

  private captureSession(payload: JsonObject): void {
    this.uid = String(findDeep(payload, ['uid', 'userId', 'account']) ?? this.uid ?? '');
    this.sid = String(findDeep(payload, ['sid', 'sessionId']) ?? this.sid ?? '');
  }

  private rememberCookies(header: string | null): void {
    if (!header) return;
    for (const cookie of splitSetCookie(header)) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  private cookieHeader(): string {
    return Array.from(this.cookies.entries()).map(([key, value]) => `${key}=${value}`).join('; ');
  }
}

function formBody(data: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}

function parseJsonLike(text: string): JsonObject {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const jsonText = trimmed.startsWith('{') || trimmed.startsWith('[')
    ? trimmed
    : trimmed.slice(trimmed.search(/[\[{]/));
  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error('网易企业邮箱返回格式无法解析');
  }
}

function extractArray(value: unknown): JsonObject[] {
  if (Array.isArray(value)) return value.filter(isObject);
  if (!isObject(value)) return [];
  for (const key of ['data', 'list', 'events', 'eventList', 'catalogs', 'result', 'items']) {
    const child = value[key];
    if (Array.isArray(child)) return child.filter(isObject);
    const nested = extractArray(child);
    if (nested.length > 0) return nested;
  }
  return [];
}

function normalizeCatalog(raw: JsonObject): NeteaseCalendarCatalog | null {
  const id = readString(raw, ['catalogId', 'id', 'cid', 'calendarId']);
  if (!id) return null;
  return {
    id,
    name: readString(raw, ['name', 'catalogName', 'title']) ?? undefined,
    raw,
  };
}

function normalizeEvent(raw: JsonObject, catalogs: NeteaseCalendarCatalog[]): NeteaseCalendarEvent[] {
  const catalogId = readString(raw, ['catalogId', 'cid', 'calendarId']) ?? catalogs[0]?.id ?? 'default';
  const id = readString(raw, ['scheduleId', 'eventId', 'id', 'uid', 'uuid']);
  const start = readDate(raw, ['start', 'startTime', 'beginTime', 'dtStart', 'startAt']);
  const end = readDate(raw, ['end', 'endTime', 'finishTime', 'dtEnd', 'endAt']);
  if (!id || !start || !end || end <= start) return [];

  const title = readString(raw, ['title', 'subject', 'summary', 'name'])?.trim() || '未命名日程';
  const attendeeEmails = uniqueEmails([
    ...readEmailList(raw, ['attendees', 'members', 'invitees', 'participants']),
    ...readEmailList(raw, ['attendeeEmails', 'emails']),
  ]);

  return [{
    externalId: `netease:${catalogId}:${id}`,
    catalogId,
    title,
    description: readString(raw, ['description', 'content', 'remark']) ?? null,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    timezone: readString(raw, ['timezone', 'timeZone', 'tz']) ?? 'Asia/Shanghai',
    allDay: Boolean(raw.allDay ?? raw.isAllDay ?? raw.allday),
    location: readString(raw, ['location', 'place']) ?? null,
    meetingUrl: readString(raw, ['meetingUrl', 'url', 'conferenceUrl']) ?? null,
    attendeeEmails,
    status: normalizeStatus(readString(raw, ['status', 'state'])),
    raw,
  }];
}

function readString(raw: JsonObject, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readDate(raw: JsonObject, keys: string[]): Date | null {
  for (const key of keys) {
    const value = raw[key];
    const date = coerceDate(value);
    if (date) return date;
  }
  return null;
}

function coerceDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function readEmailList(raw: JsonObject, keys: string[]): string[] {
  const emails: string[] = [];
  for (const key of keys) collectEmails(raw[key], emails);
  return emails;
}

function collectEmails(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(...value.split(/[,;\s]+/));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectEmails(item, out);
    return;
  }
  if (isObject(value)) {
    const email = readString(value, ['email', 'mail', 'account', 'address']);
    if (email) out.push(email);
  }
}

function normalizeStatus(status?: string | null): 'confirmed' | 'tentative' | 'cancelled' {
  const value = status?.toLowerCase() ?? '';
  if (value.includes('cancel') || value === '2' || value.includes('delete')) return 'cancelled';
  if (value.includes('tentative') || value.includes('maybe') || value === '0') return 'tentative';
  return 'confirmed';
}

function uniqueEmails(emails: string[]): string[] {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return Array.from(new Set(emails.map((email) => email.trim().toLowerCase()).filter((email) => pattern.test(email))));
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findDeep(value: unknown, keys: string[]): unknown {
  if (!isObject(value)) return undefined;
  for (const key of keys) {
    if (value[key] !== undefined && value[key] !== null && value[key] !== '') return value[key];
  }
  for (const child of Object.values(value)) {
    const match = findDeep(child, keys);
    if (match !== undefined) return match;
  }
  return undefined;
}

function requiresVerification(payload: JsonObject): boolean {
  for (const key of ['needVerify', 'needVerifyCode', 'needCaptcha', 'captcha', 'verifyCode']) {
    const value = findDeep(payload, [key]);
    if (value === true || value === 1 || value === '1') return true;
  }
  const text = JSON.stringify(payload).toLowerCase();
  return ['captcha', 'risk', '二次', '验证码', '风控'].some((marker) => text.includes(marker));
}

function isFailed(payload: JsonObject): boolean {
  const code = findDeep(payload, ['code', 'status', 'resultCode']);
  if (code === undefined || code === null || code === '') return false;
  const normalized = String(code).toLowerCase();
  return !['0', '200', 'ok', 'success', 'true'].includes(normalized);
}

function readErrorMessage(payload: JsonObject): string | null {
  const message = findDeep(payload, ['message', 'msg', 'error', 'errorMsg', 'desc']);
  return typeof message === 'string' && message.trim() ? message.trim() : null;
}

function splitRange(from: Date, to: Date, days: number): Array<{ from: Date; to: Date }> {
  const chunks: Array<{ from: Date; to: Date }> = [];
  let cursor = new Date(from);
  while (cursor < to) {
    const next = new Date(Math.min(to.getTime(), cursor.getTime() + days * 24 * 60 * 60 * 1000));
    chunks.push({ from: cursor, to: next });
    cursor = next;
  }
  return chunks;
}

function dedupeEvents(events: NeteaseCalendarEvent[]): NeteaseCalendarEvent[] {
  const byId = new Map<string, NeteaseCalendarEvent>();
  for (const event of events) byId.set(event.externalId, event);
  return Array.from(byId.values()).sort((left, right) => left.startAt.localeCompare(right.startAt));
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function run(): Promise<void> {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function splitSetCookie(header: string): string[] {
  return header.split(/,(?=\s*[^;,=\s]+=[^;,]+)/g).map((cookie) => cookie.trim()).filter(Boolean);
}

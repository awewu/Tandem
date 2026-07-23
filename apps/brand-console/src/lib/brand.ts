// 服务端专用：品牌运营控制台的后端访问 + 会话。
// 铁律：JWT_SECRET 与服务令牌绝不下发浏览器；所有数据面调用在服务端完成。
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const BASE = process.env.NEXUS_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5500' : 'https://web.rhautt.com');
const PREFIX = process.env.NEXUS_API_PREFIX ?? '/api/v2';
const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'rhautt-comfort-dev-secret-NEVER-USE-IN-PRODUCTION' : 'brand-console-dev-secret');
export const BRAND_TENANT = process.env.BRAND_TENANT || process.env.EVERHOT_TENANT_ID || 'e5e40000-0000-4000-8000-000000000001';
export const BRAND = process.env.BRAND || 'everhot';
const DEFAULT_ACTOR_ID = process.env.BRAND_CONSOLE_ACTOR_ID || '00000000-0000-4000-8000-000000004012';
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const SESSION_COOKIE = 'bc_session';
export const OIDC_STATE_COOKIE = 'bc_oidc_state';
const TIMEOUT_MS = 8000;

// ── 角色与 RBAC ──────────────────────────────────────────────────────────
// brand_admin：可编辑/上新/上下架/上传图/发布；brand_viewer：只读。
export type Role = 'brand_admin' | 'brand_viewer';
export interface Session { sub: string; name: string; role: Role }
export function canWrite(role?: string): boolean { return role === 'brand_admin'; }

// ── 鉴权模式：sso（生产，接共享 OIDC IdP）| dev（本地回退，账号密码）──────────
// 未显式指定时：配了 SSO_ISSUER 即走 sso，否则 dev。
export const AUTH_MODE: 'sso' | 'dev' =
  (process.env.BRAND_CONSOLE_AUTH_MODE as 'sso' | 'dev') || (process.env.SSO_ISSUER ? 'sso' : 'dev');

// dev 回退账号（仅 AUTH_MODE=dev 生效；生产请用 SSO）
const DEV_USERS: Record<string, { password: string; role: Role }> = {
  [process.env.BRAND_CONSOLE_USER || 'admin']: {
    password: process.env.BRAND_CONSOLE_PASSWORD || 'everhot2026',
    role: 'brand_admin',
  },
  ...(process.env.BRAND_CONSOLE_VIEWER
    ? { [process.env.BRAND_CONSOLE_VIEWER]: {
        password: process.env.BRAND_CONSOLE_VIEWER_PASSWORD || 'viewer2026',
        role: 'brand_viewer' as Role,
      } }
    : {}),
};

// dev 登录校验 → 会话主体
export function verifyDevLogin(user: string, password: string): Session | null {
  const u = DEV_USERS[user];
  if (!u || u.password !== password) return null;
  return { sub: user, name: user, role: u.role };
}
export function issueSession(s: Session): string {
  return jwt.sign({ sub: s.sub, name: s.name, role: s.role }, SECRET, { expiresIn: '8h' });
}
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const t = store.get(SESSION_COOKIE)?.value;
  if (!t) return null;
  try {
    const p = jwt.verify(t, SECRET) as { sub: string; name?: string; role?: Role };
    return { sub: p.sub, name: p.name || p.sub, role: (p.role as Role) || 'brand_viewer' };
  } catch { return null; }
}

// ── 本仓自有 SSO（OIDC Authorization Code Flow；仅用 fetch + 我方会话，无新依赖）──
// 数据面仍在服务端铸令牌；IdP 令牌只在服务端交换，不下发浏览器。
const SSO = {
  issuer: (process.env.SSO_ISSUER || '').replace(/\/$/, ''),
  clientId: process.env.SSO_CLIENT_ID || '',
  clientSecret: process.env.SSO_CLIENT_SECRET || '',
  redirectUri: process.env.SSO_REDIRECT_URI || 'http://localhost:5012/api/session/callback',
  scopes: process.env.SSO_SCOPES || 'openid profile email groups',
  groupsClaim: process.env.SSO_GROUPS_CLAIM || 'groups',
  adminGroups: (process.env.SSO_ADMIN_GROUPS || 'everhot-admin').split(',').map((s) => s.trim()).filter(Boolean),
  viewerGroups: (process.env.SSO_VIEWER_GROUPS || 'everhot-viewer').split(',').map((s) => s.trim()).filter(Boolean),
};
export function ssoEnabled(): boolean { return AUTH_MODE === 'sso' && !!SSO.issuer && !!SSO.clientId; }

let _disco: { authorization_endpoint: string; token_endpoint: string; userinfo_endpoint: string } | null = null;
async function discovery() {
  if (_disco) return _disco;
  const res = await fetch(`${SSO.issuer}/.well-known/openid-configuration`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`OIDC discovery HTTP ${res.status}`);
  _disco = await res.json();
  return _disco!;
}
export async function ssoAuthorizeUrl(state: string): Promise<string> {
  const d = await discovery();
  const q = new URLSearchParams({
    response_type: 'code', client_id: SSO.clientId, redirect_uri: SSO.redirectUri,
    scope: SSO.scopes, state,
  });
  return `${d.authorization_endpoint}?${q.toString()}`;
}
function mapRole(groups: string[]): Role | null {
  if (groups.some((g) => SSO.adminGroups.includes(g))) return 'brand_admin';
  if (groups.some((g) => SSO.viewerGroups.includes(g))) return 'brand_viewer';
  return null; // 不在授权组 → 拒绝登录
}
// 用授权码换取身份；经 userinfo 取组 → 映射角色（组不匹配则拒绝）。
export async function ssoExchange(code: string): Promise<Session | null> {
  const d = await discovery();
  const tokRes = await fetch(d.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: SSO.redirectUri,
      client_id: SSO.clientId, client_secret: SSO.clientSecret,
    }),
  });
  if (!tokRes.ok) throw new Error(`OIDC token HTTP ${tokRes.status}`);
  const tok = await tokRes.json();
  const uiRes = await fetch(d.userinfo_endpoint, { headers: { authorization: `Bearer ${tok.access_token}` } });
  if (!uiRes.ok) throw new Error(`OIDC userinfo HTTP ${uiRes.status}`);
  const ui = await uiRes.json();
  const groups: string[] = Array.isArray(ui[SSO.groupsClaim]) ? ui[SSO.groupsClaim] : [];
  const role = mapRole(groups);
  if (!role) return null;
  return { sub: String(ui.sub), name: ui.name || ui.preferred_username || ui.email || String(ui.sub), role };
}

// ── 数据面：服务端铸造 brand-service 令牌（scope=BRAND_TENANT）─────────────
// actor 传入登录用户 → 令牌 userId=真实用户，使 RLS 的 app.actor_id 与 audit_logs
// 归因到实际操作者（而非泛化的 brand-console 服务身份）。
function serviceToken(actor?: { userId?: string; role?: string }): string {
  const actorId = actor?.userId && UUID_RE.test(actor.userId) ? actor.userId : DEFAULT_ACTOR_ID;
  return jwt.sign(
    {
      userId: actorId,
      tenantId: BRAND_TENANT,
      role: actor?.role || 'brand_admin',
    },
    SECRET,
    { expiresIn: '5m' },
  );
}

export async function nexus(
  path: string,
  init: RequestInit = {},
  actor?: { userId?: string; role?: string },
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  headers.set('authorization', `Bearer ${serviceToken(actor)}`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BASE}${PREFIX}${path}`, { ...init, headers, signal: ctrl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

interface ProductListQuery { q?: string; page?: number; pageSize?: number }

// 取本品牌产品（含 meta，用于安全合并，避免覆盖 meta.everhot）
export async function listProducts(query: ProductListQuery = {}): Promise<{ items: any[]; total: number; page: number; pageSize: number; pages: number }> {
  const params = new URLSearchParams({
    tenantId: BRAND_TENANT,
    brand: BRAND,
    page: String(query.page || 1),
    pageSize: String(query.pageSize || 25),
  });
  if (query.q?.trim()) params.set('q', query.q.trim());
  const res = await nexus(`/product-catalog/devices?${params.toString()}`);
  if (!res.ok) throw new Error(`list HTTP ${res.status}`);
  const j = await res.json();
  const items = (j.data?.items || []).filter((p: any) => p.brand === BRAND);
  return {
    items,
    total: Number(j.data?.total ?? items.length),
    page: Number(j.data?.page ?? query.page ?? 1),
    pageSize: Number(j.data?.pageSize ?? query.pageSize ?? items.length),
    pages: Number(j.data?.pages ?? 1),
  };
}

export async function getProductBySku(sku: string): Promise<any | null> {
  const { items } = await listProducts({ q: sku, pageSize: 100 });
  return items.find((p) => p.sku === sku) || null;
}

// D2 定位受控词表（供控制台下拉/标签选择器）。失败时回退空词表，不阻断产品加载。
export async function fetchTaxonomy(): Promise<Record<string, { code: string; label: string }[]>> {
  try {
    const res = await nexus('/product-catalog/taxonomy');
    if (!res.ok) return {};
    const j = await res.json();
    return j.data || {};
  } catch {
    return {};
  }
}

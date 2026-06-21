/**
 * SSRF 防护 · 服务端抓取用户提供的 URL 时的安全闸门
 *
 * 威胁: 搭子手抄剪藏/导入等功能让用户提供任意 URL, 服务端去 fetch。若不设防,
 * 攻击者 (尤其外部 partner/contractor) 可借此探测内网:
 *   - 云厂商元数据 169.254.169.254 (窃取临时凭证)
 *   - localhost / 127.0.0.1 / ::1 上的内部服务
 *   - RFC1918 私网 (10/8, 172.16/12, 192.168/16) 与 CGNAT 100.64/10
 *
 * 防护策略 (标准做法):
 *   1. 仅允许 http(s)。
 *   2. 拒绝明显内网主机名 (localhost / *.local / *.internal / 元数据域)。
 *   3. IP 字面量直接按段判定; 域名先 DNS 解析, 任一解析地址落在内网段即拒绝。
 *   4. 抓取时 redirect:'manual', 逐跳重新校验 Location, 防"公网 URL 302 跳内网"。
 *
 * 残留风险: 校验与实际连接之间的 DNS rebinding (TOCTOU) 无法在 undici 层完美钉死,
 * 但"解析校验 + 逐跳重定向校验"已覆盖绝大多数实战利用面。
 */

import { lookup } from 'node:dns/promises';
import net from 'node:net';

/** URL 被判定为指向内网/非法时抛出, 路由据此返回 400 (用户输入错误)。 */
export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
]);

/** 判断一个 IP 字面量是否落在内网/保留/回环/链路本地段 (IPv4 + IPv6)。 */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    if (p[0] === 0) return true; // 0.0.0.0/8 "this network"
    if (p[0] === 10) return true; // 私网
    if (p[0] === 127) return true; // 回环
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 私网
    if (p[0] === 192 && p[1] === 168) return true; // 私网
    if (p[0] === 169 && p[1] === 254) return true; // 链路本地 (含云元数据 169.254.169.254)
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT 100.64/10
    if (p[0] >= 224) return true; // 组播/保留 224.0.0.0+
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // 回环 / 未指定
    if (lower.startsWith('fe80')) return true; // 链路本地
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
    // IPv4-mapped ::ffff:a.b.c.d → 按其 IPv4 判定
    const m = lower.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (m) return isPrivateIp(m[1]);
    return false;
  }
  return true; // 未知格式 → 保守拒绝
}

/**
 * 校验一个 URL 是否安全可抓取 (公网 http(s))。不安全则抛 SsrfBlockedError。
 * 返回规范化后的 URL 对象。
 */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfBlockedError('请输入合法的 http(s) 链接');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new SsrfBlockedError('请输入合法的 http(s) 链接');
  }
  const host = u.hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (!host) throw new SsrfBlockedError('请输入合法的 http(s) 链接');
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    throw new SsrfBlockedError('不允许访问内网地址');
  }

  // IP 字面量: 直接判定
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new SsrfBlockedError('不允许访问内网地址');
    return u;
  }

  // 域名: DNS 解析全部地址, 任一内网即拒绝
  let addrs: Array<{ address: string }>;
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new SsrfBlockedError('无法解析该域名');
  }
  if (addrs.length === 0) throw new SsrfBlockedError('无法解析该域名');
  for (const a of addrs) {
    if (isPrivateIp(a.address)) throw new SsrfBlockedError('不允许访问内网地址');
  }
  return u;
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRedirects?: number;
}

/**
 * 安全抓取: 逐跳校验 (含重定向 Location) 后再 fetch, 防 SSRF。
 * - 每一跳都过 assertPublicHttpUrl
 * - redirect:'manual', 手动跟随并复验, 上限 maxRedirects
 * 抛错语义: SsrfBlockedError → 路由返回 400; 其它 (超时/网络) → 502。
 */
export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? 4;
  const timeoutMs = opts.timeoutMs ?? 12_000;
  let current = raw;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = await assertPublicHttpUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(u.toString(), {
        headers: opts.headers,
        signal: controller.signal,
        redirect: 'manual',
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res; // 无 Location, 交回上层处理
      current = new URL(loc, u).toString(); // 解析相对跳转, 下一轮复验
      continue;
    }
    return res;
  }
  throw new SsrfBlockedError('重定向次数过多');
}

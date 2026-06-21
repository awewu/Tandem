/**
 * SSRF 防护回归测试 — 搭子手抄剪藏/导入抓取用户 URL 的安全闸门。
 * 锁定: 内网/回环/链路本地/元数据 IP 拒绝; 域名解析到内网拒绝; 公网 302 跳内网被逐跳拦截。
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => {
    if (host === 'public.example.com') return [{ address: '93.184.216.34', family: 4 }];
    if (host === 'evil-internal.example.com') return [{ address: '10.0.0.5', family: 4 }];
    // DNS rebinding 式: 一个公网一个内网 → 必须拒绝
    if (host === 'rebind.example.com') {
      return [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }];
    }
    throw new Error('ENOTFOUND');
  }),
}));

import { isPrivateIp, assertPublicHttpUrl, safeFetch, SsrfBlockedError } from '@/lib/infra/ssrf-guard';

describe('isPrivateIp', () => {
  it('内网/回环/链路本地/元数据/保留段 → true', () => {
    for (const ip of [
      '0.0.0.0', '10.0.0.1', '127.0.0.1', '172.16.0.1', '172.31.255.255',
      '192.168.1.1', '169.254.169.254', '100.64.0.1', '224.0.0.1',
      '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1',
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('公网地址 → false', () => {
    for (const ip of [
      '8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1',
      '100.63.255.255', '100.128.0.1', '223.255.255.255', '2606:2800:220:1:248:1893:25c8:1946',
    ]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});

describe('assertPublicHttpUrl', () => {
  it('非 http(s) 协议 → 拒绝', async () => {
    for (const u of ['ftp://x.com', 'file:///etc/passwd', 'gopher://x', 'data:text/html,x']) {
      await expect(assertPublicHttpUrl(u)).rejects.toThrow(SsrfBlockedError);
    }
  });

  it('内网主机名 (localhost/.local/.internal) → 拒绝', async () => {
    for (const u of ['http://localhost/x', 'http://foo.local/', 'http://svc.internal/', 'http://metadata.google.internal/']) {
      await expect(assertPublicHttpUrl(u)).rejects.toThrow(SsrfBlockedError);
    }
  });

  it('内网 IP 字面量 → 拒绝 (无需 DNS)', async () => {
    for (const u of ['http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.1/', 'http://[::1]/', 'http://192.168.0.1/']) {
      await expect(assertPublicHttpUrl(u)).rejects.toThrow(SsrfBlockedError);
    }
  });

  it('公网 IP 字面量 → 放行', async () => {
    const u = await assertPublicHttpUrl('http://8.8.8.8/path');
    expect(u.hostname).toBe('8.8.8.8');
  });

  it('域名解析到公网 → 放行', async () => {
    const u = await assertPublicHttpUrl('https://public.example.com/a');
    expect(u.hostname).toBe('public.example.com');
  });

  it('域名解析到内网 → 拒绝', async () => {
    await expect(assertPublicHttpUrl('http://evil-internal.example.com/')).rejects.toThrow(SsrfBlockedError);
  });

  it('域名多解析含内网 (rebinding 防护) → 拒绝', async () => {
    await expect(assertPublicHttpUrl('http://rebind.example.com/')).rejects.toThrow(SsrfBlockedError);
  });
});

describe('safeFetch 逐跳重定向校验', () => {
  it('公网 URL 302 跳内网元数据 → 拦截 (SsrfBlockedError)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(safeFetch('http://public.example.com')).rejects.toThrow(SsrfBlockedError);
      expect(fetchMock).toHaveBeenCalledTimes(1); // 第二跳在校验阶段被拦, 不会再发起 fetch
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('公网 URL 正常 200 → 透传响应', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('<title>ok</title>', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await safeFetch('http://public.example.com');
      expect(res.status).toBe(200);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

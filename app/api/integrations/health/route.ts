import { NextResponse } from 'next/server';

/**
 * GET /api/integrations/health
 *
 * 一键探测所有外部依赖连通性 (OSS bundle + LLM providers).
 * 用于运维监控 / 部署后烟测.
 */

interface HealthCheck {
  name: string;
  category: 'oss' | 'llm' | 'sso' | 'storage';
  configured: boolean;
  reachable?: boolean;
  latencyMs?: number;
  error?: string;
}

async function ping(url: string, timeoutMs = 3000): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal, method: 'HEAD' });
    clearTimeout(t);
    return { ok: res.ok || res.status < 500, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
  }
}

export async function GET() {
  const checks: HealthCheck[] = [];

  // === LLM ===
  for (const [name, baseUrl, key] of [
    ['DeepSeek', process.env.DEEPSEEK_BASE_URL, process.env.DEEPSEEK_API_KEY],
    ['Qwen', process.env.QWEN_BASE_URL, process.env.QWEN_API_KEY],
    ['Doubao', process.env.DOUBAO_BASE_URL, process.env.DOUBAO_API_KEY],
    ['Kimi', process.env.KIMI_BASE_URL, process.env.KIMI_API_KEY],
    ['Hermes/Ollama', process.env.HERMES_BASE_URL, process.env.HERMES_API_KEY],
  ] as const) {
    if (!baseUrl) {
      checks.push({ name: name as string, category: 'llm', configured: false });
      continue;
    }
    const r = await ping(baseUrl);
    checks.push({
      name: name as string,
      category: 'llm',
      configured: !!key,
      reachable: r.ok,
      latencyMs: r.latencyMs,
      error: r.error,
    });
  }

  // === OSS ===
  const ossTargets = [
    { name: 'Rocket.Chat', url: process.env.ROCKETCHAT_BASE_URL ?? process.env.ROCKETCHAT_URL },
    { name: 'Cal.com', url: process.env.CALCOM_BASE_URL },
    {
      name: 'MinIO',
      url: process.env.MINIO_ENDPOINT
        ? `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT ?? 9000}/minio/health/live`
        : undefined,
    },
  ];

  for (const t of ossTargets) {
    if (!t.url) {
      checks.push({ name: t.name, category: 'oss', configured: false });
      continue;
    }
    const r = await ping(t.url);
    checks.push({
      name: t.name,
      category: 'oss',
      configured: true,
      reachable: r.ok,
      latencyMs: r.latencyMs,
      error: r.error,
    });
  }

  // === Storage ===
  checks.push({
    name: 'PostgreSQL',
    category: 'storage',
    configured: !!process.env.DATABASE_URL,
    // 不探测 (需要 prisma client)
  });

  // === SSO ===
  for (const [name, key] of [
    ['钉钉', process.env.DINGTALK_CLIENT_ID],
    ['企微', process.env.WECOM_CORP_ID],
    ['飞书', process.env.FEISHU_APP_ID],
  ] as const) {
    checks.push({ name, category: 'sso', configured: !!key });
  }

  const summary = {
    total: checks.length,
    configured: checks.filter((c) => c.configured).length,
    reachable: checks.filter((c) => c.reachable).length,
    unreachable: checks.filter((c) => c.configured && c.reachable === false).length,
  };

  return NextResponse.json({ summary, checks });
}

/**
 * 真模型探针 (防假闭环) — learning generate 接真 LLM
 *
 * 默认 skip; 仅当 RUN_LLM_PROBE=1 时跑真网络调用 (消耗 DeepSeek token).
 *   RUN_LLM_PROBE=1 npx vitest run tests/probe/learning-generate.probe.test.ts
 *
 * 不依赖 dotenv: 自行解析 .env.local 取 DEEPSEEK_* 构建真 deepseek-v3 provider 注入.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { TandemRouter, OpenAICompatibleProvider, PROVIDER_CONFIGS } from '@/lib/taf';
import { generateLesson } from '@/lib/learning/generate';
import type { GenerateLessonInput } from '@/lib/learning/types';

function loadEnvLocal(): Record<string, string> {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    const out: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}

const env = loadEnvLocal();
const RUN = process.env.RUN_LLM_PROBE === '1' && !!env.DEEPSEEK_API_KEY;

describe.skipIf(!RUN)('PROBE · learning generate 真 LLM (DeepSeek)', () => {
  it('真模型返回合规课程 (isStub=false, 5 题)', async () => {
    const router = new TandemRouter();
    router.registerProvider(
      new OpenAICompatibleProvider({
        ...PROVIDER_CONFIGS['deepseek-v3'],
        baseUrl: env.DEEPSEEK_BASE_URL || PROVIDER_CONFIGS['deepseek-v3'].baseUrl,
        model: env.DEEPSEEK_MODEL || PROVIDER_CONFIGS['deepseek-v3'].model,
        apiKey: env.DEEPSEEK_API_KEY,
      }),
    );

    const store = {
      memories: {
        get: async () => ({
          title: '客户投诉处理 SOP',
          body: '1. 24h 内首响应. 2. 记录工单. 3. 升级红区需主管签字. 4. 结案后回访.',
          tenantId: 'default',
        }),
      },
      materials: { get: async () => null },
      documents: { get: async () => null },
    } as never;

    const input: GenerateLessonInput = {
      sourceId: 'mem-probe',
      sourceType: 'memory',
      userId: 'probe-user',
      category: 'sop' as never,
    };

    const res = await generateLesson(input, { router, store, tenantId: 'default' });
    // eslint-disable-next-line no-console
    console.log('[probe] isStub=%s model=%s lectureLen=%d', res?.isStub, res?.modelUsed, res?.generated.lecture.length);
    expect(res).not.toBeNull();
    expect(res!.isStub).toBe(false);
    expect(res!.modelUsed).toBeTruthy();
    expect(res!.generated.questions).toHaveLength(5);
    expect(res!.generated.lecture.length).toBeGreaterThan(80);
  }, 60_000);
});

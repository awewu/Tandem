/**
 * WorkspaceManifest 单测 (借鉴 CLAUDE.md / AGENTS.md 的 declarative governance)
 *
 * 覆盖:
 *   1. validateWorkspaceManifest 体积/字段约束
 *   2. getWorkspaceManifest 缺省 → 返回默认 draft, 不入库
 *   3. upsertWorkspaceManifest 创建 + 修改 → 每次回到草稿态 (signed=false)
 *   4. signWorkspaceManifest 双签 (CEO + Steward 各一次 → signed=true)
 *   5. 已签 manifest 修改 → 回到草稿, 需重新双签
 *   6. 已签 manifest 重复签 → throw
 *   7. serializeAsMarkdown 输出格式
 *   8. buildPromptHeader 未签 → 空字符串; 已签 → 包含红线/词典/禁用词
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  getWorkspaceManifest,
  upsertWorkspaceManifest,
  signWorkspaceManifest,
  serializeAsMarkdown,
  buildPromptHeader,
} from '@/lib/persona/workspace-manifest';
import {
  validateWorkspaceManifest,
  WORKSPACE_MANIFEST_MAX_BYTES,
} from '@/lib/types/workspace-manifest';

beforeAll(() => {
  setStore(createInMemoryStore());
});

beforeEach(async () => {
  const store = getStore();
  for (const m of await store.workspaceManifests.list()) {
    await store.workspaceManifests.delete(m.id);
  }
});

const TENANT = 'tenant_acme';

// ---------------------------------------------------------------------------
// 1. validate
// ---------------------------------------------------------------------------

describe('validateWorkspaceManifest', () => {
  it('空 workspaceName → 错', () => {
    expect(validateWorkspaceManifest({ workspaceName: '' })).toMatch(/workspaceName/);
  });

  it('workspaceName > 50 字 → 错', () => {
    expect(validateWorkspaceManifest({ workspaceName: 'x'.repeat(51) })).toMatch(/50/);
  });

  it('workspaceOverview > 500 字 → 错', () => {
    expect(
      validateWorkspaceManifest({ workspaceName: 'OK', workspaceOverview: 'x'.repeat(501) }),
    ).toMatch(/500/);
  });

  it('okrCycleLengthMonths 不在 1/3/6/12 → 错', () => {
    expect(
      validateWorkspaceManifest({ workspaceName: 'OK', okrCycleLengthMonths: 5 as never }),
    ).toMatch(/1\/3\/6\/12/);
  });

  it('redlines > 20 条 → 错', () => {
    expect(
      validateWorkspaceManifest({
        workspaceName: 'OK',
        redlines: Array.from({ length: 21 }, (_, i) => ({
          id: `r${i}`,
          title: `r${i}`,
          rationale: 'x',
          triggers: [],
          verdict: 'SOFT_WARN' as const,
        })),
      }),
    ).toMatch(/20/);
  });

  it('redline verdict 不在 HARD_BLOCK/SOFT_WARN → 错', () => {
    expect(
      validateWorkspaceManifest({
        workspaceName: 'OK',
        redlines: [
          { id: 'r1', title: 'r1', rationale: 'x', triggers: [], verdict: 'WHATEVER' as never },
        ],
      }),
    ).toMatch(/verdict/);
  });

  it('vocab > 50 条 → 错', () => {
    expect(
      validateWorkspaceManifest({
        workspaceName: 'OK',
        vocab: Array.from({ length: 51 }, (_, i) => ({ term: `t${i}`, translation: 't' })),
      }),
    ).toMatch(/50/);
  });

  it('forbiddenWords > 30 条 → 错', () => {
    expect(
      validateWorkspaceManifest({
        workspaceName: 'OK',
        personaStyle: {
          defaultTone: 'partner',
          verbosity: 'balanced',
          forbiddenWords: Array.from({ length: 31 }, (_, i) => `w${i}`),
        },
      }),
    ).toMatch(/30/);
  });

  it('体积 > 8KB → 错', () => {
    const big = {
      workspaceName: 'OK',
      workspaceOverview: 'x'.repeat(400),
      vocab: Array.from({ length: 50 }, (_, i) => ({
        term: `term_${i}_${'y'.repeat(100)}`,
        translation: 'z'.repeat(100),
      })),
    };
    const err = validateWorkspaceManifest(big);
    expect(err).toBeTruthy();
    // 验证 体积 触发, 不是其他规则
    expect(err).toMatch(/体积|8192/);
  });

  it('合法 manifest → null', () => {
    expect(
      validateWorkspaceManifest({
        workspaceName: '事半',
        workspaceOverview: '中国民企 OKR 协作 OS',
        okrCycleLengthMonths: 3,
        redlines: [
          {
            id: 'no-cust-data-to-third-party',
            title: '客户数据绝不外发',
            rationale: '签 NDA 客户的所有数据不得离开 Tandem',
            triggers: ['客户名单', 'NDA'],
            verdict: 'HARD_BLOCK',
          },
        ],
        vocab: [{ term: 'PE', translation: 'Product Engineer' }],
        cultureTags: ['扁平', '结果导向'],
      }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2-3. get / upsert
// ---------------------------------------------------------------------------

describe('getWorkspaceManifest', () => {
  it('不存在 → 返回默认 draft (signed=false), 不入库', async () => {
    const m = await getWorkspaceManifest(TENANT);
    expect(m.signed).toBe(false);
    expect(m.workspaceName).toBe('未命名工作区');
    expect(m.tenantId).toBe(TENANT);
    // 不入库验证
    const all = await getStore().workspaceManifests.list();
    expect(all).toHaveLength(0);
  });
});

describe('upsertWorkspaceManifest', () => {
  it('首次 upsert → 创建 + signed=false', async () => {
    const m = await upsertWorkspaceManifest({
      tenantId: TENANT,
      patch: { workspaceName: '事半' },
      updatedBy: 'u_ceo',
    });
    expect(m.workspaceName).toBe('事半');
    expect(m.signed).toBe(false);
    expect(m.updatedBy).toBe('u_ceo');
  });

  it('再次 upsert → 更新 + signed 仍 false', async () => {
    await upsertWorkspaceManifest({
      tenantId: TENANT,
      patch: { workspaceName: 'v1' },
      updatedBy: 'u_ceo',
    });
    const m = await upsertWorkspaceManifest({
      tenantId: TENANT,
      patch: { workspaceName: 'v2', cultureTags: ['扁平'] },
      updatedBy: 'u_ceo',
    });
    expect(m.workspaceName).toBe('v2');
    expect(m.cultureTags).toEqual(['扁平']);
    expect(m.signed).toBe(false);
  });

  it('validation 失败 → throw', async () => {
    await expect(
      upsertWorkspaceManifest({
        tenantId: TENANT,
        patch: { workspaceName: 'x'.repeat(51) },
        updatedBy: 'u_ceo',
      }),
    ).rejects.toThrow(/50|validation/i);
  });
});

// ---------------------------------------------------------------------------
// 4-6. sign / unsign-on-modify
// ---------------------------------------------------------------------------

describe('signWorkspaceManifest', () => {
  it('单签 (仅 CEO) → signed 仍 false', async () => {
    await upsertWorkspaceManifest({
      tenantId: TENANT,
      patch: { workspaceName: '事半' },
      updatedBy: 'u_ceo',
    });
    const after = await signWorkspaceManifest(TENANT, 'u_ceo', 'ceo');
    expect(after.signed).toBe(false);
    expect(after.signedByCeo?.userId).toBe('u_ceo');
    expect(after.signedBySteward).toBeUndefined();
  });

  it('双签 (CEO + Steward) → signed=true', async () => {
    await upsertWorkspaceManifest({
      tenantId: TENANT,
      patch: { workspaceName: '事半' },
      updatedBy: 'u_ceo',
    });
    await signWorkspaceManifest(TENANT, 'u_ceo', 'ceo');
    const after = await signWorkspaceManifest(TENANT, 'u_steward', 'steward');
    expect(after.signed).toBe(true);
    expect(after.signedByCeo?.userId).toBe('u_ceo');
    expect(after.signedBySteward?.userId).toBe('u_steward');
  });

  it('已签后修改 → 回到草稿态 (signed=false, 双签清空)', async () => {
    await upsertWorkspaceManifest({
      tenantId: TENANT,
      patch: { workspaceName: '事半' },
      updatedBy: 'u_ceo',
    });
    await signWorkspaceManifest(TENANT, 'u_ceo', 'ceo');
    await signWorkspaceManifest(TENANT, 'u_steward', 'steward');

    const modified = await upsertWorkspaceManifest({
      tenantId: TENANT,
      patch: { cultureTags: ['新增'] },
      updatedBy: 'u_ceo',
    });
    expect(modified.signed).toBe(false);
    expect(modified.signedByCeo).toBeUndefined();
    expect(modified.signedBySteward).toBeUndefined();
  });

  it('已双签的 manifest 再签 → throw', async () => {
    await upsertWorkspaceManifest({
      tenantId: TENANT,
      patch: { workspaceName: '事半' },
      updatedBy: 'u_ceo',
    });
    await signWorkspaceManifest(TENANT, 'u_ceo', 'ceo');
    await signWorkspaceManifest(TENANT, 'u_steward', 'steward');

    await expect(signWorkspaceManifest(TENANT, 'u_ceo', 'ceo')).rejects.toThrow(/already/);
  });

  it('不存在的 manifest → throw', async () => {
    await expect(signWorkspaceManifest('nonexistent', 'u_ceo', 'ceo')).rejects.toThrow(/No manifest/);
  });
});

// ---------------------------------------------------------------------------
// 7. serialize
// ---------------------------------------------------------------------------

describe('serializeAsMarkdown', () => {
  it('草稿 manifest → 顶部 ⚠️ 标记', async () => {
    const m = await upsertWorkspaceManifest({
      tenantId: TENANT,
      patch: { workspaceName: '事半', workspaceOverview: '一句话概述' },
      updatedBy: 'u_ceo',
    });
    const md = serializeAsMarkdown(m);
    expect(md).toMatch(/^# 事半/m);
    expect(md).toMatch(/⚠️ 草稿/);
    expect(md).toMatch(/一句话概述/);
    expect(md).toMatch(/cycle 长度: 3 个月/);
  });

  it('已签 manifest → ✅ 标记 + 双签留痕', async () => {
    await upsertWorkspaceManifest({
      tenantId: TENANT,
      patch: {
        workspaceName: '事半',
        redlines: [
          {
            id: 'r1',
            title: '客户数据红线',
            rationale: '不外发',
            triggers: ['客户名单'],
            verdict: 'HARD_BLOCK',
          },
        ],
      },
      updatedBy: 'u_ceo',
    });
    await signWorkspaceManifest(TENANT, 'u_ceo', 'ceo');
    const m = await signWorkspaceManifest(TENANT, 'u_steward', 'steward');

    const md = serializeAsMarkdown(m);
    expect(md).toMatch(/✅ 已双签生效/);
    expect(md).toMatch(/客户数据红线/);
    expect(md).toMatch(/HARD_BLOCK/);
    expect(md).toMatch(/u_ceo/);
    expect(md).toMatch(/u_steward/);
  });
});

// ---------------------------------------------------------------------------
// 8. buildPromptHeader
// ---------------------------------------------------------------------------

describe('buildPromptHeader', () => {
  it('未签 manifest → 空字符串 (避免未审上下文污染 Persona)', async () => {
    const m = await upsertWorkspaceManifest({
      tenantId: TENANT,
      patch: { workspaceName: '事半', workspaceOverview: '应该不被注入' },
      updatedBy: 'u_ceo',
    });
    expect(buildPromptHeader(m)).toBe('');
  });

  it('已签 → 拼出 workspaceName + 红线 + 词典 + 禁用词', async () => {
    await upsertWorkspaceManifest({
      tenantId: TENANT,
      patch: {
        workspaceName: '事半',
        workspaceOverview: '中国民企 OKR 协作 OS',
        redlines: [
          {
            id: 'r1',
            title: '客户数据红线',
            rationale: 'NDA 客户数据不得离开',
            triggers: [],
            verdict: 'HARD_BLOCK',
          },
        ],
        vocab: [{ term: 'PE', translation: 'Product Engineer' }],
        personaStyle: {
          defaultTone: 'partner',
          verbosity: 'concise',
          forbiddenWords: ['亲', '宝'],
        },
        cultureTags: ['扁平', '结果导向'],
      },
      updatedBy: 'u_ceo',
    });
    await signWorkspaceManifest(TENANT, 'u_ceo', 'ceo');
    const m = await signWorkspaceManifest(TENANT, 'u_steward', 'steward');

    const header = buildPromptHeader(m);
    expect(header).toMatch(/事半/);
    expect(header).toMatch(/客户数据红线/);
    expect(header).toMatch(/HARD_BLOCK/);
    expect(header).toMatch(/PE=Product Engineer/);
    expect(header).toMatch(/亲, 宝/);
    expect(header).toMatch(/concise/);
    expect(header).toMatch(/扁平, 结果导向/);
  });
});

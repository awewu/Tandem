/**
 * WorkspaceManifest Service · 读 / 写 / 双签 / 序列化为 markdown
 *
 * 设计原则:
 *   1. **未签的 manifest 不注入 Persona prompt** (避免未审上下文污染)
 *   2. **修改后回到草稿态**, 必须 CEO + Steward 重新双签
 *   3. 提供 `serializeAsMarkdown` 让客户能直接 export `tandem.workspace.md` (借鉴 CLAUDE.md)
 *   4. 提供 `buildPromptHeader` 给 lib/persona/company-brain.ts 调用, 拼到 system prompt 头部
 */

import { getStore, generateId } from '../storage/repository';
import {
  type WorkspaceManifest,
  DEFAULT_WORKSPACE_MANIFEST,
  validateWorkspaceManifest,
} from '../types/workspace-manifest';

// ---------------------------------------------------------------------------
// 读
// ---------------------------------------------------------------------------

/** 读取 tenant 的 manifest (不存在则返回默认 draft, 不抛错) */
export async function getWorkspaceManifest(tenantId: string): Promise<WorkspaceManifest> {
  const store = getStore();
  const all = await store.workspaceManifests.list();
  const existing = all.find((m) => m.tenantId === tenantId);
  if (existing) return existing;

  // 不存在: 返回默认 draft (但不入库, 写时才创建)
  const now = new Date().toISOString();
  return {
    id: `manifest_${tenantId}_default`,
    tenantId,
    ...DEFAULT_WORKSPACE_MANIFEST,
    updatedBy: 'system',
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// 写 (任何改动都把 signed 重置为 false, 需要重新双签)
// ---------------------------------------------------------------------------

export interface UpsertManifestInput {
  tenantId: string;
  patch: Partial<
    Omit<WorkspaceManifest, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'signed' | 'signedByCeo' | 'signedBySteward'>
  >;
  updatedBy: string;
}

export async function upsertWorkspaceManifest(input: UpsertManifestInput): Promise<WorkspaceManifest> {
  const store = getStore();
  const all = await store.workspaceManifests.list();
  const existing = all.find((m) => m.tenantId === input.tenantId);
  const now = new Date().toISOString();

  const merged: Partial<WorkspaceManifest> = {
    ...(existing ?? { ...DEFAULT_WORKSPACE_MANIFEST, tenantId: input.tenantId }),
    ...input.patch,
    updatedBy: input.updatedBy,
    updatedAt: now,
    // 关键: 任何修改都回到 draft 状态
    signed: false,
    signedByCeo: undefined,
    signedBySteward: undefined,
  };

  const validationError = validateWorkspaceManifest(merged);
  if (validationError) throw new Error(`Manifest validation failed: ${validationError}`);

  if (existing) {
    return await store.workspaceManifests.update(existing.id, merged);
  }

  const created = await store.workspaceManifests.create({
    id: `manifest_${input.tenantId}_${generateId('m')}`,
    tenantId: input.tenantId,
    ...DEFAULT_WORKSPACE_MANIFEST,
    ...input.patch,
    signed: false,
    updatedBy: input.updatedBy,
    createdAt: now,
    updatedAt: now,
  } as WorkspaceManifest);
  return created;
}

// ---------------------------------------------------------------------------
// 双签 (CEO + Steward 各签一次, 第二个签字后 signed=true)
// ---------------------------------------------------------------------------

export type SignerRole = 'ceo' | 'steward';

export async function signWorkspaceManifest(
  tenantId: string,
  signerId: string,
  role: SignerRole,
): Promise<WorkspaceManifest> {
  const store = getStore();
  const all = await store.workspaceManifests.list();
  const existing = all.find((m) => m.tenantId === tenantId);
  if (!existing) throw new Error(`No manifest exists for tenant ${tenantId}; upsert first`);
  if (existing.signed) throw new Error('Manifest already fully signed; modify first to re-sign');

  const now = new Date().toISOString();
  const patch: Partial<WorkspaceManifest> = {};
  if (role === 'ceo') patch.signedByCeo = { userId: signerId, signedAt: now };
  if (role === 'steward') patch.signedBySteward = { userId: signerId, signedAt: now };

  const updated = await store.workspaceManifests.update(existing.id, patch);

  // 检查是否双签齐了
  if (updated.signedByCeo && updated.signedBySteward) {
    return await store.workspaceManifests.update(existing.id, { signed: true });
  }
  return updated;
}

// ---------------------------------------------------------------------------
// 序列化为 markdown (export tandem.workspace.md)
// ---------------------------------------------------------------------------

export function serializeAsMarkdown(m: WorkspaceManifest): string {
  const lines: string[] = [];
  lines.push(`# ${m.workspaceName}`);
  lines.push('');
  lines.push(`> tandem.workspace.md · schemaVersion ${m.schemaVersion} · ${m.signed ? '✅ 已双签生效' : '⚠️ 草稿 (未双签, 不注入 Persona)'}`);
  lines.push(`> updatedAt ${m.updatedAt} · updatedBy ${m.updatedBy}`);
  lines.push('');
  if (m.workspaceOverview) {
    lines.push('## 公司概述');
    lines.push('');
    lines.push(m.workspaceOverview);
    lines.push('');
  }
  lines.push('## OKR 配置');
  lines.push('');
  lines.push(`- cycle 长度: ${m.okrCycleLengthMonths} 个月`);
  if (m.okrNamingConvention) lines.push(`- 命名规范: \`${m.okrNamingConvention}\``);
  lines.push('');
  if (m.redlines.length > 0) {
    lines.push('## 公司红线 (Tandem 4 件不变量之外)');
    lines.push('');
    for (const r of m.redlines) {
      lines.push(`### ${r.title} (\`${r.id}\`, ${r.verdict})`);
      lines.push('');
      lines.push(r.rationale);
      if (r.triggers.length > 0) {
        lines.push('');
        lines.push(`触发词: ${r.triggers.map((t) => `\`${t}\``).join(', ')}`);
      }
      lines.push('');
    }
  }
  if (m.vocab.length > 0) {
    lines.push('## 公司黑话词典');
    lines.push('');
    for (const v of m.vocab) {
      lines.push(`- **${v.term}** → ${v.translation}`);
    }
    lines.push('');
  }
  lines.push('## Persona 风格');
  lines.push('');
  lines.push(`- 默认语气: ${m.personaStyle.defaultTone}`);
  lines.push(`- 输出长度: ${m.personaStyle.verbosity}`);
  if (m.personaStyle.forbiddenWords.length > 0) {
    lines.push(`- 禁用词: ${m.personaStyle.forbiddenWords.map((w) => `"${w}"`).join(', ')}`);
  }
  lines.push('');
  if (m.cultureTags.length > 0) {
    lines.push('## 文化标签');
    lines.push('');
    lines.push(m.cultureTags.map((t) => `\`${t}\``).join(' · '));
    lines.push('');
  }
  if (m.signed) {
    lines.push('---');
    lines.push('');
    lines.push('## 双签留痕');
    lines.push('');
    if (m.signedByCeo) lines.push(`- CEO: ${m.signedByCeo.userId} · ${m.signedByCeo.signedAt}`);
    if (m.signedBySteward) lines.push(`- Steward: ${m.signedBySteward.userId} · ${m.signedBySteward.signedAt}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 给 Persona prompt 提供 header (仅当 signed=true 才注入)
// ---------------------------------------------------------------------------

/**
 * 拼 Persona system prompt 头部. 未签 → 返回空字符串.
 * 调用方: lib/persona/company-brain.ts buildBaseSystemPrompt
 */
export function buildPromptHeader(m: WorkspaceManifest): string {
  if (!m.signed) return '';
  const parts: string[] = [];
  parts.push(`你正在为 **${m.workspaceName}** 工作.`);
  if (m.workspaceOverview) parts.push(`公司概述: ${m.workspaceOverview}`);
  if (m.redlines.length > 0) {
    parts.push('公司层私有红线 (除 Tandem 默认 4 件不变量之外, 必须遵守):');
    for (const r of m.redlines) {
      parts.push(`  - [${r.verdict}] ${r.title}: ${r.rationale}`);
    }
  }
  if (m.vocab.length > 0) {
    parts.push(`公司黑话词典: ${m.vocab.map((v) => `${v.term}=${v.translation}`).join('; ')}`);
  }
  if (m.personaStyle.forbiddenWords.length > 0) {
    parts.push(`禁用词 (绝不出现在输出中): ${m.personaStyle.forbiddenWords.join(', ')}`);
  }
  parts.push(`默认输出风格: ${m.personaStyle.verbosity}, 语气 ${m.personaStyle.defaultTone}.`);
  if (m.cultureTags.length > 0) {
    parts.push(`文化倾向 (低权重 hint): ${m.cultureTags.join(', ')}.`);
  }
  return parts.join('\n');
}

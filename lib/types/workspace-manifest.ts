/**
 * WorkspaceManifest · tandem.workspace.md (declarative governance layer)
 *
 * 借鉴 Claude Code 的 CLAUDE.md / OpenAI Codex 的 AGENTS.md:
 *   - 每个 workspace 一份, declares 公司层的 "我们的 Tandem 长这样"
 *   - AI Persona 每次会话**先读 manifest, 再拼动态 context (OKR/Memory)**
 *   - 客户 onboarding 时 /tandem init AI 自起草 → CEO+Steward 签字落地
 *
 * **manifest 是 declarative governance, 不是 state**:
 *   - 真状态 (OKR/议事/Memory) 仍在 DB + 三级签批
 *   - manifest 只描述"规则 / 词表 / 红线 / Persona 风格"
 *
 * 体积约束: 整体序列化后 ≤ 200 行 markdown / ≤ 8KB JSON (借鉴 CLAUDE.md ≤ 200 行经验,
 * 多了 LLM 反被忽略).
 */

export type CycleLengthMonths = 1 | 3 | 6 | 12;

export interface WorkspaceManifestRedline {
  /** 唯一标识 (slug, e.g. 'no-cust-data-to-llm') */
  id: string;
  /** 人读标题, ≤ 50 字 */
  title: string;
  /** 详细说明, ≤ 500 字 */
  rationale: string;
  /** 触发场景 keyword (用于 Skill Gateway baseline-guard 匹配) */
  triggers: string[];
  /** 违反时的 verdict */
  verdict: 'HARD_BLOCK' | 'SOFT_WARN';
}

export interface WorkspaceManifestVocab {
  /** 公司内部黑话 → 标准翻译 (e.g. "PE" → "Product Engineer") */
  term: string;
  translation: string;
}

export interface WorkspaceManifestPersonaStyle {
  /** 默认 Persona 语气 token (映射到 lib/persona/stage-meta TONE_TOKENS) */
  defaultTone: string;
  /** 禁用词 (出现即 redact, e.g. 公司不希望 Persona 说"亲" "宝") */
  forbiddenWords: string[];
  /** 默认输出长度偏好 */
  verbosity: 'concise' | 'balanced' | 'detailed';
}

export interface WorkspaceManifest {
  id: string;
  tenantId: string;

  /** schema 版本 (允许后续不破坏地扩展) */
  schemaVersion: number;

  /** 公司展示名 (用于 Persona prompt 头部) */
  workspaceName: string;

  /** 1 段公司业务 / 战略概述 (≤ 500 字), 注入 Persona system prompt */
  workspaceOverview: string;

  /** OKR cycle 长度 (默认 3 = 季度制) */
  okrCycleLengthMonths: CycleLengthMonths;

  /** OKR 命名规范 (例: "O1 / KR1.1") */
  okrNamingConvention?: string;

  /** 公司层私有红线 (Tandem 默认 4 件不变量之外的) */
  redlines: WorkspaceManifestRedline[];

  /** 公司黑话词典 (LLM 看了避免误解) */
  vocab: WorkspaceManifestVocab[];

  /** Persona 默认风格 */
  personaStyle: WorkspaceManifestPersonaStyle;

  /**
   * 文化标签 (低权重 hint, Persona prompt 末尾追加).
   * 例: ["扁平", "结果导向", "周报零容忍"]
   */
  cultureTags: string[];

  /**
   * 是否已被 CEO + Steward 双签 (governance lock).
   * false → manifest 视为 draft, 不注入 Persona prompt (避免未审 manifest 污染上下文).
   * true  → manifest 进入"已签生效"状态, 注入 prompt, 修改需重新双签.
   */
  signed: boolean;
  signedByCeo?: { userId: string; signedAt: string };
  signedBySteward?: { userId: string; signedAt: string };

  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 新 workspace 默认 manifest (草稿状态) */
export const DEFAULT_WORKSPACE_MANIFEST: Omit<
  WorkspaceManifest,
  'id' | 'tenantId' | 'updatedBy' | 'createdAt' | 'updatedAt' | 'signedByCeo' | 'signedBySteward'
> = {
  schemaVersion: 1,
  workspaceName: '未命名工作区',
  workspaceOverview: '',
  okrCycleLengthMonths: 3,
  okrNamingConvention: 'O{n} / KR{n}.{m}',
  redlines: [],
  vocab: [],
  personaStyle: {
    defaultTone: 'partner', // 映射到 STAGE_META.partner
    forbiddenWords: [],
    verbosity: 'balanced',
  },
  cultureTags: [],
  signed: false,
};

/**
 * manifest 体积上限 (避免拼装 Persona prompt 时拖慢 + 浪费 token).
 * 序列化后 (JSON.stringify) 字节数, 超出拒绝保存.
 */
export const WORKSPACE_MANIFEST_MAX_BYTES = 8192;

/**
 * 校验 manifest 是否符合保存条件.
 * 返回 null = 合法; 返回字符串 = 错误原因.
 */
export function validateWorkspaceManifest(m: Partial<WorkspaceManifest>): string | null {
  if (!m.workspaceName || m.workspaceName.length === 0) return 'workspaceName 不能为空';
  if (m.workspaceName.length > 50) return 'workspaceName 不能超过 50 字';
  if (m.workspaceOverview && m.workspaceOverview.length > 500) return 'workspaceOverview 不能超过 500 字';
  if (m.okrCycleLengthMonths && ![1, 3, 6, 12].includes(m.okrCycleLengthMonths)) {
    return 'okrCycleLengthMonths 必须是 1/3/6/12';
  }
  if (m.redlines) {
    if (m.redlines.length > 20) return 'redlines 不能超过 20 条 (体积上限)';
    for (const r of m.redlines) {
      if (!r.id || !r.title) return 'redline 必须有 id 和 title';
      if (r.title.length > 50) return `redline ${r.id} title 不能超过 50 字`;
      if (r.rationale && r.rationale.length > 500) return `redline ${r.id} rationale 不能超过 500 字`;
      if (!['HARD_BLOCK', 'SOFT_WARN'].includes(r.verdict)) {
        return `redline ${r.id} verdict 必须是 HARD_BLOCK 或 SOFT_WARN`;
      }
    }
  }
  if (m.vocab && m.vocab.length > 50) return 'vocab 不能超过 50 条';
  if (m.cultureTags && m.cultureTags.length > 10) return 'cultureTags 不能超过 10 条';
  if (m.personaStyle?.forbiddenWords && m.personaStyle.forbiddenWords.length > 30) {
    return 'forbiddenWords 不能超过 30 条';
  }

  // 体积上限
  try {
    const size = new TextEncoder().encode(JSON.stringify(m)).length;
    if (size > WORKSPACE_MANIFEST_MAX_BYTES) {
      return `manifest 体积 ${size} 字节超出上限 ${WORKSPACE_MANIFEST_MAX_BYTES}`;
    }
  } catch {
    return 'manifest 无法序列化';
  }
  return null;
}

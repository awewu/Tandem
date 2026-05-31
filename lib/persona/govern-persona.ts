/**
 * Govern Persona · 搭子受控统一卡点 (MANIFESTO §19.5)
 *
 * 企业级 Tandem 对个人"搭子"(persona) 的唯一管控入口。任何 persona 的对外
 * 产出, 生效前必须穿过本卡点 — 4 道闸 + 企业基线强制注入, 无旁路。
 *
 * 注入优先级 (高 → 低, Owner 2026-05-31 裁定):
 *   L0 企业战略红线  — HARD_BLOCK 一票否决 (命中即转人工, 不进 LLM)
 *   L1 组织记忆基线  — company/dept Memory (baseline-guard)
 *   L2 OKR 锚        — 服务哪个 KR
 *   L4 员工价值观锚  — 个人不可妥协原则 (仅在不撞红线时优先于企业"建议")
 *   L3/L5 代行边界 + 风格 — 由调用方的 basePersonaPrompt 携带
 *
 * 冲突裁决: 企业红线 > 个人价值观锚 (红线不可破); 非红线尊重个人。
 *
 * 用法 (所有 persona LLM 调用统一走这里):
 *   const gov = await governPersonaOutput({ actorUserId, intent, basePersonaPrompt });
 *   if (!gov.allowed) { 转人工(gov.blockReason); return; }
 *   router.chatStream({ messages: [{role:'system', content: gov.systemPrompt}, ...] })
 */

import type { BaselineVerdict } from '../memory/baseline-guard';

export interface GovernPersonaInput {
  /** 搭子关联的员工 userId */
  actorUserId: string;
  /** 本次意图 / 用户输入 (用于基线召回 + drift 检测) */
  intent: string;
  /** 调用方提供的 persona 自有 prompt (身份/阶段/代行边界 L3 + 风格画像 L5) */
  basePersonaPrompt: string;
  /** persona | autonomous | skill, 默认 persona */
  agentKind?: 'persona' | 'autonomous' | 'skill';
  /** 候选 skill/工具名, 用于审计 */
  toolName?: string;
  /** 是否注入 OKR 锚 (默认 true) */
  injectOkr?: boolean;
}

export interface GovernPersonaResult {
  /** false = 命中企业红线 HARD_BLOCK, 调用方不得调 LLM, 应转人工 */
  allowed: boolean;
  verdict: BaselineVerdict;
  /** allowed=false 时的阻断原因 (人类可读) */
  blockReason?: string;
  /** allowed=true 时: 企业基线已按 L0-L5 优先级注入的 system prompt */
  systemPrompt: string;
  /** 命中的组织记忆 (审计用) */
  hits: Array<{ memoryId: string; title: string; ownershipLevel: string; similarity: number }>;
  /** baseline-guard checkId, 串联审计 */
  checkId: string;
  warnings: string[];
}

/**
 * 统一管控 + 企业基线注入。永不抛错 (fail-soft): 闸内部失败时降级放行,
 * 但 HARD_BLOCK 一旦命中绝不放行 (红线优先于可用性)。
 */
export async function governPersonaOutput(
  input: GovernPersonaInput,
): Promise<GovernPersonaResult> {
  const warnings: string[] = [];
  const injectOkr = input.injectOkr ?? true;

  // ── 闸① Baseline-Guard (L0 红线 / L1 组织基线) ──────────────────────
  let verdict: BaselineVerdict = 'PASS';
  let baselineContext = '';
  let hits: GovernPersonaResult['hits'] = [];
  let checkId = '';
  try {
    const { checkBaseline } = await import('../memory/baseline-guard');
    const guard = await checkBaseline({
      intent: input.intent,
      actorUserId: input.actorUserId,
      agentKind: input.agentKind ?? 'persona',
      toolName: input.toolName,
    });
    verdict = guard.verdict;
    checkId = guard.checkId;
    hits = guard.hits.map((h) => ({
      memoryId: h.memoryId,
      title: h.title,
      ownershipLevel: h.ownershipLevel,
      similarity: h.similarity,
    }));

    // L0 红线: HARD_BLOCK 一票否决, 不进 LLM
    if (guard.verdict === 'HARD_BLOCK') {
      return {
        allowed: false,
        verdict,
        blockReason:
          `命中企业红线/组织记忆基线, 已转人工: ${guard.reasons.join('; ')}` +
          (hits.length ? ` (命中: ${hits.slice(0, 3).map((h) => h.title).join(', ')})` : ''),
        systemPrompt: '',
        hits,
        checkId,
        warnings,
      };
    }

    // L1: SOFT_WARN 注入组织基线上下文
    if (guard.verdict === 'SOFT_WARN' && guard.contextToInject) {
      baselineContext = guard.contextToInject;
      warnings.push(`已注入 ${guard.hits.length} 条组织记忆作为基线 (checkId: ${guard.checkId})`);
    }
  } catch (err) {
    // 基线闸失败 fail-soft 放行 (但记 warning, 供审计排查)
    warnings.push(`baseline-guard 失败 (fail-soft 放行): ${(err as Error).message}`);
  }

  // ── L2 OKR 锚 ───────────────────────────────────────────────────────
  let okrContext = '';
  if (injectOkr) {
    try {
      const { buildOkrAnchorContext } = await import('./company-brain');
      okrContext = await buildOkrAnchorContext();
    } catch (err) {
      warnings.push(`OKR 锚注入失败 (fail-soft): ${(err as Error).message}`);
    }
  }

  // ── L4 员工价值观锚 ─────────────────────────────────────────────────
  let constitutionSegment = '';
  try {
    const { loadActiveRules, getConstitutionPromptSegment } = await import('./constitution');
    const rules = await loadActiveRules(input.actorUserId);
    constitutionSegment = getConstitutionPromptSegment(rules);
    if (constitutionSegment) warnings.push(`已注入 ${rules.length} 条员工价值观锚`);
  } catch (err) {
    warnings.push(`价值观锚加载失败 (fail-soft): ${(err as Error).message}`);
  }

  // ── 按 L0-L5 优先级组装 (企业基线在最前 = 最高优先级) ─────────────────
  const segments: string[] = [
    '【企业受控声明 · MANIFESTO §19.5】',
    '你是员工的 AI 分身(搭子), 在企业 Tandem 的方向盘下工作。以下企业基线优先于你的个人设定; 与企业红线冲突时一律以企业为准, 个人偏好不能解除企业红线。',
  ];
  if (baselineContext) segments.push(`\n---\n${baselineContext}`);
  if (okrContext) segments.push(`\n---\n【OKR 锚 · 任何产出应回答"服务哪个 KR"】\n${okrContext}`);
  if (constitutionSegment) segments.push(`\n---\n${constitutionSegment}`);
  segments.push(`\n---\n${input.basePersonaPrompt}`);

  return {
    allowed: true,
    verdict,
    systemPrompt: segments.join('\n'),
    hits,
    checkId,
    warnings,
  };
}

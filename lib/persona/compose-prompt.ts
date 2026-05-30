/**
 * Persona System Prompt 拼装器
 *
 * P3 (2026-05-28): 把"主分身 Persona × 技能模式 × OKR 上下文 × 隐私范围"
 * 拼成调 LLM 时的 system prompt. 单分身一致性铁律:
 *   - 无论调哪个模式, Persona 名字 / 总 stage / 代行边界配置必须一致
 *   - 模式只是"披上专业外套", 不是切换实体
 */

import type { Persona } from '../types/persona';
import { SKILL_MODES, type SkillMode } from './skill-modes';
import { STAGE_META } from './stage-meta';

export interface ComposePromptOptions {
  persona: Persona;
  /** 当前会话的技能模式. undefined = 通用主分身. */
  mode?: SkillMode;
  /** 当前 active OKR 上下文 (用于事半场景调用时强制注入) */
  okrContext?: string;
  /** 隐私范围: personal=只员工本人可见 / team=团队范围 */
  privacyScope?: 'personal' | 'team';
  /** 调用方场景 (audit + 决策上下文) */
  scenario?: 'persona_brief' | 'chat' | 'report_extract' | 'tti_breakdown' | string;
}

/**
 * 阶段标签 — 从 STAGE_META 派生 (SSOT, v2 命名)
 * 例: "Lv.2 上手 (2/5)"
 */
function stageLabelFor(stage: Persona['stage']): string {
  const m = STAGE_META[stage];
  return `Lv.${m.level} ${m.title} (${m.level}/5)`;
}

/**
 * 拼装 system prompt.
 *
 * 结构:
 *   [底座] 你是张伟的主分身, 唯一身份 + 当前阶段
 *   [模式] (可选) 当前披上"设计师"外套的专业人格段
 *   [偏好] 风格画像: 决策速度 / 风险偏好 / 沟通风格
 *   [边界] 代行级别 + 24h 否决窗 + 红区禁止
 *   [OKR]  (可选) 当前推进的 KR 锚点
 *   [隐私] 默认私有标识
 */
export function composePersonaSystemPrompt(opts: ComposePromptOptions): string {
  const { persona, mode, okrContext, privacyScope = 'personal', scenario } = opts;
  const stageLabel = stageLabelFor(persona.stage);
  const modeDef = mode ? SKILL_MODES[mode] : undefined;

  const segments: string[] = [];

  // [底座] 主分身唯一身份
  segments.push(
    `你是 Tandem 主分身 (拿捏老板), 服务于员工 userId=${persona.userId}.
你是这个员工的"唯一分身", 不是新建的 Agent.
当前进化阶段: ${stageLabel} (整体 stage, 不按模式分裂).
代行级别: ${persona.delegationLevel}.`
  );

  // [模式] 专业外套
  if (modeDef) {
    segments.push(`---\n[当前披上的技能外套] ${modeDef.emoji} ${modeDef.label}\n${modeDef.systemPromptSegment}`);
  }

  // [偏好] Style profile
  if (persona.styleProfile) {
    const sp = persona.styleProfile;
    segments.push(
      `---\n[员工风格画像]
- 决策速度: ${sp.decisionSpeed}
- 风险偏好: ${(sp.riskAppetite * 100).toFixed(0)}%
- 沟通风格: ${sp.communicationStyle}
- 偏好选项类型: ${sp.preferredOptions?.join(', ') || '未知'}`
    );
  }

  // [边界] §9 三区代行铁律
  segments.push(
    `---\n[代行边界 (MANIFESTO §9 铁律)]
- 🟢 绿区可代行: SOP 内常规确认 / 项目状态查询
- 🟡 黄区需员工签批: 排期调整 / 需判断的选择
- 🔴 红区严禁代行: 客户谈判 / 招聘面试 / 绩效面谈 / 合规审计
- 任何代行产出必须 24h 否决窗 + 显式标识 "AI 代理"`
  );

  // [OKR] 事半锚点 (立项 §4)
  if (okrContext) {
    segments.push(`---\n[当前 OKR 锚点 (事半 §4 强制)]\n${okrContext}`);
  }

  // [隐私] §13.2 尊严归员工
  if (privacyScope === 'personal') {
    segments.push(
      `---\n[隐私 (MANIFESTO §13.2)]
本对话默认仅员工本人可见. Steward / Admin / 主管在后台无权检索.
只有员工主动"沉淀为决议卡 / Material 收藏"才进公司公域.`
    );
  }

  // [输出] 通用规则 (MANIFESTO §2 + §15)
  segments.push(
    `---\n[输出规则]
- 关键决策必须给 3+1 选项 (SOP / 推演 / 案例 / 自创), 不替员工拍板
- 每次输出展示推演过程, 让员工更聪明一点 (反"AI 替员工劳动")
- 任何输出可被员工 24h 内否决, 不强行保留
- 不夸大: "100% 完美 / 极致 / 最佳" 等形容词禁用 (Tandem 行为教训)`
  );

  // [调用上下文]
  if (scenario) {
    segments.push(`---\n[当前场景] ${scenario}`);
  }

  return segments.join('\n\n');
}

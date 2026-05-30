/**
 * Skill Modes · 主分身的 5 种技能模式
 *
 * P1+P3 (2026-05-28): 同一主分身披上不同专业外套,
 * 不是新建独立 Agent (违反 MANIFESTO §19).
 *
 * 设计原则:
 *  - 主分身 Persona 唯一, 一份 Memory + 一套代行边界
 *  - "切换模式" = 调用时叠加该模式的 system prompt 段 + 推荐工具
 *  - Mode Proficiency 独立 0-100 评分, 但整体 stage 仍是 1-5 (单分身)
 */

export type SkillMode = 'design' | 'pm' | 'tech' | 'marketing' | 'strategy';

export interface SkillModeDef {
  id: SkillMode;
  emoji: string;
  label: string;
  description: string;
  /**
   * 调用时叠加到 system prompt 的领域人格段.
   * 注意: 不复述员工 Persona, 只补充该模式的"专业气质".
   */
  systemPromptSegment: string;
  /** 推荐工具 (UI 提示用, 不强制) */
  recommendedTools: string[];
  /** 该模式默认 LLM scenario (P1 走 persona_dialogue 兜底) */
  defaultScenario: 'persona_dialogue' | 'reasoning_complex' | 'agentic';
}

export const SKILL_MODES: Record<SkillMode, SkillModeDef> = {
  design: {
    id: 'design',
    emoji: '🎨',
    label: '设计模式',
    description: '产品/视觉/交互设计 · 注重用户体验与审美一致性',
    systemPromptSegment: `你现在以"设计师"视角参与协作:
- 优先回答 UI/UX/视觉/交互 问题
- 思考时关注: 用户目标 / 信息架构 / 视觉层级 / 一致性 / 可访问性
- 推荐参考: Apple HIG / Material Design / Linear / Stripe Dashboard
- 不替员工拍板审美, 给 3-4 个方向让员工选`,
    recommendedTools: ['Figma', 'FigJam', 'Stripe Dashboard 参考库'],
    defaultScenario: 'persona_dialogue',
  },
  pm: {
    id: 'pm',
    emoji: '📦',
    label: 'PM 模式',
    description: '产品管理 · PRD / 需求拆解 / 优先级 / 用户故事',
    systemPromptSegment: `你现在以"产品经理"视角参与协作:
- 优先回答 需求拆解 / 优先级 / 用户故事 / PRD / 路线图 / 跨团队协调
- 思考时关注: 用户价值 / ROI / 工程成本 / 时间窗口 / 依赖
- 给方案时遵循 RICE / MoSCoW 优先级框架
- 关键决策必须可回溯 OKR (Tandem 立项 §4)`,
    recommendedTools: ['Linear', 'Notion PRD 模板', 'Tandem 决议卡'],
    defaultScenario: 'persona_dialogue',
  },
  tech: {
    id: 'tech',
    emoji: '💻',
    label: '技术模式',
    description: '技术架构 / 代码 / 调试 · 严谨与可验证',
    systemPromptSegment: `你现在以"资深工程师"视角参与协作:
- 优先回答 架构 / 代码 / 调试 / 部署 / 性能 / 安全
- 写代码时: 先 audit 现状, 再做最小变更, 不引入未要求的依赖
- 不编功能 (MANIFESTO 反"瞎编"教训), 不存在的 API 不假设存在
- 接入企业数据/工具调用必经 Skill Gateway (§19)`,
    recommendedTools: ['Cursor', 'Claude Code', 'Hermes Agent', 'GitHub Copilot'],
    defaultScenario: 'reasoning_complex',
  },
  marketing: {
    id: 'marketing',
    emoji: '📣',
    label: '营销模式',
    description: '营销 / 增长 / 内容 · 用户视角与传播',
    systemPromptSegment: `你现在以"营销/增长 PM"视角参与协作:
- 优先回答 内容创作 / 传播渠道 / 转化漏斗 / 增长实验
- 思考时关注: 受众心智 / 渠道适配 / 传播路径 / 数据可衡量
- 文案给 3-4 个方向 (反 SOP 派 / 共鸣派 / 数据派 / 自创)
- 不夸大 (反 "100% 完美" 形容词清零原则)`,
    recommendedTools: ['Notion AI', 'Substack', 'Tandem Material 知识库'],
    defaultScenario: 'persona_dialogue',
  },
  strategy: {
    id: 'strategy',
    emoji: '🎯',
    label: '战略模式',
    description: '战略 / OKR 设计 / 资源配置 · 长期视角',
    systemPromptSegment: `你现在以"战略顾问"视角参与协作:
- 优先回答 OKR 起草 / 战略校准 / 资源配置 / 季度复盘
- 思考时关注: 公司北极星 / 二阶效应 / 资源约束 / 反例
- 给 3+1 选项: 守正 SOP / 推演 / 历史案例 / 你自创 (MANIFESTO §2)
- KR 起草必经 OKR Drift 检测 (与上级 O 对齐度阈值)`,
    recommendedTools: ['Tandem OKR Cascade', '议事室', '战略画布'],
    defaultScenario: 'reasoning_complex',
  },
};

/** 排序后的模式列表, 用于 UI 展示 */
export const SKILL_MODE_LIST: SkillModeDef[] = [
  SKILL_MODES.design,
  SKILL_MODES.pm,
  SKILL_MODES.tech,
  SKILL_MODES.marketing,
  SKILL_MODES.strategy,
];

export function isSkillMode(v: string | null | undefined): v is SkillMode {
  return v === 'design' || v === 'pm' || v === 'tech' || v === 'marketing' || v === 'strategy';
}

/**
 * Design Token 语义层 (Microsoft enterprise-AI 11/2025 启发 + Linear/Vercel 风格)
 *
 * 三层架构 (CHARTER-TECH §UI 3.x):
 *   Layer 1 · 原始值 (raw)        — 直接 hex / tailwind 调色板, 不要在组件用
 *   Layer 2 · 别名 (alias)        — 例: success-bg / surface-2 / brand-600 (在 globals.css)
 *   Layer 3 · 语义 (semantic)    — 例: HEALTH.green / GRADE.high / SCOPE.bonus (本文件)
 *
 * 组件只用 Layer 3 (这里). 切换主题 / 变更色板时, 只动 Layer 1+2.
 *
 * 用法:
 *   import { HEALTH, GRADE, SCOPE, CONFIDENCE } from '@/lib/design-tokens';
 *   <Badge className={HEALTH.green.badge}>...</Badge>
 *   <div className={HEALTH.green.bar}>...</div>
 */

/** KPI / general 健康度 (达标/接近/不达) */
export const HEALTH = {
  green: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  red: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-rose-500',
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
} as const;

/** 9-box KPI 纵轴等级 */
export const GRADE = {
  high: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: '高' },
  mid: { badge: 'bg-sky-50 text-sky-700 border-sky-200', label: '中' },
  low: { badge: 'bg-rose-50 text-rose-700 border-rose-200', label: '低' },
} as const;

/** KPI scope (bonus 与奖金挂钩 / monitor 仅监控) */
export const SCOPE = {
  bonus: {
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    label: 'bonus · 与奖金挂钩',
  },
  monitor: {
    badge: 'bg-zinc-50 text-zinc-700 border-zinc-200',
    label: 'monitor · 仅监控',
  },
} as const;

/** OKR/TTI confidence 信心度 */
export const CONFIDENCE = {
  'on-track': {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
    label: '正常',
  },
  'at-risk': {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
    label: '有风险',
  },
  'off-track': {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-rose-500',
    label: '严重偏离',
  },
} as const;

/** 优先级 (议事室 / 9-box 联动建议 / 任务) */
export const PRIORITY = {
  urgent: { badge: 'bg-rose-100 text-rose-800 border-rose-300', label: '紧急', rank: 0 },
  high: { badge: 'bg-amber-50 text-amber-700 border-amber-200', label: '高', rank: 1 },
  medium: { badge: 'bg-sky-50 text-sky-700 border-sky-200', label: '中', rank: 2 },
  low: { badge: 'bg-zinc-50 text-zinc-600 border-zinc-200', label: '低', rank: 3 },
} as const;

/**
 * Persona stage (v2: 新手/上手/熟手/老手/拿手)
 *
 * 派生层 — SSOT 在 `lib/persona/stage-meta.ts`.
 * 这里只把 STAGE_META 的 `emoji + title` 映射到 badge 类名, 不另起标签.
 */
export const PERSONA_STAGE = {
  newborn:    { badge: 'bg-slate-50 text-slate-700 border-slate-200',   label: '🥚 新手' },
  apprentice: { badge: 'bg-sky-50 text-sky-700 border-sky-200',         label: '� 上手' },
  assistant:  { badge: 'bg-amber-50 text-amber-700 border-amber-200',   label: '� 熟手' },
  deputy:     { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: '🦅 老手' },
  partner:    { badge: 'bg-purple-50 text-purple-700 border-purple-200', label: '🐉 拿手' },
} as const;

/** 数据来源 (CHARTER §2.1 三通道) */
export const DATA_SOURCE = {
  manual: { badge: 'bg-amber-50 text-amber-700 border-amber-200', label: '通道 C · 人工补录' },
  erp: { badge: 'bg-sky-50 text-sky-700 border-sky-200', label: '通道 B · ERP 自动' },
  system: { badge: 'bg-violet-50 text-violet-700 border-violet-200', label: '系统计算' },
  pending: { badge: 'bg-zinc-50 text-zinc-600 border-zinc-200', label: '尚未采集' },
} as const;

/** 9-box cell 视觉风格 */
export const NINE_BOX_CELL = {
  star: { badge: 'bg-amber-50 text-amber-800 border-amber-200', emoji: '⭐', label: '明星' },
  high_performer: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', emoji: '🚀', label: '高产' },
  risk_burnout: { badge: 'bg-rose-50 text-rose-700 border-rose-200', emoji: '⚠️', label: '风险枯萎' },
  rising_talent: { badge: 'bg-sky-50 text-sky-700 border-sky-200', emoji: '🌱', label: '升星人才' },
  core: { badge: 'bg-zinc-50 text-zinc-700 border-zinc-200', emoji: '🧱', label: '核心力量' },
  plateau: { badge: 'bg-zinc-50 text-zinc-600 border-zinc-200', emoji: '➖', label: '平台期' },
  mismatch: { badge: 'bg-violet-50 text-violet-700 border-violet-200', emoji: '🔄', label: '人岗错位' },
  low_engagement: { badge: 'bg-amber-50 text-amber-700 border-amber-200', emoji: '😴', label: '投入不足' },
  must_intervene: { badge: 'bg-rose-100 text-rose-800 border-rose-300', emoji: '🚨', label: '必须干预' },
} as const;

/**
 * BSC 平衡记分卡 4 维 (Kaplan/Norton)
 *
 * 因果链方向 (BSC 原版灵魂):
 *   growth → process → customer → financial
 *   (学习成长 驱动 内部流程 驱动 客户市场 驱动 财务经营)
 *
 * `causalDownstream` 给出该维度的"下游"集合, 用于 B-019 因果链建模校验.
 */
export const BSC_PERSPECTIVE = {
  financial: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-rose-500',
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    emoji: '📈',
    label: '财务与经营',
    desc: '营业收入 / 净利润 / 成本控制 / 预算达成',
    rank: 4,
    causalDownstream: [] as const,
  },
  customer: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    emoji: '👥',
    label: '客户与市场',
    desc: '外部 SLA / 客户满意度 / 留存率 / 需求响应',
    rank: 3,
    causalDownstream: ['financial'] as const,
  },
  process: {
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    bar: 'bg-sky-500',
    text: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    emoji: '⚙️',
    label: '内部流程',
    desc: '系统稳定 / 研发交付 / 项目交付 / 合规',
    rank: 2,
    causalDownstream: ['customer', 'financial'] as const,
  },
  growth: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    emoji: '🧠',
    label: '学习与成长',
    desc: '关键技能 / 技术分享 / IDP / TTI 创新转化',
    rank: 1,
    causalDownstream: ['process', 'customer', 'financial'] as const,
  },
} as const;

export type BscPerspective = keyof typeof BSC_PERSPECTIVE;

/** 工具函数: KPI 完成率 → health */
export function completionToHealth(c: number): keyof typeof HEALTH {
  if (c >= 0.9) return 'green';
  if (c >= 0.6) return 'amber';
  return 'red';
}

/** 工具函数: 加权完成率 → 9-box 纵轴 grade */
export function weightedToGrade(wc: number): keyof typeof GRADE {
  if (wc >= 0.95) return 'high';
  if (wc >= 0.7) return 'mid';
  return 'low';
}

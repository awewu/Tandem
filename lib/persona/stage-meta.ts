/**
 * StageMeta · 学位元数据 (Single Source of Truth)
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md
 * 命名进化 (2026-05-29 v2):
 *   v0 旧: 大一/大二/大三/大四/研究生 (太朴素)
 *   v1 废: 新生/学徒/助教/学长/校友导师 (学院腔太重)
 *   v2 定: 新手/上手/熟手/老手/拿手 (Lv.1-5)
 *
 * v2 设计动机 (Owner 拍板):
 *   - 全部 "X 手" 字尾, 节奏统一, 有进阶感
 *   - "拿手" 谐音 "拿捏" — 直接呼应拿捏柱产品哲学
 *   - 暗含"拿捏老板": 你越用主分身, 老板越懂你, 你也越拿手
 *   - 内部术语 (PERSONA-EVOLUTION) 不变, 仅 UI 文案升级
 */

import type { PersonaStage, DelegationLevel } from '@/lib/types/persona';

export interface StageMeta {
  stage: PersonaStage;
  /** 学院等级 1-5 */
  level: 1 | 2 | 3 | 4 | 5;
  emoji: string;
  /** 主称谓 (UI 主显示) */
  title: string;
  /** 英文 (副标题) */
  titleEn: string;
  /** 内部术语 (PERSONA-EVOLUTION 一致) */
  internalLabel: string;
  /** 一句话乐趣描述 */
  blurb: string;
  /** 时长描述 */
  duration: string;
  /** 默认实习权限 (可被必修课叠加调整) */
  defaultDelegation: DelegationLevel;
  /** 实习权限简称 (UI 显示) */
  delegationShort: 'L0' | 'L1' | 'L2' | 'L3';
  /** 配色 tone (用于 hero 主色 + timeline) */
  tone: 'slate' | 'sky' | 'amber' | 'emerald' | 'purple';
}

export const STAGE_META: Record<PersonaStage, StageMeta> = {
  newborn: {
    stage: 'newborn',
    level: 1,
    emoji: '🥚',
    title: '新手',
    titleEn: 'Newbie',
    internalLabel: 'newborn',
    blurb: '刚上路 · 看看学学, 不表态',
    duration: '0-2 周',
    defaultDelegation: 'report_only',
    delegationShort: 'L0',
    tone: 'slate',
  },
  apprentice: {
    stage: 'apprentice',
    level: 2,
    emoji: '🐣',
    title: '上手',
    titleEn: 'Rookie',
    internalLabel: 'apprentice',
    blurb: '能干活了 · 可代汇报数据',
    duration: '2 周-2 月',
    defaultDelegation: 'report_only',
    delegationShort: 'L1',
    tone: 'sky',
  },
  assistant: {
    stage: 'assistant',
    level: 3,
    emoji: '🐤',
    title: '熟手',
    titleEn: 'Skilled',
    internalLabel: 'assistant',
    blurb: '熟门熟路 · 可参与会议表态',
    duration: '2-6 月',
    defaultDelegation: 'soft_opinion',
    delegationShort: 'L2',
    tone: 'amber',
  },
  deputy: {
    stage: 'deputy',
    level: 4,
    emoji: '🦅',
    title: '老手',
    titleEn: 'Veteran',
    internalLabel: 'deputy',
    blurb: '独当一面 · 可承诺工作日内动作',
    duration: '6 月-1 年',
    defaultDelegation: 'commit_short',
    delegationShort: 'L3',
    tone: 'emerald',
  },
  partner: {
    stage: 'partner',
    level: 5,
    emoji: '🐉',
    title: '拿手',
    titleEn: 'Master',
    internalLabel: 'partner',
    blurb: '拿手好戏 · 跨企业搭档 (除红区)',
    duration: '> 1 年',
    defaultDelegation: 'cross_company',
    delegationShort: 'L3',
    tone: 'purple',
  },
};

/** 排序后的等级列表, 用于 timeline / 等级 chip */
export const STAGE_LIST: StageMeta[] = [
  STAGE_META.newborn,
  STAGE_META.apprentice,
  STAGE_META.assistant,
  STAGE_META.deputy,
  STAGE_META.partner,
];

/** 已进入当前阶段的天数 */
export function daysInStage(stageEnteredAt: string | Date): number {
  const t =
    typeof stageEnteredAt === 'string'
      ? Date.parse(stageEnteredAt)
      : stageEnteredAt.getTime();
  return Math.max(0, Math.floor((Date.now() - t) / 86400_000));
}

// ---------------------------------------------------------------------------
// 配色 tokens (与 tone 对应)
// ---------------------------------------------------------------------------

interface ToneTokens {
  /** Hero 主背景 (浅) */
  bgSoft: string;
  /** Hero 边框 */
  border: string;
  /** 文字主色 */
  text: string;
  /** 进度条填充 */
  progressFill: string;
  /** Timeline 已达成节点背景 */
  nodeBg: string;
}

export const TONE_TOKENS: Record<StageMeta['tone'], ToneTokens> = {
  slate: {
    bgSoft: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    progressFill: 'bg-slate-500',
    nodeBg: 'bg-slate-100 text-slate-700 ring-slate-300',
  },
  sky: {
    bgSoft: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
    progressFill: 'bg-sky-500',
    nodeBg: 'bg-sky-100 text-sky-700 ring-sky-300',
  },
  amber: {
    bgSoft: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    progressFill: 'bg-amber-500',
    nodeBg: 'bg-amber-100 text-amber-700 ring-amber-300',
  },
  emerald: {
    bgSoft: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    progressFill: 'bg-emerald-500',
    nodeBg: 'bg-emerald-100 text-emerald-700 ring-emerald-300',
  },
  purple: {
    bgSoft: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    progressFill: 'bg-purple-500',
    nodeBg: 'bg-purple-100 text-purple-700 ring-purple-300',
  },
};

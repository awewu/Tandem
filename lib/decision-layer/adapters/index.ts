/**
 * Decision Layer Adapters · 各场景的 3+1 包装
 *
 * - convergence:   议事室 (V0 已落地, 真接入)
 * - report:        5min 日报 KR 推流前 (P1)
 * - tti:           TTI 拆解 (P1)
 * - weekly-retro:  周回顾 (P1)
 * - persona-brief: 主分身 brief 推荐 (P1)
 */

export { generateConvergenceOptions } from './convergence';
export { generateReportActionOptions, type ReportExtractContext } from './report';
export { generateTtiBreakdownOptions, type TtiBreakdownContext } from './tti';
export { generateWeeklyRetroOptions, type WeeklyRetroContext } from './weekly-retro';
export { generatePersonaBriefOptions, type PersonaBriefContext } from './persona-brief';

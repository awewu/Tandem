/**
 * OKR 质量检查器 — 本地启发式规则
 *
 * 经典反模式（来自 Doerr 《Measure What Matters》/ Re:Work / Tita 培训资料）：
 *   - Objective 不应包含具体数字（O 是定性的方向、KR 才是定量的衡量）
 *   - Objective 太短/太长
 *   - KR 必须可量化（不能只是任务描述）
 *   - KR 不能是任务式描述（"做 XXX"），应该是结果式（"达成 XX%"）
 *   - KR 单位缺失
 *   - KR 起始值 == 目标值（不可衡量）
 *
 * 输出 0-100 的质量分 + 分项建议
 */

import type { KeyResult, Objective } from '../store';

export interface QualityIssue {
  field: 'objective' | 'kr';
  scopeId: string;
  level: 'error' | 'warning' | 'info';
  message: string;
}

export interface QualityReport {
  /** 质量分 0-100 */
  score: number;
  issues: QualityIssue[];
  summary: string;
}

const TASK_VERBS = [
  '做', '完成', '搭建', '开发', '推出', '上线', '编写', '撰写', '组织', '安排', '调研', '研究',
  '梳理', '建设', '建立', '实施', '推进', '执行', '召开', '准备',
];

export function checkObjectiveQuality(obj: Objective): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const t = obj.title.trim();

  if (t.length === 0) {
    issues.push({ field: 'objective', scopeId: obj.id, level: 'error', message: '目标标题为空' });
    return issues;
  }
  if (t.length < 4) {
    issues.push({ field: 'objective', scopeId: obj.id, level: 'warning', message: '目标标题过短，难以表达方向' });
  }
  if (t.length > 50) {
    issues.push({ field: 'objective', scopeId: obj.id, level: 'info', message: '目标标题略长，建议精炼' });
  }
  if (/\d{2,}/.test(t)) {
    issues.push({
      field: 'objective', scopeId: obj.id, level: 'warning',
      message: 'O 中含具体数字 — 数字属于 KR，O 应描述定性方向',
    });
  }
  if (/^(完成|做完|做)/.test(t)) {
    issues.push({
      field: 'objective', scopeId: obj.id, level: 'warning',
      message: 'O 不应是任务式（"做 XXX"），应描述要达成的状态/结果',
    });
  }
  return issues;
}

export function checkKRQuality(kr: KeyResult): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const t = kr.title.trim();

  if (t.length === 0) {
    issues.push({ field: 'kr', scopeId: kr.id, level: 'error', message: 'KR 标题为空' });
    return issues;
  }

  // 任务式 KR
  if (TASK_VERBS.some((v) => t.startsWith(v))) {
    issues.push({
      field: 'kr', scopeId: kr.id, level: 'warning',
      message: 'KR 看起来是任务而非结果（"做 XXX"），建议改写成可衡量的结果',
    });
  }

  // 数值类 KR 起始 == 目标
  if ((kr.type === 'numeric' || kr.type === 'percentage') && kr.startValue === kr.targetValue) {
    issues.push({
      field: 'kr', scopeId: kr.id, level: 'error',
      message: 'KR 起始值 = 目标值，无法衡量进展',
    });
  }

  // 数值类无单位
  if ((kr.type === 'numeric' || kr.type === 'percentage') && !kr.unit) {
    issues.push({
      field: 'kr', scopeId: kr.id, level: 'warning',
      message: 'KR 缺少单位（如 %、个、万元）',
    });
  }

  // 权重为 0
  if (kr.weight <= 0) {
    issues.push({
      field: 'kr', scopeId: kr.id, level: 'warning',
      message: 'KR 权重 ≤ 0，将不参与目标进度计算',
    });
  }

  return issues;
}

export function checkQuality(obj: Objective, krs: KeyResult[]): QualityReport {
  const objIssues = checkObjectiveQuality(obj);
  const krIssues = krs.flatMap(checkKRQuality);
  const issues = [...objIssues, ...krIssues];

  // 评分：起步 100，每个 error -20，warning -8，info -2，下限 0
  let score = 100;
  for (const it of issues) {
    score -= it.level === 'error' ? 20 : it.level === 'warning' ? 8 : 2;
  }
  score = Math.max(0, Math.min(100, score));

  let summary: string;
  if (score >= 90) summary = '优秀 — 这是一组结构清晰、可衡量的 OKR';
  else if (score >= 70) summary = '良好 — 有少量可改进项';
  else if (score >= 50) summary = '及格 — 建议根据提示优化';
  else summary = '需要重写 — 多处反模式';

  return { score, issues, summary };
}

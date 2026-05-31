/**
 * Module Scope · 三板块访问边界 SSOT
 *
 * Tandem 三板块 (MANIFESTO §1-3):
 *   - 事半 (SHIBAN) · OKR 驱动器 — 战略/绩效/复盘核心, 仅内部员工
 *   - 拿捏 (NABA)   · Persona / 个人 AI 助理 — 协作者 (含外部) 可分享个人 AI
 *   - 搭子 (DAZI)   · IM / 文档 / 日历 / 学院 — 协作面, 外部可受邀进入
 *
 * 规则:
 *   - 内部角色 (employee/manager/admin/owner/steward/champion) 默认全板块
 *   - 外部角色 (guest/partner/contractor) 默认禁事半, 拿捏/搭子按邀请粒度允许
 *   - 任何用户同时拥有内部+外部角色: 取内部角色权限 (向上聚合)
 *
 * 这是 P0 路径前缀级守卫. 端点级细粒度 ACL 仍由 requireRole 决定.
 */

import { hasExternalRole, hasInternalRole } from './roles';

/** 事半板块: OKR 驱动器 — 仅内部员工 */
export const SHIBAN_PREFIXES = [
  '/okr',
  '/retros',
  '/1on1',
  '/360',
  '/convergence',
  '/nine-box',
  '/dashboard',
  '/api/objectives',
  '/api/key-results',
  '/api/check-ins',
  '/api/cycles',
  '/api/retros',
  '/api/one-on-one',
  '/api/review360',
  '/api/nine-box',
  '/api/initiatives',
  '/api/convergence',
] as const;

/** 拿捏板块: Persona / 个人 AI — 协作者可访问自己的 Persona */
export const NABA_PREFIXES = [
  '/persona',
  '/agents',
  '/summon',
  '/portfolio',
  '/api/persona',
  '/api/agents',
] as const;

/** 搭子板块: IM / 文档 / 日历 / 学院 / 内网 — 协作面 */
export const DAZI_PREFIXES = [
  '/im',
  '/messages',
  '/docs',
  '/calendar',
  '/drive',
  '/learning',
  '/academy',
  '/intranet',
  '/town-hall',
  '/api/im',
  '/api/documents',
  '/api/calendar',
  '/api/drive',
  '/api/learning',
  '/api/academy',
  '/api/intranet',
] as const;

export type Pillar = 'shiban' | 'naba' | 'dazi' | 'system';

/** 路径 → 板块归属. 未匹配返回 system (设置/管理/通用), 不受 module-scope 限制. */
export function pillarOf(path: string): Pillar {
  if (SHIBAN_PREFIXES.some((p) => path.startsWith(p))) return 'shiban';
  if (NABA_PREFIXES.some((p) => path.startsWith(p))) return 'naba';
  if (DAZI_PREFIXES.some((p) => path.startsWith(p))) return 'dazi';
  return 'system';
}

/**
 * 是否允许角色集访问该路径.
 *
 * 决策表:
 *   纯内部角色 → 三板块全通
 *   纯外部角色 → 事半禁, 拿捏/搭子通, system 通
 *   混合       → 视为内部 (向上聚合)
 *   空 roles  → 仅 system (不允许业务路径)
 */
export function canAccessPath(roles: readonly string[], path: string): boolean {
  const pillar = pillarOf(path);
  if (pillar === 'system') return true;

  const internal = hasInternalRole(roles);
  if (internal) return true;

  const external = hasExternalRole(roles);
  if (!external) {
    // 没有任何已知角色 (新用户 / 系统错误) — 业务路径全禁
    return false;
  }

  // 纯外部: 事半禁, 其它放
  if (pillar === 'shiban') return false;
  return true;
}

/** UI 路径被拒时跳转目标 */
export const FORBIDDEN_REDIRECT = '/forbidden';

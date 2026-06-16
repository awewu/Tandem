/**
 * deriveSigningAuthority · 从职能司 + Steward 表派生用户的签批角色
 *
 * Owner 2026-06-15 拍板的设计:
 *   - scope (哪一级) 与 authority (谁能签) 正交
 *   - 签批角色不再是硬编码枚举, 而是从 GovernanceTemplate 读取后派生:
 *
 *   门下省 (pillar='review')  → 通用签字闸
 *     team 级:    门下省 agents → team_leader
 *     dept 级:    门下省 agents → dept_leader
 *     company 级: 门下省 agents → dept_leader (兜底)
 *
 *   中书省 (pillar='decision') → company 级决策司
 *     company 级: 中书省 agents → ceo / clevel
 *
 *   stewards 表 → steward (全级别)
 *
 *   kr_owner: 不在 template, 由调用方按 KR.ownerId 匹配后自行注入
 *
 * 降级策略 (fail-soft):
 *   - template 未配置 / 职能司无 agents → 回退到 resolveMyRolesLegacy
 *   - 保证现有 demo-user/owner 场景不回退
 */

import type { MemorySignerRole, PromotionLevel } from '../types/memory';
import type { GovernanceTemplate } from '../types/governance';
import { getStore } from '../storage/repository';
import { getTemplate } from './projects';

export interface DeriveSigningAuthorityInput {
  userId: string;
  level: PromotionLevel;
  tenantId?: string;
  /** 若传入则直接用, 不再重复拉取 (batch 场景优化) */
  template?: GovernanceTemplate | null;
}

export interface DeriveSigningAuthorityResult {
  roles: MemorySignerRole[];
  /** 是否来自 legacy 回退路径 */
  fromLegacy: boolean;
}

/**
 * 核心入口: 给定 userId + level, 返回该用户持有的签批角色列表.
 * fail-soft: 任何内部错误均回退到 legacy 路径, 不抛出.
 */
export async function deriveSigningAuthority(
  input: DeriveSigningAuthorityInput,
): Promise<DeriveSigningAuthorityResult> {
  try {
    const template = input.template !== undefined
      ? input.template
      : await getTemplate('default');

    const roles = new Set<MemorySignerRole>();

    // 1. steward (全级别)
    try {
      const store = getStore();
      const steward = await store.stewards.get(input.userId);
      if (steward) roles.add('steward');
    } catch { /* noop */ }

    if (template) {
      // 2. 门下省 (pillar='review') → team_leader / dept_leader
      const reviewDepts = template.departments.filter((d) => d.pillar === 'review');
      const inReview = reviewDepts.some((d) =>
        d.ministries.some((m) => m.agents.includes(input.userId))
      );
      if (inReview) {
        if (input.level === 'team') {
          roles.add('team_leader');
        } else {
          roles.add('dept_leader');
        }
      }

      // 3. 中书省 (pillar='decision') → ceo + clevel (company 级)
      if (input.level === 'company') {
        const decisionDepts = template.departments.filter((d) => d.pillar === 'decision');
        const inDecision = decisionDepts.some((d) =>
          d.ministries.some((m) => m.agents.includes(input.userId))
        );
        if (inDecision) {
          roles.add('ceo');
          roles.add('clevel');
        }
      }
    }

    if (roles.size > 0) {
      return { roles: Array.from(roles), fromLegacy: false };
    }

    // 4. 无匹配 → legacy 回退
    return { roles: await resolveMyRolesLegacy(input.userId), fromLegacy: true };
  } catch {
    return { roles: await resolveMyRolesLegacy(input.userId), fromLegacy: true };
  }
}

/**
 * 批量派生: 给定一批 userId, 返回 Map<userId, roles>.
 * 只拉一次 template, 适合 dashboard 聚合场景.
 */
export async function deriveSigningAuthorityBatch(
  userIds: string[],
  level: PromotionLevel,
): Promise<Map<string, MemorySignerRole[]>> {
  const template = await getTemplate('default').catch(() => null);
  const result = new Map<string, MemorySignerRole[]>();
  await Promise.all(
    userIds.map(async (userId) => {
      const r = await deriveSigningAuthority({ userId, level, template });
      result.set(userId, r.roles);
    }),
  );
  return result;
}

/**
 * Legacy fallback: 维持旧 resolveMyRoles 行为作为兜底.
 * demo-user / owner → 全角色; steward → ['steward']; 其余 → [].
 */
async function resolveMyRolesLegacy(userId: string): Promise<MemorySignerRole[]> {
  if (userId === 'demo-user' || userId === 'owner') {
    return ['team_leader', 'dept_leader', 'kr_owner', 'steward', 'ceo', 'clevel'];
  }
  try {
    const store = getStore();
    const found = await store.stewards.get(userId);
    if (found) return ['steward'];
  } catch { /* noop */ }
  return [];
}

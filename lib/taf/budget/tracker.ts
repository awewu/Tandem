/**
 * Token Budget Tracker · 全局成本守门
 *
 * 对应 CircleBot "Token 预算限制" 概念.
 *
 * 三层预算:
 *   1. 单次请求 (单 chat call)
 *   2. 单 Agent 任务 (一次 spawn)
 *   3. 用户 / 租户 日预算 (防失控)
 *
 * 超额行为: 阻断后续调用 + 通知 admin.
 */

import { audit } from '../../audit/log';

export interface BudgetEntry {
  used: number;
  limit: number;
  resetAt: number; // ms
}

class BudgetTracker {
  /** key = `tenant:${tenantId}` 或 `user:${userId}` */
  private buckets = new Map<string, BudgetEntry>();

  /**
   * 设定预算 (天级). 超额阻断调用.
   */
  setLimit(scope: string, limitTokens: number, resetAfterHours = 24): void {
    this.buckets.set(scope, {
      used: 0,
      limit: limitTokens,
      resetAt: Date.now() + resetAfterHours * 3600_000,
    });
  }

  /**
   * 记录消耗. 返回当前剩余.
   */
  async consume(scope: string, tokens: number, actorId = 'system'): Promise<{ remaining: number; blocked: boolean }> {
    let bucket = this.buckets.get(scope);
    if (!bucket) {
      // 默认每租户每日 10M token (保护)
      bucket = { used: 0, limit: 10_000_000, resetAt: Date.now() + 86400_000 };
      this.buckets.set(scope, bucket);
    }

    // 自动重置过期 bucket
    if (Date.now() > bucket.resetAt) {
      bucket.used = 0;
      bucket.resetAt = Date.now() + 86400_000;
    }

    bucket.used += tokens;
    const remaining = bucket.limit - bucket.used;
    const blocked = remaining < 0;

    if (blocked) {
      await audit('budget.exceeded', actorId, {
        targetType: 'token_budget',
        metadata: { scope, used: bucket.used, limit: bucket.limit },
      });
    }

    return { remaining: Math.max(0, remaining), blocked };
  }

  /**
   * 查询剩余
   */
  remaining(scope: string): number {
    const bucket = this.buckets.get(scope);
    if (!bucket) return Number.POSITIVE_INFINITY;
    if (Date.now() > bucket.resetAt) return bucket.limit;
    return Math.max(0, bucket.limit - bucket.used);
  }

  /**
   * 是否允许新请求
   */
  canProceed(scope: string, requestedTokens: number): boolean {
    return this.remaining(scope) >= requestedTokens;
  }

  /** 获取所有 bucket (用于 admin 看板) */
  snapshot(): Record<string, BudgetEntry> {
    return Object.fromEntries(this.buckets);
  }
}

export const budgetTracker = new BudgetTracker();

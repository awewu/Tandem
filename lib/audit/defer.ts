/**
 * §Defer Audit · 把审计写从响应路径里挪到后台
 *
 * 2026 Mem0 principle: "writes that block the response add latency the user feels".
 * Audit 写虽然只 5-20ms, 但在 SSE / 流式场景下每次都吃一刻钟首字符延迟.
 *
 * 用法替换:
 *   旧: await audit('boss_ai.ask', userId, { ... }).catch(() => {});
 *   新: deferAudit('boss_ai.ask', userId, { ... });    // 立即返回, 后台 microtask 跑
 *
 * 失败仅 logger.warn, 不影响业务. 进程退出时如有 pending, 尽力 drain.
 */
import type { AuditAction } from './log';
import { audit } from './log';
import { logger } from '@/lib/infra/logger';

interface AuditOpts {
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
  tenantId?: string;
}

const _g = globalThis as typeof globalThis & {
  __tandem_deferred_audit_count__?: number;
};

if (typeof _g.__tandem_deferred_audit_count__ === 'undefined') {
  _g.__tandem_deferred_audit_count__ = 0;
}

/**
 * Fire-and-forget audit write. 立即返回, microtask 后台跑.
 * 测试模式 (NODE_ENV=test) 同步跑保证 deterministic.
 */
export function deferAudit(
  action: AuditAction,
  actorId: string,
  opts?: AuditOpts,
): void {
  const isTest = process.env.NODE_ENV === 'test';
  const fn = async () => {
    try {
      await audit(action, actorId, opts);
    } catch (err) {
      logger.warn(
        { action, actorId, err: (err as Error).message },
        '[defer-audit] write failed (best-effort)',
      );
    } finally {
      _g.__tandem_deferred_audit_count__ = (_g.__tandem_deferred_audit_count__ ?? 0) - 1;
    }
  };
  _g.__tandem_deferred_audit_count__ = (_g.__tandem_deferred_audit_count__ ?? 0) + 1;
  if (isTest) {
    // 同步: 测试里 await 确定性
    void fn();
  } else {
    queueMicrotask(() => { void fn(); });
  }
}

/** 当前 in-flight 数 (debug / shutdown drain 用) */
export function deferredAuditPending(): number {
  return _g.__tandem_deferred_audit_count__ ?? 0;
}

/**
 * EVO-7 · PII 入栈/出栈默认剥离器
 *
 * 设计 (借鉴 Ruflo federation PII pipeline, Tandem 化):
 *   - 注册式: 每种敏感类型注册自己的 redact 规则, 按 scope 取舍
 *   - 4 个 scope: 'self' | 'admin' | 'tenant' | 'public', 越右越严格
 *   - 类型安全: 调用方传入类型实体 + viewer 上下文, 返回同类型 (字段裁剪/抹白)
 *
 * 与 MANIFESTO 的关系:
 *   - §13 隐私尊严: 员工的 私密笔记/情绪分/邮箱/IP 在非 self 视角默认抹掉
 *   - §8.2 Memory 治理: Memory 内容的草稿/作者 id 在非 admin 视角抹身份
 *
 * 与现有 lib/auth/strip.ts 的关系:
 *   - 不破坏导出: strip.ts 继续 re-export, 调用点 0 改动
 *   - 内部实现迁移到 redactor 注册表, 加测试覆盖
 */

import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';

export type RedactionScope =
  | 'self' // viewer 就是数据主人 (或本人参与方), 看全
  | 'admin' // 系统管理员 / 租户 admin / steward(HR), 看全
  | 'tenant' // 同租户其他员工
  | 'public'; // 未登录或跨租户

export interface RedactionContext {
  /** 当前视图人 user.id (null = 未登录) */
  viewerId: string | null;
  /** viewer 持有的角色 */
  viewerRoles: string[];
  /** viewer 所在 tenant */
  viewerTenantId: string;
  /** 数据所属 tenant; 不同 = public scope */
  ownerTenantId?: string;
  /** 是否 demo 模式 (放宽) */
  demo?: boolean;
}

/**
 * 解析 scope: 根据 viewer 是否数据主人、是否 admin、是否同租户.
 *
 * @param ownerIds  数据"主人 id"列表 (1on1: managerId + reportId; 360: subjectId + raterId; 等)
 *                  viewer ∈ ownerIds → self
 */
export function resolveScope(
  ctx: RedactionContext,
  ownerIds: (string | null | undefined)[],
): RedactionScope {
  if (ctx.viewerId && ownerIds.filter(Boolean).includes(ctx.viewerId)) {
    return 'self';
  }
  if (ctx.demo) return 'admin';
  if (ctx.viewerRoles.some((r) => (DATA_STEWARD_ROLES as string[]).includes(r))) {
    return 'admin';
  }
  if (ctx.ownerTenantId && ctx.ownerTenantId !== ctx.viewerTenantId) {
    return 'public';
  }
  return 'tenant';
}

/**
 * Redactor 函数签名:
 *   入: (object, scope, ctx) → 出: 抹白后的同类型 (字段子集或值替换)
 */
export type Redactor<T> = (input: T, scope: RedactionScope, ctx: RedactionContext) => T;

/**
 * 构建 redactor: 每个字段声明在哪些 scope 下应抹白.
 *
 * 用法:
 *   const redactUser = buildRedactor<AuthUser>({
 *     email:         { hideAt: ['tenant', 'public'] },
 *     lastLoginIp:   { hideAt: ['tenant', 'public', 'admin'] },  // 永远不暴露给 UI
 *     emailVerified: { hideAt: ['public'] },
 *   });
 */
export interface FieldRule<T> {
  /** 在哪些 scope 应该抹白 ('admin' 也可以加上代表对管理员都不暴露) */
  hideAt: RedactionScope[];
  /** 抹白后的占位值, 默认 null. 字符串字段可用 'anonymous' 等. */
  placeholder?: unknown;
}

export type FieldRules<T> = {
  [K in keyof T]?: FieldRule<T>;
};

export function buildRedactor<T extends object>(
  rules: FieldRules<T>,
): Redactor<T> {
  return (input, scope) => {
    if (!input || typeof input !== 'object') return input;
    let out: T | null = null;
    for (const key of Object.keys(rules) as (keyof T)[]) {
      const rule = rules[key];
      if (!rule) continue;
      if (rule.hideAt.includes(scope)) {
        if (!out) out = { ...input };
        (out as Record<string, unknown>)[key as string] = rule.placeholder ?? null;
      }
    }
    return out ?? input;
  };
}

/**
 * 数组便捷 wrapper.
 */
export function redactList<T>(
  list: T[],
  redactor: Redactor<T>,
  scope: RedactionScope,
  ctx: RedactionContext,
): T[] {
  return list.map((item) => redactor(item, scope, ctx));
}

// =========================================================================
// 标准 PII 模式 (调用方挑自己需要的)
// =========================================================================

/**
 * 通用文本"抹身份化": 把 email/phone/idCard 模式打码.
 * 用于 free-text 字段 (评论 / 反馈 / 注释) 在跨视图时的兜底.
 *
 * 注意: 这是**保险丝**, 不是主防线. 主防线是字段级的 buildRedactor.
 */
const EMAIL_RE = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
const PHONE_RE = /(?:\+?86[-\s]?)?1[3-9]\d{9}\b/g;
const ID_CARD_RE = /\b\d{15}\b|\b\d{17}[\dXx]\b/g;
const API_KEY_RE = /\b(?:sk-|pk-|ghp_|ghs_)[A-Za-z0-9_-]{16,}\b/g;

export function redactFreeText(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  return text
    .replace(EMAIL_RE, '[email]')
    .replace(PHONE_RE, '[phone]')
    .replace(ID_CARD_RE, '[id]')
    .replace(API_KEY_RE, '[key]');
}

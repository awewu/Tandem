/**
 * DB-AUDIT P1 · KvStore.list() filter 分类器 (2026-06-09)
 *
 * 独立文件, 不 import drizzle-client / db, 便于纯单测.
 * 被 DrizzleKvRepository.list() 使用, 决定:
 *   - 哪些 filter key 走 SQL 下推 (JSONB `->>` 表达式 + 期望命中 0007 partial 索引)
 *   - 哪些留给 JS 兜底 (非 string 值 / 非法标识符)
 */

/**
 * JSONB 下推时允许的 key 形状: 标准 JS 标识符 (字母/数字/下划线, 不以数字开头).
 * typed Partial<T> 已在编译期保证, 但 sql.raw 拼 key 时兜底校验, 防 SQL 注入.
 */
export const SAFE_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * 输出:
 *   - tenantId: 走 KvStore.tenantId 列 (0006 回填后列已复活)
 *   - jsonbStringKeys: 走 `data->>'key' = val` 表达式 (期望命中 0007 partial 索引)
 *   - jsFallbackKeys: 留 JS 端过滤 (number/boolean/object/非法 key)
 *   - canPushLimit: 仅当 jsFallbackKeys 为空时, limit/offset 可下推到 SQL
 */
export function classifyKvFilter(filter?: Record<string, unknown>): {
  tenantId?: string;
  jsonbStringKeys: Array<{ key: string; value: string }>;
  jsFallbackKeys: string[];
  canPushLimit: boolean;
} {
  const tenantId =
    filter && typeof filter.tenantId === 'string' ? filter.tenantId : undefined;
  const jsonbStringKeys: Array<{ key: string; value: string }> = [];
  const jsFallbackKeys: string[] = [];
  if (filter) {
    for (const [key, val] of Object.entries(filter)) {
      if (key === 'tenantId' && typeof val === 'string') continue;
      if (val === undefined) continue;
      if (typeof val === 'string' && SAFE_KEY_RE.test(key)) {
        jsonbStringKeys.push({ key, value: val });
      } else {
        jsFallbackKeys.push(key);
      }
    }
  }
  return {
    tenantId,
    jsonbStringKeys,
    jsFallbackKeys,
    canPushLimit: jsFallbackKeys.length === 0,
  };
}

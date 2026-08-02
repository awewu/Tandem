/**
 * PMS · 选型规则集服务 (P3 选型配置器)
 *
 * 数据层: drizzle pms_selector_rulesets (inputFields/rules 存 jsonb)。
 * 权限:
 *   - 读: 内部全员; 外部经销商仅可见 status='published' (拿去跑选型), 不见草稿。
 *   - 写(建/改/发布/删): 仅维护组角色 (PMS_SELECTOR_MAINTAINER_ROLES = 管理写权组 + champion)。
 *     普通 employee / 外部一律拒 → 规则发布即改全渠道推荐, 属治理敏感写。写操作全程 audit 留痕。
 * runSelector: 载入规则集 + 产品目录快照 → 纯引擎 evaluateSelector → 推荐系统。
 */

import { nanoid } from 'nanoid';
import { db } from '../infra/drizzle-client';
import { pmsSelectorRulesets, pmsSelectorRulesetVersions, pmsProductCatalog } from '../infra/drizzle-schema';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { audit } from '../audit/log';
import { PMS_SELECTOR_MAINTAINER_ROLES } from '../auth/roles';
import { validateRuleSetConfig } from './selector-validate';
import type { QuoteAuthCtx } from './quote-service';
import { evaluateSelector, type SelectorCatalogProduct, type SelectorInputs } from './selector-engine';
import type {
  SelectorRuleSet,
  SelectorRuleSetStatus,
  SelectorRuleSetVersion,
  SelectorInputField,
  SelectorRule,
  SelectorResult,
} from '@/lib/types/pms';

type Row = typeof pmsSelectorRulesets.$inferSelect;

function mapRuleSet(row: Row): SelectorRuleSet {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    category: row.category || undefined,
    scenario: row.scenario || undefined,
    description: row.description || undefined,
    systemName: row.systemName || undefined,
    version: row.version,
    status: row.status as SelectorRuleSetStatus,
    inputFields: (row.inputFields as SelectorInputField[] | null) ?? [],
    rules: (row.rules as SelectorRule[] | null) ?? [],
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString(),
    archivedAt: row.archivedAt?.toISOString(),
  };
}

/** 外部经销商仅可见已发布规则集 */
function canSee(row: Row, auth: QuoteAuthCtx): boolean {
  if (auth.isInternal) return true;
  return row.status === 'published';
}

/** 是否有选型规则集维护权 (内部 + 命中维护组角色) */
export function canManageSelectors(auth: QuoteAuthCtx): boolean {
  if (!auth.isInternal) return false;
  const roles = auth.roles ?? [];
  return roles.some((r) => (PMS_SELECTOR_MAINTAINER_ROLES as readonly string[]).includes(r));
}

function assertCanMaintain(auth: QuoteAuthCtx): void {
  if (!canManageSelectors(auth)) {
    throw new Response('仅选型维护组 (管理层/数据管家/推广大使) 可维护选型规则集', { status: 403 });
  }
}

/** 乐观并发锁: 调用方传入其读取时的 updatedAt, 若与库中不一致 → 409 (他人已改) */
function assertNotStale(existing: SelectorRuleSet, expectedUpdatedAt?: string): void {
  if (expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
    throw new Response('规则集已被他人修改, 请刷新后重试', { status: 409 });
  }
}

export async function listRuleSets(
  filters: { category?: string; status?: SelectorRuleSetStatus; limit?: number },
  auth: QuoteAuthCtx,
): Promise<SelectorRuleSet[]> {
  const conds = [eq(pmsSelectorRulesets.tenantId, auth.tenantId), isNull(pmsSelectorRulesets.archivedAt)];
  if (filters.category) conds.push(eq(pmsSelectorRulesets.category, filters.category));
  if (filters.status) conds.push(eq(pmsSelectorRulesets.status, filters.status));
  const rows = await db
    .select()
    .from(pmsSelectorRulesets)
    .where(and(...conds))
    .orderBy(desc(pmsSelectorRulesets.updatedAt))
    .limit(filters.limit ?? 100);
  return rows.filter((r) => canSee(r, auth)).map(mapRuleSet);
}

export async function getRuleSet(id: string, auth: QuoteAuthCtx): Promise<SelectorRuleSet | null> {
  const rows = await db
    .select()
    .from(pmsSelectorRulesets)
    .where(and(eq(pmsSelectorRulesets.id, id), eq(pmsSelectorRulesets.tenantId, auth.tenantId)))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (row.archivedAt || !canSee(row, auth)) return null;
  return mapRuleSet(row);
}

export interface RuleSetWriteInput {
  name: string;
  category?: string;
  scenario?: string;
  description?: string;
  systemName?: string;
  inputFields?: SelectorInputField[];
  rules?: SelectorRule[];
}

export async function createRuleSet(input: RuleSetWriteInput, auth: QuoteAuthCtx): Promise<SelectorRuleSet> {
  assertCanMaintain(auth);
  if (!input.name?.trim()) throw new Response('规则集名称必填', { status: 400 });
  const configErrors = validateRuleSetConfig(input.inputFields ?? [], input.rules ?? []);
  if (configErrors.length) throw new Response(`配置校验失败: ${configErrors.join('; ')}`, { status: 400 });
  const now = new Date();
  const id = nanoid();
  await db.insert(pmsSelectorRulesets).values({
    id,
    tenantId: auth.tenantId,
    name: input.name.trim(),
    category: input.category ?? null,
    scenario: input.scenario ?? null,
    description: input.description ?? null,
    systemName: input.systemName ?? null,
    version: 1,
    status: 'draft',
    inputFields: input.inputFields ?? [],
    rules: input.rules ?? [],
    createdBy: auth.userId,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    archivedAt: null,
  });
  return (await getRuleSet(id, auth))!;
}

export async function updateRuleSet(
  id: string,
  patch: Partial<RuleSetWriteInput> & { status?: SelectorRuleSetStatus; expectedUpdatedAt?: string },
  auth: QuoteAuthCtx,
): Promise<SelectorRuleSet> {
  assertCanMaintain(auth);
  const existing = await getRuleSet(id, auth);
  if (!existing) throw new Response('规则集不存在或无权限', { status: 404 });
  assertNotStale(existing, patch.expectedUpdatedAt);

  // 若本次改动触及配置 (inputFields/rules), 校验合并后的完整配置
  if (patch.inputFields !== undefined || patch.rules !== undefined) {
    const fields = patch.inputFields ?? existing.inputFields;
    const rules = patch.rules ?? existing.rules;
    const configErrors = validateRuleSetConfig(fields, rules);
    if (configErrors.length) throw new Response(`配置校验失败: ${configErrors.join('; ')}`, { status: 400 });
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name.trim();
  if (patch.category !== undefined) set.category = patch.category ?? null;
  if (patch.scenario !== undefined) set.scenario = patch.scenario ?? null;
  if (patch.description !== undefined) set.description = patch.description ?? null;
  if (patch.systemName !== undefined) set.systemName = patch.systemName ?? null;
  if (patch.inputFields !== undefined) set.inputFields = patch.inputFields;
  if (patch.rules !== undefined) set.rules = patch.rules;
  if (patch.status !== undefined) {
    set.status = patch.status;
    if (patch.status === 'published') set.publishedAt = new Date();
  }
  await db.update(pmsSelectorRulesets).set(set).where(eq(pmsSelectorRulesets.id, id));
  await audit('pms.selector.updated', auth.userId, {
    targetId: id,
    targetType: 'pms_selector_ruleset',
    tenantId: auth.tenantId,
    metadata: { name: existing.name, changedStatus: patch.status ?? null },
  });
  return (await getRuleSet(id, auth))!;
}

/** 发布 (draft/archived → published, version+1) + 冻结版本快照 */
export async function publishRuleSet(
  id: string,
  auth: QuoteAuthCtx,
  expectedUpdatedAt?: string,
): Promise<SelectorRuleSet> {
  assertCanMaintain(auth);
  const existing = await getRuleSet(id, auth);
  if (!existing) throw new Response('规则集不存在或无权限', { status: 404 });
  assertNotStale(existing, expectedUpdatedAt);
  if (!existing.rules.length) throw new Response('规则集无规则, 无法发布', { status: 400 });
  const configErrors = validateRuleSetConfig(existing.inputFields, existing.rules);
  if (configErrors.length) throw new Response(`配置校验失败, 无法发布: ${configErrors.join('; ')}`, { status: 400 });
  const nextVersion = existing.version + 1;
  const now = new Date();
  await db
    .update(pmsSelectorRulesets)
    .set({ status: 'published', publishedAt: now, version: nextVersion, updatedAt: now })
    .where(eq(pmsSelectorRulesets.id, id));
  // 冻结版本快照 (不就地覆盖丢历史)
  await db.insert(pmsSelectorRulesetVersions).values({
    id: nanoid(),
    tenantId: auth.tenantId,
    rulesetId: id,
    version: nextVersion,
    name: existing.name,
    category: existing.category ?? null,
    scenario: existing.scenario ?? null,
    systemName: existing.systemName ?? null,
    inputFields: existing.inputFields,
    rules: existing.rules,
    publishedBy: auth.userId,
    publishedAt: now,
  });
  await audit('pms.selector.published', auth.userId, {
    targetId: id,
    targetType: 'pms_selector_ruleset',
    tenantId: auth.tenantId,
    metadata: { name: existing.name, version: nextVersion, ruleCount: existing.rules.length },
  });
  return (await getRuleSet(id, auth))!;
}

/** 列出规则集的已发布版本快照 (最新在前) */
export async function listRuleSetVersions(rulesetId: string, auth: QuoteAuthCtx): Promise<SelectorRuleSetVersion[]> {
  // 复用可见性: 能看到规则集才能看其版本
  const rs = await getRuleSet(rulesetId, auth);
  if (!rs) throw new Response('规则集不存在或无权限', { status: 404 });
  const rows = await db
    .select()
    .from(pmsSelectorRulesetVersions)
    .where(and(eq(pmsSelectorRulesetVersions.tenantId, auth.tenantId), eq(pmsSelectorRulesetVersions.rulesetId, rulesetId)))
    .orderBy(desc(pmsSelectorRulesetVersions.version));
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    rulesetId: r.rulesetId,
    version: r.version,
    name: r.name,
    category: r.category ?? undefined,
    scenario: r.scenario ?? undefined,
    systemName: r.systemName ?? undefined,
    inputFields: (r.inputFields as SelectorInputField[]) ?? [],
    rules: (r.rules as SelectorRule[]) ?? [],
    publishedBy: r.publishedBy,
    publishedAt: r.publishedAt.toISOString(),
  }));
}

/** 软删 (archivedAt) */
export async function deleteRuleSet(id: string, auth: QuoteAuthCtx): Promise<void> {
  assertCanMaintain(auth);
  const existing = await getRuleSet(id, auth);
  if (!existing) throw new Response('规则集不存在或无权限', { status: 404 });
  await db
    .update(pmsSelectorRulesets)
    .set({ archivedAt: new Date(), status: 'archived', updatedAt: new Date() })
    .where(eq(pmsSelectorRulesets.id, id));
  await audit('pms.selector.deleted', auth.userId, {
    targetId: id,
    targetType: 'pms_selector_ruleset',
    tenantId: auth.tenantId,
    metadata: { name: existing.name },
  });
}

/** 载入本地产品目录快照 (source=import/manual 报价选型库; active) — 分页取全, 不设硬上限 */
async function loadCatalogSnapshot(tenantId: string): Promise<SelectorCatalogProduct[]> {
  const PAGE = 1000;
  const out: SelectorCatalogProduct[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const rows = await db
      .select()
      .from(pmsProductCatalog)
      .where(and(eq(pmsProductCatalog.tenantId, tenantId), eq(pmsProductCatalog.status, 'active')))
      .orderBy(pmsProductCatalog.id)
      .limit(PAGE)
      .offset(offset);
    for (const r of rows) {
      out.push({
        id: r.id,
        model: r.model,
        series: r.series || undefined,
        specification: r.specification || undefined,
        unit: r.unit || undefined,
        listPrice: r.listPrice != null ? parseFloat(r.listPrice) : undefined,
        category: r.category || undefined,
        attributes: (r.attributes as Record<string, string> | null) ?? {},
      });
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

/**
 * 运行选型: 载入规则集 (须 published, 内部可跑草稿预览) + 产品目录 → 引擎评估。
 */
export async function runSelector(
  rulesetId: string,
  inputs: SelectorInputs,
  auth: QuoteAuthCtx,
): Promise<SelectorResult> {
  const ruleset = await getRuleSet(rulesetId, auth);
  if (!ruleset) throw new Response('规则集不存在或无权限', { status: 404 });
  if (ruleset.status !== 'published' && !auth.isInternal) {
    throw new Response('规则集未发布', { status: 400 });
  }
  const catalog = await loadCatalogSnapshot(auth.tenantId);
  return evaluateSelector(ruleset, inputs, catalog);
}

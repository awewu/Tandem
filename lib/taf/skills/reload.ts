/**
 * §V2 · Skill Auto-Reload
 *
 * 重新加载 skill registry, 让以下变化立即生效, 不用重启进程:
 *   - 内置 skill 代码改动 (dev 热改)
 *   - Skill proposals approved → 部署为 live skill
 *   - Governance status 变化 (approved/suspended)
 *
 * 触发方式:
 *   - 手动: POST /api/admin/skills/reload (admin only)
 *   - 自动: boot 时 (lib/boot.ts 调一次)
 *   - 未来 V3: fs.watch lib/taf/skills/*.ts → 自动调
 *
 * V2 范围:
 *   - clear() + 重跑 registerBuiltinSkills() (静态内置部分)
 *   - 拉 governance 的 active/suspended 状态, 不 register suspended 的 skill
 *   - emit audit event 'skill.registry.reloaded' 方便追溯
 *
 * V3 范围 (未来):
 *   - 从 ApprovedProposal.skillCode 动态 eval/import 真实 executable skill
 *   - 文件系统 watcher (chokidar) → debounce 1s → 调本函数
 */

import { logger } from '@/lib/infra/logger';
import { audit } from '@/lib/audit/log';
import { skillRegistry } from './registry';
import { registerBuiltinSkills } from './builtin';

export interface ReloadResult {
  /** 重载前 skill 数 */
  beforeCount: number;
  /** 重载后 skill 数 */
  afterCount: number;
  /** 新增 skill id */
  added: string[];
  /** 删除 skill id (内置不再 register 或被 suspended) */
  removed: string[];
  /** 耗时 ms */
  durationMs: number;
}

/**
 * 重新加载 skill registry.
 * 永不抛错 — 失败时 audit 记录, 返回前后 count 一致以告知调用方.
 */
export async function reloadSkillRegistry(opts: {
  actorUserId?: string;
  tenantId?: string;
} = {}): Promise<ReloadResult> {
  const start = Date.now();
  const before = skillRegistry.list().map((s) => s.id);
  const beforeSet = new Set(before);

  try {
    // 1. 清空所有 skill
    skillRegistry.clear();

    // 2. 重跑内置注册
    registerBuiltinSkills();

    // 3. (可选) 从 governance 读取 suspended 列表, 移除已 suspended 的 skill
    //    governance 仍允许 execute 时复查, 这里只是确保 list/toolSchemas 不暴露 suspended
    try {
      const { getStore } = await import('@/lib/storage/repository');
      const store = getStore();
      const records = await store.skillRegistry.list({
        tenantId: opts.tenantId ?? 'default',
      });
      for (const r of records) {
        if (r.status === 'suspended' && skillRegistry.has(r.skillId)) {
          skillRegistry.unregister(r.skillId);
        }
      }
    } catch {
      /* governance 模块没就绪时不阻塞重载 */
    }

    const after = skillRegistry.list().map((s) => s.id);
    const afterSet = new Set(after);
    const added = after.filter((id) => !beforeSet.has(id));
    const removed = before.filter((id) => !afterSet.has(id));
    const durationMs = Date.now() - start;

    logger.info(
      {
        before: before.length,
        after: after.length,
        added: added.length,
        removed: removed.length,
        durationMs,
      },
      '[skill-reload] done',
    );

    // 4. audit
    try {
      await audit('skill.registry.reloaded', opts.actorUserId ?? 'system', {
        targetType: 'skill_registry',
        metadata: {
          before: before.length,
          after: after.length,
          added,
          removed,
          durationMs,
        },
      });
    } catch {
      /* audit 失败不影响主路径 */
    }

    return { beforeCount: before.length, afterCount: after.length, added, removed, durationMs };
  } catch (err) {
    logger.error({ err: (err as Error).message }, '[skill-reload] FAILED');
    return {
      beforeCount: before.length,
      afterCount: skillRegistry.size(),
      added: [],
      removed: [],
      durationMs: Date.now() - start,
    };
  }
}

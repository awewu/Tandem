/**
 * Persona 查找 · 分身编队 (B-037 · M2) 的单一入口
 *
 * 背景: 引入技能分身后, 一个员工的 `personas.list({userId})` 会返回
 *   1 个主分身 (kind='primary' 或旧数据无 kind) + N 个技能分身 (kind='skill')。
 *   旧代码到处用 `list({userId})[0]` 取"本人分身", 在 drizzle KvStore
 *   (按 updatedAt desc 排序) 下会误取到刚 fork/更新的技能分身 → 破坏语义。
 *
 * 所有"取本人(主)分身"的调用点必须经 getPrimaryPersona, 保证只拿主分身。
 * 向后兼容: 存量分身无 kind 字段, 视为主分身 (kind !== 'skill')。
 */

import { getStore } from '../storage/repository';
import type { Persona } from '../types/persona';

/** 取某员工的主分身 (kind='primary' 或旧数据无 kind); 无则 null。 */
export async function getPrimaryPersona(userId: string): Promise<Persona | null> {
  const store = getStore();
  const list = await store.personas.list({ userId } as never);
  return list.find((p) => p.kind !== 'skill') ?? null;
}

/** 取某员工的全部技能分身 (kind='skill'), 按创建时间升序 (稳定顺序)。 */
export async function listSkillPersonas(userId: string): Promise<Persona[]> {
  const store = getStore();
  const list = await store.personas.list({ userId } as never);
  return list
    .filter((p) => p.kind === 'skill')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

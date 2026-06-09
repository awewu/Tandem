/**
 * lib/ontology/registry.ts · 本体对象注册中心 (ON-0 · 2026-06-09)
 *
 * 镜像 lib/taf/skills/registry.ts 的单例范式 (globalThis 防 Next.js dev HMR 重置)。
 * 职责: 注册 ObjectType、按 (type,id) resolve、按关系名 traverse、确定性 search。
 *
 * 只读: 本注册中心不提供任何写入口 (写动作走 ON-1 Action Type)。
 */

import type { ObjectType, ObjectTypeId, ResolvedObject } from './types';

class OntologyRegistry {
  private types = new Map<ObjectTypeId, ObjectType>();

  register<T extends { id: string }>(ot: ObjectType<T>): void {
    this.types.set(ot.id, ot as unknown as ObjectType);
  }

  unregister(id: ObjectTypeId): boolean {
    return this.types.delete(id);
  }

  clear(): void {
    this.types.clear();
  }

  has(id: ObjectTypeId): boolean {
    return this.types.has(id);
  }

  get(id: ObjectTypeId): ObjectType | undefined {
    return this.types.get(id);
  }

  list(): ObjectType[] {
    return Array.from(this.types.values());
  }

  size(): number {
    return this.types.size;
  }

  /** 按 (type,id) 解析对象, 附派生真值 + 可遍历关系元信息。未注册类型或对象不存在 → null。 */
  async resolve(typeId: ObjectTypeId, id: string): Promise<ResolvedObject | null> {
    const ot = this.types.get(typeId);
    if (!ot) return null;
    const data = await ot.resolve(id);
    if (!data) return null;
    return this.wrap(ot, data);
  }

  /**
   * 遍历某对象的一个关系, 返回解析后的目标对象 (one → ResolvedObject|null; many → ResolvedObject[])。
   * 目标类型已注册则附其派生真值; 未注册则原样包一层 (derived 空)。
   */
  async traverse(
    typeId: ObjectTypeId,
    id: string,
    linkName: string,
  ): Promise<ResolvedObject | ResolvedObject[] | null> {
    const ot = this.types.get(typeId);
    if (!ot) return null;
    const data = await ot.resolve(id);
    if (!data) return null;
    const link = ot.links.find((l) => l.name === linkName);
    if (!link) return null;

    const resolved = await link.resolve(data);
    if (resolved == null) return link.cardinality === 'many' ? [] : null;

    const targetOt = this.types.get(link.targetType);
    const toResolved = (obj: unknown): ResolvedObject => {
      const rec = obj as { id: string };
      if (targetOt) return this.wrap(targetOt, rec);
      return { type: link.targetType, id: rec.id, data: rec, derived: {}, links: [] };
    };

    if (link.cardinality === 'many') {
      const arr = Array.isArray(resolved) ? resolved : [resolved];
      return arr.map(toResolved);
    }
    return toResolved(resolved);
  }

  /** 确定性检索 (委托 ObjectType.search)。未注册 → []。 */
  async search(
    typeId: ObjectTypeId,
    query: string,
    opts?: { limit?: number },
  ): Promise<Array<{ id: string }>> {
    const ot = this.types.get(typeId);
    if (!ot) return [];
    return ot.search(query, opts);
  }

  private wrap(ot: ObjectType, data: { id: string }): ResolvedObject {
    return {
      type: ot.id,
      id: data.id,
      data,
      derived: ot.derived ? ot.derived(data) : {},
      links: ot.links.map((l) => ({
        name: l.name,
        targetType: l.targetType,
        cardinality: l.cardinality,
      })),
    };
  }
}

// 单例挂 globalThis 防 Next.js dev HMR 重置 (object-types 在 import 时注册一次, 不能因 HMR 丢失)
const _g = globalThis as typeof globalThis & { __tandem_ontology_registry__?: OntologyRegistry };
if (!_g.__tandem_ontology_registry__) {
  _g.__tandem_ontology_registry__ = new OntologyRegistry();
}
export const ontology: OntologyRegistry = _g.__tandem_ontology_registry__;
export type { OntologyRegistry };

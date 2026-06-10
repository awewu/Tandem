/**
 * 知识库 (Knowledge) · 文件树节点类型
 *
 * 把原 /knowledge 的纯前端 zustand-persist (localStorage) 迁移为后端持久化:
 * 与 /shouchao、/memories 同一套 KvStore 模式 (collection='knowledge_nodes', 无迁移, 幂等).
 *
 * 隔离: 每个节点归属 ownerId, 列表/读写均按 ownerId 过滤 (换设备/换浏览器数据不再丢).
 * ownership (公司/部门/团队/个人) 是与 ownerId 正交的"知识归属分级", 仅做可见性语义标记.
 */

export type KnowledgeOwnership = 'company' | 'department' | 'team' | 'personal';

export interface KnowledgeNode {
  id: string;
  /** 节点归属用户 (隔离: 每人只见自己的) */
  ownerId: string;
  tenantId: string;
  name: string;
  type: 'folder' | 'file';
  /** 父节点 id; 顶层节点 parentId='root' (root 为虚拟根, 不入库) */
  parentId: string | null;
  /** 文件正文 (folder 时为空) */
  content?: string;
  /** Memory ownership 4 级 (与 /memories 同语义, 仅 UI 可见性标记) */
  ownership?: KnowledgeOwnership;
  /** 软删墓碑 (设置后列表不可见, 保留供审计) */
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

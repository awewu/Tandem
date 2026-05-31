/**
 * lib/store/knowledge.ts · Knowledge 知识库 (region 2)
 *
 * 从 lib/store.ts 机械拆分 (B8, 2026-05-31). 行为/persist key 不变.
 * persist key: 铁山-knowledge-store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// #region 2 · Knowledge ─────────────────────────────────────────────
export interface KNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string | null;
  content?: string;
  /**
   * Q1 (2026-05-10) Memory ownership 4 级.
   * 与 /memories (Tandem curated Memory) 同语义.
   * undefined = 未分级, 在筛选 "全部" 时显示.
   */
  ownership?: 'company' | 'department' | 'team' | 'personal';
  createdAt: number;
}

interface KnowledgeStore {
  nodes: KNode[];
  setNodes: (nodes: KNode[]) => void;
  addNode: (n: KNode) => void;
  updateNode: (id: string, patch: Partial<KNode>) => void;
  deleteNode: (id: string) => void;
  /** 批量删除（递归删除文件夹的所有后代） */
  deleteNodes: (ids: string[]) => void;
  /** 批量移动 */
  moveNodes: (ids: string[], targetParentId: string) => void;
}

export const useKnowledgeStore = create<KnowledgeStore>()(
  persist(
    (set) => ({
      nodes: [
        { id: 'root', name: '知识库', type: 'folder', parentId: null, createdAt: Date.now() },
        { id: 'docs', name: '文档', type: 'folder', parentId: 'root', createdAt: Date.now() },
        { id: 'hermes-output', name: 'Hermes产出', type: 'folder', parentId: 'root', createdAt: Date.now() },
        { id: 'design', name: '设计资源', type: 'folder', parentId: 'root', createdAt: Date.now() },
      ],
      setNodes: (nodes) => set({ nodes }),
      addNode: (n) => set((state) => ({ nodes: [...state.nodes, n] })),
      updateNode: (id, patch) =>
        set((state) => ({
          nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
        })),
      deleteNode: (id) =>
        set((state) => {
          // 递归收集所有后代
          const toDelete = new Set<string>([id]);
          let added = true;
          while (added) {
            added = false;
            for (const n of state.nodes) {
              if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
                toDelete.add(n.id);
                added = true;
              }
            }
          }
          return { nodes: state.nodes.filter((n) => !toDelete.has(n.id)) };
        }),
      deleteNodes: (ids) =>
        set((state) => {
          const toDelete = new Set<string>(ids);
          let added = true;
          while (added) {
            added = false;
            for (const n of state.nodes) {
              if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
                toDelete.add(n.id);
                added = true;
              }
            }
          }
          return { nodes: state.nodes.filter((n) => !toDelete.has(n.id)) };
        }),
      moveNodes: (ids, targetParentId) =>
        set((state) => {
          // 防止把节点移到自身或自身后代下面
          const idSet = new Set(ids);
          const isInBranch = (candidateAncestor: string, child: string): boolean => {
            let cur: KNode | undefined = state.nodes.find((n) => n.id === child);
            while (cur?.parentId) {
              if (cur.parentId === candidateAncestor) return true;
              cur = state.nodes.find((n) => n.id === cur!.parentId);
            }
            return false;
          };
          return {
            nodes: state.nodes.map((n) => {
              if (!idSet.has(n.id)) return n;
              if (n.id === targetParentId) return n; // can't move into self
              if (isInBranch(n.id, targetParentId)) return n; // can't move into descendant
              return { ...n, parentId: targetParentId };
            }),
          };
        }),
    }),
    { name: '铁山-knowledge-store' }
  )
);
// #endregion

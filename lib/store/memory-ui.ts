/**
 * lib/store/memory-ui.ts · Memory UI 简化版 (region 6)
 *
 * 从 lib/store.ts 机械拆分 (B8, 2026-05-31). 行为不变 (无 persist).
 * 注意: 这是 UI 简化版 Memory, 治理层 (签批/referenceCount) 在 lib/memory + lib/types/memory.ts.
 */

import { create } from 'zustand';

// #region 6 · Memory (UI simplified; governance lives in lib/memory) ─
export interface Memory {
  id: string;
  title: string;
  content: string;
  category: 'requirement' | 'consensus' | 'standard' | 'context';
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: number;
  updatedAt: number;
  version: number;
  isActive: boolean;
  /** v2 起：所属文件夹 id；老数据自动按 category 落到 cat-{category} 文件夹下 */
  parentId?: string | null;
}

export interface MemoryFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

interface MemoryStore {
  memories: Memory[];
  folders: MemoryFolder[];
  /** P1-1: 从后端 /api/tandem/memory/list 同步 (个人记事本 hydrate) */
  hydrateMemories: (items: Memory[]) => void;
  addMemory: (m: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => void;
  updateMemory: (id: string, patch: Partial<Omit<Memory, 'id' | 'createdAt'>>) => void;
  deleteMemory: (id: string) => void;
  /** 批量删除 memory 节点；id 命中文件夹时，递归删除其下所有 memory + 子文件夹 */
  deleteMemoryNodes: (ids: string[]) => void;
  /** 批量移动 memory/文件夹到目标文件夹 */
  moveMemoryNodes: (ids: string[], targetFolderId: string) => void;
  toggleActive: (id: string) => void;
  /** 创建文件夹 */
  addFolder: (name: string, parentId: string) => void;
  /** 重命名文件夹 */
  renameFolder: (id: string, newName: string) => void;
  getActiveMemories: () => Memory[];
  getByCategory: (category: Memory['category']) => Memory[];
  /** 把 active 且 priority>=high 的 memory 拼成 system prompt 前缀，用于注入对话 */
  getBaselineSystemPrompt: () => string;
  exportMemories: () => string;
  importMemories: (json: string) => void;
}

/**
 * A4 (2026-05-11): drop persist.
 * useMemoryStore 后端 (DecisionCard / MemoryEntry / PromotionRequest) 已通过
 * /api/tandem/memory/* 接入. /memories UI 切 API 走 A2.3 后续迭代,
 * 此处先 drop persist 避免 stale demo 数据继续残留.
 */
export const useMemoryStore = create<MemoryStore>()(
  ((set, get) => ({
      folders: [
        { id: 'mem-root', name: '记忆库', parentId: null, createdAt: Date.now() },
        { id: 'cat-requirement', name: '需求', parentId: 'mem-root', createdAt: Date.now() },
        { id: 'cat-consensus', name: '共识', parentId: 'mem-root', createdAt: Date.now() },
        { id: 'cat-standard', name: '标准', parentId: 'mem-root', createdAt: Date.now() },
        { id: 'cat-context', name: '上下文', parentId: 'mem-root', createdAt: Date.now() },
      ],
      memories: [],
      hydrateMemories: (items) => set({ memories: items }),
      addMemory: (m) => {
        const now = Date.now();
        const newMemory: Memory = {
          ...m,
          // 没显式给 parentId 则按 category 落到对应默认文件夹
          parentId: m.parentId ?? `cat-${m.category}`,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          version: 1,
        };
        set((state) => ({ memories: [newMemory, ...state.memories] }));
      },
      updateMemory: (id, patch) =>
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id
              ? { ...m, ...patch, updatedAt: Date.now(), version: m.version + 1 }
              : m
          ),
        })),
      deleteMemory: (id) =>
        set((state) => ({
          memories: state.memories.filter((m) => m.id !== id),
        })),
      deleteMemoryNodes: (ids) =>
        set((state) => {
          // 递归收集要删的文件夹后代
          const folderIdsToDelete = new Set<string>(
            ids.filter((id) => state.folders.some((f) => f.id === id))
          );
          let added = true;
          while (added) {
            added = false;
            for (const f of state.folders) {
              if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
                folderIdsToDelete.add(f.id);
                added = true;
              }
            }
          }
          // memory：被显式选中的 + 在被删文件夹下的
          const memIdsToDelete = new Set<string>(
            ids.filter((id) => state.memories.some((m) => m.id === id))
          );
          for (const m of state.memories) {
            if (m.parentId && folderIdsToDelete.has(m.parentId)) memIdsToDelete.add(m.id);
          }
          return {
            folders: state.folders.filter((f) => !folderIdsToDelete.has(f.id)),
            memories: state.memories.filter((m) => !memIdsToDelete.has(m.id)),
          };
        }),
      moveMemoryNodes: (ids, targetFolderId) =>
        set((state) => {
          // 防止把文件夹移到自身或自身后代下
          const isInBranch = (ancestor: string, candidate: string): boolean => {
            let cur: MemoryFolder | undefined = state.folders.find((f) => f.id === candidate);
            while (cur?.parentId) {
              if (cur.parentId === ancestor) return true;
              cur = state.folders.find((f) => f.id === cur!.parentId);
            }
            return false;
          };
          const idSet = new Set(ids);
          const folders = state.folders.map((f) => {
            if (!idSet.has(f.id)) return f;
            if (f.id === targetFolderId) return f;
            if (isInBranch(f.id, targetFolderId)) return f;
            return { ...f, parentId: targetFolderId };
          });
          const memories = state.memories.map((m) =>
            idSet.has(m.id) ? { ...m, parentId: targetFolderId, updatedAt: Date.now() } : m
          );
          return { folders, memories };
        }),
      addFolder: (name, parentId) =>
        set((state) => ({
          folders: [
            ...state.folders,
            { id: crypto.randomUUID(), name, parentId, createdAt: Date.now() },
          ],
        })),
      renameFolder: (id, newName) =>
        set((state) => ({
          folders: state.folders.map((f) => (f.id === id ? { ...f, name: newName } : f)),
        })),
      toggleActive: (id) =>
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, isActive: !m.isActive, updatedAt: Date.now() } : m
          ),
        })),
      getActiveMemories: () => get().memories.filter((m) => m.isActive),
      getByCategory: (category) => get().memories.filter((m) => m.category === category),
      getBaselineSystemPrompt: () => {
        // 只注入 active 且 critical/high 的 memory，避免 prompt 过长
        const items = get().memories.filter(
          (m) => m.isActive && (m.priority === 'critical' || m.priority === 'high')
        );
        if (items.length === 0) return '';
        const sections = items
          .sort((a, b) => (a.priority === 'critical' ? -1 : 1) - (b.priority === 'critical' ? -1 : 1))
          .map((m) => `- [${m.category}/${m.priority}] ${m.title}\n  ${m.content}`)
          .join('\n');
        return `# 公司基线（必须遵守）\n以下是公司层面注入的标准/共识/要求，请在所有回答中严格遵守：\n${sections}\n`;
      },
      exportMemories: () => JSON.stringify(get().memories, null, 2),
      importMemories: (json) => {
        try {
          const imported = JSON.parse(json) as Memory[];
          const now = Date.now();
          const validated = imported.map((m) => ({
            ...m,
            id: m.id || crypto.randomUUID(),
            createdAt: m.createdAt || now,
            updatedAt: now,
            version: m.version || 1,
          }));
          set({ memories: validated });
        } catch (e) {
          console.error('Failed to import memories:', e);
        }
      },
    }))
);
// #endregion

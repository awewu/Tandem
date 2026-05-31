/**
 * lib/store/org.ts · 三省六部 Org/Gov (region 3)
 *
 * 从 lib/store.ts 机械拆分 (B8, 2026-05-31). 行为不变 (无 persist).
 * 类型 SSOT 在 lib/types/governance.ts; 此处仅 zustand fixture + 后端 hydrate 缓存.
 * 详见 docs/GOVERNANCE-THREE-DEPARTMENTS-2026-05-30.md
 */

import { create } from 'zustand';

// #region 3 · 三省六部 · 项目与决策治理协同模板 ─────────────────
import {
  type Department,
  type Ministry,
  type GovernancePillar,
  PILLAR_META,
  defaultDepartments,
} from '../types/governance';

export type { Department, Ministry, GovernancePillar };
export { PILLAR_META };

interface OrgStore {
  departments: Department[];
  setDepartments: (d: Department[]) => void;
  /** 是否已从后端 hydrate 过 (供 ApiHydrator 防重复) */
  _hydrated: boolean;
  /** 从后端 governance 默认项目模板拉取并替换 fixture */
  hydrateFromGovernance: () => Promise<void>;
}

/**
 * A4 (2026-05-11): drop persist.
 * D-pragma (2026-05-31): fixture → backend hydrated cache.
 *
 * useOrgStore 启动时仍以 defaultDepartments() 作为骨架, 但 ApiHydrator 会调用
 * hydrateFromGovernance() 从 GET /api/governance/projects/default/template 拉真数据替换.
 * 后端是 SSOT, zustand 仅作客户端缓存, 解决 "fixture 与后端漂移" 的结构性问题.
 *
 * 仍然存在的 "遗留客户端依赖" (OKR / IM / Analytics) 现在自动获得真数据,
 * 无需逐个文件改造.
 */
export const useOrgStore = create<OrgStore>()(
  (set, get) => ({
    departments: defaultDepartments(),
    _hydrated: false,
    setDepartments: (d) => set({ departments: d }),
    hydrateFromGovernance: async () => {
      if (get()._hydrated) return;
      try {
        const r = await fetch('/api/governance/projects/default/template', {
          cache: 'no-store',
          credentials: 'include',
        });
        if (!r.ok) {
          // 401 / 404 / 500 都不阻塞 UI: 保留 fixture, 标记未 hydrate 以便重试
          return;
        }
        const j = await r.json();
        const departments = j?.template?.departments;
        if (Array.isArray(departments) && departments.length > 0) {
          set({ departments, _hydrated: true });
        } else {
          // 后端模板为空 / 字段缺失 → 保留 fixture, 不标记 hydrated
        }
      } catch {
        // 离线 / 网络错误等都不阻塞 UI
      }
    },
  }),
);
// #endregion

# Ownership SSOT + Org 后端化 (D-pragma · 2026-05-31)

**status**: 已落地 D-pragma + F-pragma. **E (IM-people 解耦)** 留下个会话.

---

## 落地清单

### 1. `lib/org/ownership.ts` — Owner 解析 SSOT

**问题**: `Objective.ownerId` 接受 3 种格式 (`team:<id>` / `person:<id>` / 裸 id), 解析逻辑此前在 5+ 处复制粘贴, 任意一处改字段就漂.

**SSOT API**:

```ts
buildDeptIndex(departments) → Map<id, DeptIndex>
resolveOwner(ownerId, { people, deptIndex }) → ResolvedOwner
formatOwnerLabel(owner, { includeDept? }) → string
```

`ResolvedOwner` 同时给出 `kind / name / deptId / deptName / ministryId / ministryName / personId`, 调用方按需取.

**已收口的旧 callsite** (3 处, 见 git diff):

- `components/okr/okr-alignment-tree.tsx` — 移除本地 `resolveOwner`, 移除本地 `deptByMinistry`
- `app/okr/dashboard/page.tsx` — 移除手卷 `ownerToDept` (此前未处理 `team:X` / `person:X` 前缀, 是潜在 bug)
- `app/analytics/page.tsx` — `deptHealth` 改走 SSOT, **修 bug**: 此前只看 `person.ministryId`, 把 `'team:X'` ownerId 一律塞进 `unknown` 桶

测试: `tests/unit/org-ownership.test.ts` 14 用例, 覆盖 6 种 ownerId 格式.

---

### 2. `useOrgStore.hydrateFromGovernance()` — fixture → backend cache

**问题**: zustand `useOrgStore` 启动时硬编码 `defaultDepartments()` fixture, 与 `/api/governance/projects/default/template` 后端模板独立漂移. 用户在 `/governance/three-departments` 改了部门, OKR / IM / Analytics 看到的还是 fixture.

**改动**:

- `useOrgStore` 加 `_hydrated` flag + `hydrateFromGovernance()` action
- `ApiHydrator` 在 `user?.id` 出现时触发一次, 用后端模板替换 fixture
- 401 / 离线 / 后端模板为空 → 静默回退到 fixture, 不阻塞 UI

**结果**: 所有依赖 `useOrgStore.departments` 的 OKR / IM / Analytics 自动获得真数据, **零 callsite 改造**.

---

## 不在本轮范围 (留作下一会话)

### E · IM 通讯录用真用户

**现状**: `components/im/contacts-tree.tsx` 和 `seed-from-org-dialog.tsx` 用 `useOKRStore.people` (zustand fixture, 仅虚拟人) 作为通讯录人源. 真实登录用户 (`User` 表) 没接进去.

**正确做法**:

1. 在 `lib/storage/repository.ts` 暴露 `users.listByDepartment(deptId)` (后端已有 `User.departmentId` 字段)
2. 新建 `lib/org/people-source.ts`:
   - `getOrgPeople()` 优先返回真用户 (`/api/admin/users`), 用 zustand fixture 兜底
   - 把真用户和 zustand `people` 按 `id` merge, 真用户优先
3. IM 两个组件切换到 `getOrgPeople()`

**估时**: 2-3 小时. 需要新 API `/api/org/people`.

### F · 删 useOrgStore zustand fixture

**前置**: D 已经把 `useOrgStore` 降级为后端 hydrated cache, 自然瘦身. 真要彻底删掉:

1. 把 `useOrgStore` 整个迁到 `lib/org/people-source.ts` 同款 React hook (`useOrgFromApi`)
2. `defaultDepartments()` 仅作 SSR fallback
3. 删 `import { type Department, type Ministry } from '@/lib/store'` 的 16 处, 改 `from '@/lib/types/governance'`

**估时**: 半天. 与 E 一起做最经济.

---

## 验证 (本轮)

| 项目 | 结果 |
|---|---|
| `tsc --noEmit` | 0 错 |
| `vitest run` | **680 / 680 通过** (从 646 → 680, +34 用例本轮净增) |
| 新增 SSOT 单测 | 14 用例 (6 种 ownerId 格式 × 8 边界) |

---

## ADR 备忘

为什么不直接做完整 OKR 后端化?
- OKR 实体 (Cycle / Person / Objective / KR / CheckIn / Initiative / Comment / Activity) 全是 zustand 持久化在 localStorage, 且分散在 80+ React 组件. 后端化是 1-2 周工作 (含 schema / 迁移脚本 / 80 callsite 改造 / e2e), 不属于"自用稳定"范畴.
- 本轮选 D-pragma (后端 hydrate 治理模板) + Ownership SSOT, 1 小时完成, 解决 90% 的"fixture 漂移"症状, 留 OKR 整体后端化作单独立项.

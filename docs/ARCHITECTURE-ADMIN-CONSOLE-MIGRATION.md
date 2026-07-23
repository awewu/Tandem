# 统一管理中台迁移方案（Approach B：壳 + 微前端 + SSO）

> ⚠️ **部分作废（2026-06-29 更正）**：本文「统一视觉壳 / 共享 chrome / Multi-Zones 吞并各主站」与锁定铁律冲突
> （`platform-modules.json` + `RHAUTT-NEXUS-REARCH-BLUEPRINT.md`：中枢**不吞并**主站、**禁建跨站共享 UI**）。
> **保留**：SSO 走共享 **auth 非视觉骨架**。**废弃**：统一视觉壳吞并主站。
> 现行权威架构见 **`docs/RHAUTT-NEXUS-MANAGEMENT-HUB.md`**。

日期：2026-06-29 · 决策：保留各 app 独立部署，建统一中台壳 + 单点登录，模块作为入口。

## 0. 目标形态

按**受众**切分，而非按工具：

```
对外（匿名/客户，各自独立域名+独立部署，保持现状）
  ├─ public-portal        官网
  ├─ consumer-diagnosis   C端AI问诊
  └─ customer-portal      客户项目门户

对内（员工，单域名 admin.rhautt.com，单点登录 + RBAC 菜单）
  └─ admin-console（壳/shell）
       ├─ 顶部导航 + 角色化模块菜单（读 /auth/me 的 role+permissions）
       ├─ /crm /quote /bim /design /finance /analytics ...（各为独立 zone）
       └─ Next Multi-Zones rewrites 把各 zone 挂到同一域名
```

`dealer-workbench` 已是"单登录 + 多模块"的雏形，升格为壳的基座；`designer-workbench`/`business-console` 降为其中的角色视图/模块。

## 1. 为什么用 Next Multi-Zones（而非 Module Federation）
- Multi-Zones 是 Next 原生方案：每个 zone 拥有一个 `basePath`（如 `/bim`），独立开发/部署，壳用 `rewrites` 组合到同一域名。
- Module Federation 在 Next 16 App Router 下集成复杂、易踩运行时坑。
- 现状每个 app 已是独立 Next + 各自 `next.config` rewrites，天然适配 Multi-Zones，改动最小。

## 2. SSO 设计（关键）

现状：token 存 `localStorage`，`Authorization: Bearer` 手动带（`apps/dealer-workbench/src/lib/api.ts`）。localStorage **不跨 zone 共享**，且 XSS 可窃（见安全审计 ⚪）。

目标：登录后把 JWT 写入**父域 Cookie**（`Domain=.rhautt.com`），所有 zone 同域可读 → 天然 SSO。
- 生产：`Secure` + `SameSite=Lax`；**优先 httpOnly + 服务端代理注入**（zone 的 `/api` rewrite 经 BFF 把 cookie 转成上游 Bearer），彻底消除前端可读 token 的 XSS 面。
- 过渡期可用非 httpOnly cookie 让现有 `apiFetch` 直接读取，降低改造量；但须计划收敛到 httpOnly。
- 共享逻辑下沉到新包 `packages/auth`：`getToken()/clearSession()/useSession()/<RequireRole>`。

> 依赖前置：**必须先做安全审计 S1/H2** —— 统一到 NestJS 单一认证 + 全局 Guard + RBAC + 租户范围校验。否则 SSO 只是把分散的弱认证集中暴露。

## 3. 壳（admin-console）职责
- `/login`：唯一登录入口（其余 zone 无登录页，未登录→壳登录）。
- 顶部/侧边导航：从**模块注册表**渲染，按 `role/permissions` 过滤（RBAC 菜单）。
- Multi-Zones `rewrites`：`/bim/:path* → BIM zone`，`/crm/:path* → CRM zone` …
- 共享 chrome（导航、租户切换、用户菜单、主题用 `packages/tokens`/`visual-system`）。

## 4. 模块 zone 改造（每个内部 app）
- `next.config.js` 加 `basePath` + `assetPrefix`（如 `/bim`）。
- 删除各自登录页；改用 `packages/auth` 的 `useSession`，未登录跳壳 `/login?next=`。
- API 调用统一走 `packages/generated-client` + `packages/auth`（带 cookie/BFF）。

## 5. 分阶段实施（每步可独立验证）

| 阶段 | 内容 | 验证 |
|---|---|---|
| P0 前置 | 修认证 S1（NestJS 密钥兜底）+ H2（全局 Guard/RBAC/租户范围）；建 `packages/auth` | 单元 + 越权用例 |
| P1 壳 | 新建/升格 `admin-console`：登录 + RBAC 菜单 + 空 Multi-Zones 框架 | 登录→菜单按角色变化 |
| P2 接首个 zone | 把 `dealer-workbench` 的 BIM/CRM 以 `basePath` 挂入壳；打通 cookie SSO | 壳内免重登进入 BIM |
| P3 收编 | designer/business 模块并入；删重复登录 | 单登录覆盖全部内部模块 |
| P4 外部 | 官网/C端/客户门户保持独立，仅在导航互链 | 受众边界清晰 |

## 6. 取舍与风险
- **跨 zone 硬跳转**：zone 间为整页导航（非 SPA 软切换），首跳有加载；同 zone 内仍 SPA。
- **Dev 期 cookie 共享**：localhost 多端口不同源，cookie 跨端口不共享 → dev 用统一反代（壳 rewrites 代理各 zone 到一个端口）或路径前缀方案。
- **部署**：需一层网关/壳统一域名与路由；各 zone 仍可独立 CI/CD。
- **认证不先收敛则放大风险**（见 §2 依赖前置）。

## 7. 建议下一步
先做 **P0 前置**（认证收敛 + `packages/auth`）——它既是 SSO 的地基，又顺带消化安全审计的严重/高危项。之后再起壳。

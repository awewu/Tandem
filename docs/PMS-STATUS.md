# PMS 现状 (SSOT)

> **最后更新**: 2026-07-24  
> **本文件是 PMS 模块状态的唯一可信源 (Single Source of Truth)。**  
> 过时快照见 `docs/archive/` (勿作依据)。设计依据见 `docs/CRM-PM-DESIGN.md` / 审计见 `docs/CRM-PM-AUDIT-2026-07-23.md`。

---

## 1. 一句话状态

PMS (项目报备全生命周期) 已完成**功能骨架落地**: 28 张 typed 表 + 26 个 service + 24 个 API 路由 + 18 个 UI 页面, `tsc` 零错误, 173 个纯函数单测全绿, 已接入首页快速跳板与进程内每日扫描。**可进入内部试用**; 生产全量前仍有下列已知缺口。

---

## 2. 已落地 (实证)

| 层 | 内容 | 位置 |
|---|---|---|
| **数据层** | 28 张 typed 表 (pms_*) | `lib/infra/drizzle-schema.ts` · 迁移 `drizzle/migrations/pms-tables-only.sql` |
| **Service** | 26 个业务服务, 直连 drizzle typed 表 | `lib/pms/*-service.ts` |
| **API** | 24 个路由, 均 `boot()` + `requirePmsAuth` | `app/api/pms/*` |
| **UI** | 18 个页面, UI 宪章合规 (0 raw color) | `app/pms/*` |
| **鉴权隔离** | orgId 双层隔离 (一级/二级经销商), tenantId 过滤 | `lib/pms/pms-auth.ts` |
| **板块守卫 (审计 P0/F1)** | ✅ 已修: `channel` 板块, 外部仅 `dealer_*` 可进 | `lib/auth/module-scope.ts` (`CHANNEL_PREFIXES`) |
| **每日扫描** | 公海释放 + 资质/保修到期预警 + 告警 SLA 升级 | `lib/pms/cron-service.ts` `runPmsDailyScan` |
| **调度 (2026-07-24 修)** | 接入 `boot.ts` slow-scans (每日一次守卫); Vercel cron 为备份 | `lib/boot.ts` runSlowScans 末尾 · `vercel.json` |
| **入口** | 首页快速跳板卡片 "销售商机 PMS" | `lib/fixtures/seed.ts` |
| **测试** | 173 纯函数单测 (格式化/状态机/相似度/聚合) | `tests/unit/pms-*.test.ts` |

---

## 3. 已知缺口 (诚实登记)

### 3.1 二期真缺口 (代码已诚实标注, 依赖外部系统)

| # | 缺口 | 现状 | 依赖 | 位置 |
|---|---|---|---|---|
| G1 | 查重第 5 维 (产品重叠) | 五维只落地 4 维 (客户名/地址/电话/项目名, 合计 85% 权重) | ERP 产品 BOM 主数据 | `lib/pms/duplicate-check.ts` |
| G2 | 地址相似度 | 简化版字符串比对 | 地理编码服务 | `lib/pms/duplicate-check.ts` `addressSimilarity` |
| G3 | AI 报价推荐 | **纯 CRUD 存储, 无 AI 生成逻辑** — 仅存前端传入的 recommendations | 恒热算法 / LLM 报价链 | `lib/pms/quote-recommendation-service.ts` (头注已声明"预留接口") |
| G4 | 产品目录 / 客户体系 | import-driven, 当前空表, 无导入 UI/接口 | ERP 主数据导入通道 | `lib/pms/product-catalog-service.ts` |
| G5 | 对外中央 AI | 未开放 (审计 F4/RK3) | Skill Gateway data-scope 闸 (进化路线 V2-V3) | — |

### 3.2 工程债 (可自主消除, 未做)

| # | 债 | 说明 |
|---|---|---|
| D1 | **DB 集成测试 (关键路径已补)** | ✅ 2026-07-24: 新增 opt-in 真库集成测试 `tests/integration-db/pms.itest.ts` (7 用例, 覆盖商机 CRUD roundtrip / orgId 隔离 / 查重 duplicate+pass / 跟进副作用 / 公海释放+认领改归属 / cron 冒烟)。运行 `npm run test:pms-integration` (需真库, 唯一租户 `__pms_itest__` + 全清理, 不进默认套件/pre-commit)。⚠️ 仍未覆盖: 合同/交付/维保/返利等其余 service 的 DB 路径 (可仿此扩展)。 |
| D2 | **83 处 `any`** | service 层 `input: any` / `Promise<any>` 遍布 22 文件 (源于早期"绕过类型冲突"策略)。应逐步用 `lib/types/pms.ts` 类型收敛。 |
| D3 | **analytics 1 万行上限** | `ANALYTICS_ROW_CAP = 10000`, JS 层聚合未下推 SQL `group by`; 规模化会静默截断。 |
| D4 | **tenantId 隔离靠自觉** | 依赖各 service 手动传参过滤 (与全局 P4-1 一致, 未强制)。 |

---

## 4. 上线前建议顺序

1. ✅ ~~补关键路径 DB 集成测试 (D1)~~ — 核心 6 路径已覆盖; 剩余 service (合同/交付/维保/返利) 可仿 `pms.itest.ts` 扩展。
2. **[P1]** 移动端极简录入 (拍照/OCR/语音) — 审计 F11/RK9: 否则经销商敷衍录入 → 数据失真 → 空壳。
3. **[P2]** `any` 收敛 (D2) + analytics SQL 下推 (D3)。
4. **[二期]** G1-G4 待 ERP 对接; G5 待 Skill Gateway 就绪。

---

## 5. 验证命令

```powershell
npx tsc --noEmit                 # 零错误
npx vitest run tests/unit/pms-alert.test.ts tests/unit/pms-duplicate-check.test.ts   # 抽样绿
npm run lint:ui-charter          # 0 违规
npm run test:pms-integration     # opt-in 真库集成 (需 localhost:5432 在线)
```

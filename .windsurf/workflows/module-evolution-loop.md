---
description: 每个功能模块修订必经的四阶段体系化闭环（产品功能→用户验证→技术栈闭环→进化超越）
tags: [workflow, loop, module, review, governance]
---

# 模块进化闭环 (Module Evolution Loop)

## 适用范围
每个功能模块的**每一次**修订 / 迁移 / 扩张，都必须走完此四阶段闭环。禁止跳阶段。
一个模块可多轮循环：阶段 4 完成后可回到阶段 1 开启下一轮进化。

## 与既有体系的关系（防漂移铁律）
本工作流**只定义"评审闭环流程"，不重复定义任何架构事实**。各权威源不变：
- 方向 / 终态 → `PROJECT-CHARTER.md` + `governance/locked-goal.json` + `contracts/architecture/rhautt-nexus-target-architecture.json`
- 做什么（任务）→ 喂给 MASTER blueprint 的 W 波次
- 修什么（缺陷/负债）→ 登记到 MASTER-PROBLEM-LEDGER 的 P 项
- 前端切换 → 走 CONVERGENCE-LEDGER 四闸
- 质量门禁 → 复用 `.windsurf/workflows/dev-process.md` 的 L1–L4
- 学习沉淀 → 复用 `.windsurf/learning-evolution-system.md`

## 标准 Gem 评审席（阶段 1 与阶段 4 召集）
- **产品经理 Gem + 目标用户代表**（必到）
- 安全架构 Gem
- 身份与多租户 Gem
- SaaS 商业化 Gem
- 合规 Gem（等保 2.0 / PIPL）
- 数据架构 Gem
- 平台 / DevEx Gem
- HVAC 领域 Gem

---

## 阶段 1 · 产品功能（Product Function）
- **目的**：定义该模块的"完整功能集"，不是现有功能的罗列。
- **召集**：PM Gem + 目标用户。
- **入闸**：模块选定，且两侧现状勘察完成（NestJS / Express 逻辑落点 + 体量）。
- **动作**：PM Gem 给出完整功能集 → 对照现状标出缺口。
- **出闸**：功能规格草案 + 完整性缺口清单。

## 阶段 2 · 用户验证（User Validation）
- **目的**：目标用户验证需求真实性并排定优先级。
- **召集**：目标用户代表（按角色拆分）。
- **动作**：逐条验证；划分 MVP / P1 / P2 / 扩张。
- **出闸**：优先级 backlog + **MVP 划线（用户确认）**。

## 阶段 3 · 技术栈闭环（Tech Stack Closed-loop）
- **目的**：按锁定技术栈实现，形成 `契约 → 代码 → 测试 → 运行` 的完整闭环。
- **铁律**：**新逻辑只进 NestJS；Express 只减不增。**
- **闭环链**：OpenAPI 契约 → NestJS 模块 → PostgreSQL(RLS) 数据 → generated-client → app。
- **门禁**：dev-process L1–L4 + 契约覆盖 + RLS 证明 + acceptance gates 全绿。
- **出闸**：门禁全绿 + 对应 Express 切片**已删除**（收敛证据）。

## 阶段 4 · 进化超越（Evolution / Transcendence）
- **目的**：超越"功能对等"，定义世界级 / 竞争超越能力。
- **召集**：全 Gem 席。
- **动作**：扩张能力推演；搜索行业最佳实践（呼应 learning-evolution §4）。
- **出闸**：扩张路线图登记（P2/P3 能力清单）；回到阶段 1 或标记本轮完成。

---

## 每轮闭环产出登记（去向）
- 缺陷 / 负债 → `MASTER-PROBLEM-LEDGER`（P 项）
- 新功能任务 → blueprint W 波次
- 学习总结 → `.windsurf/lessons-learned/`

## 模块闭环状态跟踪表
| 模块 | 板块 | 当前阶段 | MVP 划线 | 备注 |
|---|---|---|---|---|
| auth / tenant | 底座 | 3·技术栈闭环 **闭合✅**（P0 MVP达成） | **P0**：真 OTP + token 带订阅声明 | 删3后门+移000000✅；JWT 带 modules✅；**真 OTP✅**(迁移019+OtpService+锁定+fail-closed)；6项测试✅ |
| entitlement | 底座 | 3·技术栈闭环 **闭合✅**（MVP达成） | **P0**：租户×模块订阅表 + Guard | 迁移018+实体+服务+Guard+控制器+全局接入✅；OpenAPI(4端点)+client✅；boot✅；9项契约测试✅ |
| 建站/标准治理 | 板块一 A | 2→3（阶段2已定） | **P0**：tokens+ui+lithnova试点+守卫 | **Astro 统一品牌站**（静态优先+React岛）；框架无关共享层。**品牌裁定✅**：Lithnova·瓦瑞节能为独立品牌（与恒热平级，与 rysnova 零交叉，双语锁定一致），骨架站保留，Track A 命名清理无需求 |
| product-catalog | 板块一 B | 3·技术栈闭环 **闭合✅** + **P1 深化✅**（后端） | **P0**：事实基座契约+L7(i18n+SEO/GEO) · **P1**：发布工作流+产品关系 | **P0**：迁移021 `product_content`+L7服务(locale回退/schema.org JSON-LD)+11端点入OpenAPI；**P1**：迁移022 发布工作流(状态机 draft→review→scheduled→published+`product_content_events`审计+定时发布门 publishedAt<=now)、迁移023 `product_relations`(配件/兼容/替代/交叉·向上/对比,FORCE RLS)+公开单品内联 related；**16端点全入 OpenAPI + client(124ops)**；契约测试**23/23**✅；typecheck0+3守卫绿+boot-smoke绿+16路由映射✅。裁定：模型A；brand-console录入UI + Rheem/Ruud完整目录 待网站代码后做 |
| growth（AI 增长） | 板块一 C | 2（阶段1→2 已粗盘） | P1（引擎已够，增量） | AI/GEO/口碑监测已建(1505行) |
| ingress / crm / diagnosis | 板块二 1 | 2 | **P0**：站点表单→线索→机会→签约+AI问诊 | 黄金路径入口 |
| quote | 板块二 1 | 2 | **P0**：报价（桥接93引擎） | callCalcEngine 已桥接 |
| design / delivery / lifecycle | 板块二 2 | 2 | **P0** design+delivery / P1 lifecycle | delivery 电签全链已厚(633行) |
| rysnova-bim | 板块二 3 | 2 | P1（已厚，增量） | 最全模块(529行) |
| 93 精算引擎 | 特殊 | 3·包化**已立边界✅** | **P0**：抽 `packages/engines` 供 NestJS 调用 | `@rhautt/engines` 收口点建立，quote 已接入(3引擎)；boot✅；后续引擎逐个迁入 |

---

**创建**: 2026-07-05 · **维护**: Cascade · **监督**: 用户（产品经理）

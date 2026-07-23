# 项目定期总结台账（滚动更新）

> 用途：定期归拢项目进展，防跑偏。每次总结追加一节，最新在前。
> 事实源优先级：`PROJECT-CHARTER.md` > `PRD-v2.md` > `platform-modules.json` > `CLAUDE.md` > 本文件。
> 本文件只做「快照 + 指针」，不新立口径；如与宪章冲突，以宪章为准。

---

## 2026-07-05 总结

### 一、立项与定位（已锁定，不可动摇）

- **软件平台名**：Rhautt Nexus / 瑞合数智枢纽 —— 瑞合瑞德暖通科技集团营销体系软件平台。
- **软件厂商**：Rysnova / 瑞诺瓦（独立中立行业软件商）；Rhautt Comfort 为旗舰客户 #1，交付实例白标 + `Powered by Rysnova`。
- **产品组织**：两大板块 + 一个底座
  - 板块一：Rhautt 旗下品牌运营（集团官网 rhautt.com + Rheem/Ruud/Everhot/Lithnova 品牌站 + DAM）。
  - 板块二：瑞诺瓦 / Rysnova 经销商赋能三件套（AI 问诊 → 舒适家居 CRM → 技术支持 BIM），对外中立第三方形态（阳谋式渠道转化）。
  - 底座：Rhautt Nexus 控制平面（多租户 / auth / 品牌注册 / 共享底座 / 总部分析 / 资料中心 / 增长中枢 Nexus Growth）。
- **业务闭环判据**：`lead → 问诊 → 设计 → 系统包 → 报价 → 合同 → 施工 → 验收 → 生命周期 IoT 交接`（IoT 仅 lifecycle_handoff_only）。
- **权限域**：6 域制（D0 平台 / D1 品牌 / D2 产品 / D3 用户体验 / D4 客户赋能 / D5 增长）+ DB 层 RLS。

### 二、技术栈（终态已锁定 2026-06-07）

- **终态**：NestJS + Fastify（`services/api/`，DDD 模块化单体）+ PostgreSQL/TypeORM（RLS 多租户）+ MongoDB（文档库）+ Redis + Outbox 事件。
- **迁移期兼容主干**：Express（`server-production.js`）+ MongoDB，按域 `auth → tenant → crm → quote` 绞杀者式下线。
- **前端**：Next.js 多 app monorepo（`apps/*`）+ React 18 + TS + Tailwind；BIM 走 ThatOpen 开源底座，不自研 3D 内核。
- **工程纪律**：50+ CI guard（`guard:all` / harness 系列 / `test:production-readiness`）；新业务逻辑只准写 `services/api/src/modules/`。

### 三、当前状态与近期完成（截至 2026-07-05）

- 整体状态：`locked-active-not-production-complete`（定位已锁、活跃开发、尚不可上线）。
- 近期里程碑（git 记录核实）：
  - 06-29~30：nexus-console 真实 Next.js 控制平面 + httpOnly JWT 会话流；DB 层 RLS（migration 004/005/007）；安全审计修复 S1/S2/H2（JWT fail-fast、去除硬编码 fallback、tenant-scope 校验）。
  - 06-29：Everhot 品牌站大规模建设（产品对比/选型向导/经销商定位/搜索，对标 Rheem 官网深度）；calc-engine 无依赖 ASHRAE 兜底 + 测试。
  - 07-01~03：D5 增长中枢立项落位（growth-hub）；D4 四 app token 对齐 canonical Rheem VI；公开面 rate-limit；大命名收敛 lithnova/ruinuowa/renova → rysnova / rysnova-bim；双实现收敛台账。
  - 07-05：Rysnova BIM 护城河蓝图定稿——尖刀 = **AI 生成 × 合规**（calc-gate 国标硬闸 + verified 计算书），对标并超越筑星云/优筑家；新增 `services/ai-design-engine` 规划 + W-BIM-AI 波次。

### 四、关键差距（勿忘）

1. **Flow 1 未闭环**（P1）：C 端问诊匿名留资打在带鉴权的 `/crm/leads` 会 403，应改走 `POST /api/v2/ingress/lead`；diagnosis/quote 端点口径漂移待归位 NestJS。
2. **双主干并存**（P2）：legacy `server/modules/*`(57) vs NestJS(22)，auth M1 契约冻结尚未完成。
3. **可观测性缺失**（P4）：OTel、SLO burn 告警、目标规模压测（500+ 经销商并发）未完成。
4. **BIM 4 个并行表面**待按 07-05 蓝图收敛；calc-gate 仍是软闸未接通硬闸。
5. 工作区有大量未提交改动（apps/* UI 层 + business-console 删除），需尽快成批提交防漂移。

### 五、发展方向（执行顺序，来自 EXECUTION-ROADMAP-2026-07）

P3 文档口径 → P1 Flow1 闭环 → P2 auth M1–M2（契约+影子）→ P4 OTel/SLO → P2 auth 切流下线 → P5 增长中枢 G0/G1 → tenant/crm/quote 依次迁移 + 压测收尾；BIM 线并行走 W-BIM-1 合规门禁 → W-BIM-AI。

### 六、防跑偏红线（每次总结复核）

- [ ] 没有新增对外板块 / 品牌口径漂移（两板块一底座不变）。
- [ ] 没有往 `server/modules/` 加新业务逻辑。
- [ ] 没有自研 3D 渲染 / CFD / IoT 控制平台。
- [ ] 板块二对外保持中立第三方形态，不冠集团/设备品牌。
- [ ] 第三方产品只进 BOM/报价，不污染精算可信链。

---

## 总结模板（复制使用）

```
## YYYY-MM-DD 总结
### 一、立项与定位（有无变化，正常应为"无"）
### 二、技术栈（有无决策变更）
### 三、当前状态与近期完成
### 四、关键差距
### 五、发展方向（下一步执行顺序）
### 六、防跑偏红线复核（勾选）
```

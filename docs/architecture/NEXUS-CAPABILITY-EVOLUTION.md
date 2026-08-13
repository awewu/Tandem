# Nexus 能力进化图 (Capability Evolution)

> 目的：把平台从"AI 辅助的仪表盘"进化成"受治理的自主增长系统"。
> 原则：**锚在代码里已存在的进化接缝**上,不空想；由北极星(GEO→高意向线索)驱动优先级。
> 关联：`docs/NEXUS-MARKETING-PLATFORM-BASELINE.md`(基线) · `NEXUS-PLATFORM-HARDENING-ROADMAP.md`(工程硬化)。

## 已存在的进化种子(代码实证)
| 种子 | 位置 | 状态 |
|---|---|---|
| AgenticGEO 自进化 | `growth.service.ts::computeStrategyWeights` → `geo-strategies.ts::selectStrategies({weightOverrides})` | 机制在,**缺 lift 数据 → 权重为空** |
| 受治理动作引擎 | `geoActionRegistry` + `invokeGeoAction`(green 自动 / yellow 需核准,人与 AI 同一入口 + 审计 + RLS) | 已建,动作目录待扩 |
| AI 网关 | `ai-gateway.service.ts` / `runHermesCenterAiProbe`(带 blocked→503 降级) | 已接 Hermes 中心 AI,待多模型路由 |
| 多触点归因读模型 | `metrics` 模块(linear/position/time-decay) | 已建,未回流到预算决策 |

## 阶 0 · 现状(骨架)
GEO 探测 · 内容生成(带策略) · 闭环实验(lift) · 多触点归因 · 受治理动作 · 策略库 + 自进化接口。

## 阶 1 · 激活闭环(近期 · 数据驱动)——【杠杆点】
1. **跑量闭环实验喂数据** → `computeStrategyWeights` 学到真实权重 → 策略库按 brand/问题类型自动重加权(内容越生成越聪明)。**一切自进化都卡在这一步先有数据。**
2. **归因→决策回路**:归因数据回流 `gtmplan`(MROI)/`activation` → 自动建议预算/渠道再分配。
3. **AI provider 成熟**:多模型路由(探测已列 12 引擎)+ 按 token 成本/ROI 选模型(成本已落账)。
- 验收:策略权重非空且随 lift 变化;归因驱动至少一条预算建议;AI 网关支持 ≥2 provider。

## 阶 2 · 度量→处方→自主(扩 green 区 · 信任驱动)
4. **处方引擎**:现有"优化建议(P0/P1)"升级为可一键执行动作(接 `geoActionRegistry`)。
5. **扩自动区**:低风险动作 yellow→green;yellow 加 24h 否决窗 + SLA(charter red/yellow/green 语义)。
6. **多步 Agent 剧本**:探测→缺口→生成→审核→发布→复测 串成一条**受治理自主 playbook**(现为零散单动作)。
- 验收:≥1 条端到端 playbook 在治理闸下自动跑通,人只处理例外与核准。

## 阶 3 · 自进化平台(跃迁)
7. **跨租户基准智能**:匿名聚合"哪些策略全网 win"反哺自进化(破单租户数据不足)。
8. **预测式 GTM**:从"发现已有缺口"→预测哪些品类/问题将升温,提前生成内容占位。
9. **GTM Autopilot**:北极星驱动的自主增长循环——系统自己找缺口/造内容/跑实验/验 lift/留有效策略,人管治理闸与例外。

## 进化主轴
**AI 辅助仪表盘 → 受治理的自主增长系统**:自进化(阶1数据)→ 处方/自动执行(阶2信任)→ 自主 playbook + 预测 + 跨网学习(阶3)。
**唯一硬前置**:先跑通闭环实验积累 lift 数据(阶1.1),否则自进化恒为空转。

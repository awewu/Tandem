# Part② · 承接总线：多品牌统一收口 + 单一 outbox + 订阅扇出

> 状态：待评审（设计阶段，不含实现代码）· 2026-06-30
> 上游：MASTER §1.4 承接总线 · 三约束 · 决议（单一 outbox 已拍板）
> 互补：`RHAUTT-NEXUS-LEAD-HANDOFF-DESIGN.md`（交接层裁决/派单/归属）——**本文不重复交接层内部裁决，只定义其"上游汇入"与"事件解耦"机制**。
> 解决：多品牌入口 + 问诊 + 联名子模板 → **如何统一收口、单一事件、订阅扇出、配置化扩展**。

---

## 1. 定位（与交接层的分工）
```
[多品牌入口]            [承接总线 = 本文]                      [订阅者扇出]
everhot/rheem/ruud ─┐   ① 统一收口 /api/v2/intake/leads        ┌─▶ 派单引擎(交接层 §3) ─▶ CRM 归属
问诊留资 ───────────┼─▶ ② 同意闸+归一化 ─▶ ③ 写 intake pool ─┼─▶ 问诊会话承接(A/B 判定)
联名子模板 ─────────┘      + 发 **单一 outbox: lead.captured** └─▶ 经营分析 / 通知
新增入口 = 配置(注册 brand+source)，不改后端                    各订阅者独立、幂等消费
```
- **承接总线**管"汇入 + 解耦事件"；**交接层**是总线的**头号消费者**（消费 `lead.captured` → 撞单裁决 → 派单 → 归属）。
- 二者解耦：总线只保证"采集+落池+发事件"，下游怎么消费互不阻塞。

## 2. 多品牌统一收口（单口 + brand 字段）
- 所有品牌站、问诊、联名子模板 → **同一公开端点** `POST /api/v2/intake/leads`（沿用 handoff §5.1）。
- 区分靠 **`brand` + `source`** 字段，不靠多端点。
- **新增入口 = 注册配置**（见 §5 入口注册表），**不改后端代码**——落地"多品牌汇入"与"配置优先"。

## 3. 单一 outbox 事件契约
**事件：`lead.captured`（唯一线索汇入事件）**
```json
{
  "eventId": "uuid",            // 事件唯一 ID（消费者幂等键）
  "type": "lead.captured",
  "occurredAt": "ISO8601",
  "tenantHint": null,            // 收口时尚未归属，派单后才定 tenant/dealer
  "brand": "everhot",
  "source": "website-form | diagnosis | warranty | fission | co-brand:<key>",
  "leadId": "intake-pool-id",    // 未归属池记录 ID
  "consentId": "pipl-consent-id",// 同意记录（无则拒收）
  "phoneHash": "…",              // 撞单裁决用，不含明文
  "payloadRef": "obj-store-key", // 归一化后的脱敏负载引用
  "dedupKey": "brand+phoneHash+window"  // 幂等去重键
}
```
**落表（已拍板 2026-06-30）**：统一写入**单一 `outbox_events` 表**（`mdm_outbox_events` 已并入，P2 决议）；`event_source` 区分 mdm/业务来源，`lead.captured` 即一条 `event_source='intake'` 记录。

**可靠性约定**
- **事务性 outbox**：写 intake pool 与写 `outbox_events` 同一 DB 事务，避免丢事件。
- **投递语义**：at-least-once；**消费者必须按 `eventId` 幂等**。
- **去重**：`dedupKey` 防同一线索重复涌入（如用户连点提交）。
- **重放/审计**：outbox 表保留，可重放；失败进 DLQ + 告警。

## 4. 订阅扇出（消费者）
| 订阅者 | 职责 | 幂等键 |
|---|---|---|
| **派单引擎**（交接层） | 撞单裁决 → geo+品类+负载派单 → 系统态写 CRM 归属 | eventId |
| **问诊会话承接** | A/B 判定：已归属问诊挂回 owner；匿名问诊作新 lead | eventId |
| **经营分析** | 汇入漏斗/来源转化（脱敏） | eventId |
| **通知** | 经销商接单提醒 | eventId |
- 消费者**互相独立**：某消费者失败不阻塞其他；各自重试。
- 严守边界：分析只拿脱敏聚合（§1.6 阳谋）；明文经营数据归属后才进 RLS 域。

## 5. 配置化入口注册表（新增入口=配置）
`intake_source_registry`：
| 列 | 用途 |
|---|---|
| brand / source | 入口标识 |
| field_mapping(jsonb) | 来源字段 → 归一化 lead 契约映射 |
| consent_template | 该入口 PIPL 同意模板 |
| default_routing | 默认派单策略（地域/品类/指定 dealer） |
| co_brand_key(可空) | 联名子模板标识 → 触发能力开关 |
| enabled | 开关 |
- 加新品牌站/新问诊变体/新联名页 = **insert 一行配置**，总线自动收口，无需改代码。

## 6. 三约束落地
- **多品牌汇入**：单口 + 单事件 + brand 字段 ✓。
- **瑞诺瓦独立上线**：无品牌站时总线可空跑（CRM 手工建档仍走归属）；品牌站是可选上游 ✓。
- **联名子模板=功能开关**：`source=co-brand:<key>` → `co_brand_key` → 查能力开关表决定启用哪些件套/功能 ✓。

## 7. 决议与待拍板
1. **outbox 技术选型 = Postgres 事务性 outbox 表 + 轮询投递**（已拍板 2026-06-30）：与现栈一致、轻量、事务保证；先不引 MQ，规模到瓶颈再演进。
2. **DLQ/重试策略**（待拍板）：最大重试次数、退避、告警通道。
3. **dedup 窗口**：`dedupKey` 时间窗（如同手机 24h 内视同一 lead）取值。
4. **分析订阅脱敏度**：经营分析消费者可见字段白名单。

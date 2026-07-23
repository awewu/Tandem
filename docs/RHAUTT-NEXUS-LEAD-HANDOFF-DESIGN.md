# Rhautt Nexus · ToC→ToB 线索交接层设计

> 状态：待评审（设计阶段，不含实现代码）· 2026-06-29
> 事实源对齐：`platform-modules.json` · `PRD-v2.md` §4.7/§4.8 · `docs/RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md` · `services/api/src/modules/crm/crm.service.ts` · `server/core/ChannelManagementEngine.js`
> 范围：补齐集团主闭环 `lead → ①问诊 → ③设计/BIM → ②报价 → 合同 → 施工 → 验收 → IoT` 在 **模式切换处（ToC→ToB）** 的唯一缺失桥。

---

## 1. 问题陈述（为什么单列交接层）

集团主闭环不是单一模式，而是一条 **ToC→ToB 交接链**：前两跳（获客/问诊）是 ToC，从「设计/报价」起全部转入 ToB。当前代码在这个切换处断裂：

- **ToB 侧已有但够不着**：`crm.service.createLead()` 要求 `JwtPayload` + `user.dealerId/storeId/ownerUserId`，并经 `withRlsTransaction` 落到该 dealer/store 作用域（`crm.service.ts`）。**它是经营者态接口，匿名 C 端站点无法调用**。
- **ToC 侧产生数据但无去处**：`apps/everhot-cn` 表单经 `forms.js` 仅 `saveLocal()` + `TODO fetch('/api/v2/leads')`；问诊（`apps/consumer-diagnosis`）留资后无派单。
- **派单不存在**：`ChannelManagementEngine` 有层级/KPI/健康度/`registerDealer`，但**无 geo+品类+负载的路由函数**。
- **撞单仅租户内**：`createLead` 去重是 `tenantId + phoneHash`，**跨 dealer 撞单（PRD §4.8）无处判定**——因为撞单必须在归属发生**之前**、在跨租户的未归属池里裁决。
- **状态模型从 `lead-created` 起步**（已带 tenant/dealer/store），即默认 lead 已在 ToB 作用域；**交接层正是 `lead-created` 之前缺的一段**。

**结论**：需要一个独立的「线索交接层」，作为 ToC→ToB 的**唯一入口与裁决点**，承接「采集 → 同意 → 撞单裁决 → 派单 → 归属落 CRM」。

---

## 2. 模式边界（交接层两侧的硬规则）

| | ToC 侧（交接层之前） | ToB 侧（交接层之后） |
|---|---|---|
| 身份 | 匿名 / 仅手机号 | JWT + dealer/store 作用域 |
| 隔离 | **PIPL 同意 + 脱敏**（M14，P0 发布闸） | **多租户 RLS**（不破 §4.2 隔离） |
| 数据落点 | **未归属池**（平台 intake 命名空间） | dealer/store 作用域内的 `customer/opportunity` |
| 谁能读 | 仅平台派单器（系统态，脱敏审计） | 归属后的 dealer/store/owner |

交接层是这两套隔离体系之间**唯一合法的搬运工**：进来时按 PIPL 同意收口，出去时按 RLS 落租户。

---

## 3. 交接层架构

```
[ToC 入口]                         [交接层 /api/v2/intake]                         [ToB 域]
品牌站表单(everhot) ─┐
问诊留资(diagnosis) ─┼─▶ ①同意闸 ─▶ ②归一化Lead ─▶ ③跨域撞单裁决 ─▶ ④派单引擎 ─▶ ⑤归属落库 ─▶ crm.createLead(系统态)
查找经销商/保修   ─┘     (PIPL)    (intake pool)    (跨dealer)      (geo+品类+负载)   (写dealer/store)      │
                                                                          │                              ▼
                                                                   ⑥派单决策(routing_decision)        opportunity:lead-created
                                                                   ⑦经销商接单/超时改派                 (状态模型起点)
```

- **①同意闸**：采集个人信息前必须有 PIPL 同意记录（接 `compliance` 模块 `consent.entity`），无同意不入库。
- **②归一化 Lead**：把多来源（官网/问诊/保修/裂变）字段映射成统一 intake lead 契约。
- **③跨域撞单裁决**：在**未归属池**内按 `phoneHash` 跨 dealer 检测，依 §4.8 规则 + 时间戳判定，留审计。补足现有「仅租户内去重」的盲区。
- **④派单引擎**：新建。按 地域 + 品类 + 经销商负载/健康度 选目标 dealer/store（复用 `ChannelManagementEngine` 的 `calculateHealthScore`/负载数据）。
- **⑤归属落库**：以**系统态**调用 CRM 写入，注入选定的 `tenantId/dealerId/storeId`（不是用某个登录用户的 JWT 作用域）。
- **⑥派单决策留痕**：每次派单写 `routing_decision`（来源、候选、命中规则、得分），供申诉/复盘。
- **⑦接单/改派**：经销商接单确认；超时未接触发自动改派（接 `workflow`/SLA）。

### 3.1 问诊 A/B 双入口判定（关键分流）

瑞诺瓦 AI 问诊横跨交接层两侧，**进入交接层时必须先判定会话归属态**，否则会把「已归属客户的问诊」误当新 lead 重新派单：

| | **A · 匿名自助问诊** | **B · 经销商引导问诊** |
|---|---|---|
| 触发 | 业主在品牌站/问诊端自助完成 | 已归属客户，销售在工作台引导 |
| 进入交接层时 | 无 `dealerId`（未归属） | 已携 `dealerId/storeId`（JWT 态） |
| 处理路径 | 全流程：①同意→③撞单→④派单→⑤归属 | **跳过 ③④⑤**，直接落已归属客户 |
| 状态衔接 | `captured→…→assigned`→`lead-created` | 直接 `diagnosis-in-progress` |

判定规则：intake 收到 `source=diagnosis` 时，按是否带有效 ToB 鉴权/`dealerId` 分流——**有则 B（不派单）、无则 A（走全流程）**。问诊画像作为 `payload` 在两种路径中都随会话携带，A 路径归属后落 `customer.profile`，方案快照不重做。

---

## 4. 未归属池（关键设计取舍）

派单**之前** lead 没有 dealer/tenant，但 RLS 要求每行有 `tenant_id`。方案：

- 设立**平台 intake 租户**（`tenant_type='hq'` 或专用 `platform-intake` 命名空间），所有未归属 lead 落此池，RLS 仅允许「平台派单器系统角色」读写。
- 派单成功后，**迁移/复制**为目标 dealer/store 作用域内的 `customer + opportunity(stage='lead')`，intake 记录转 `routed` 并保留溯源链（`intake_lead_id` ↔ `customer_id`）。
- intake 池数据保留策略接 `compliance` 的 `dataRetention`（如 N 天未派单/未同意自动清）。

> 待拍板：未归属池是「独立 intake 租户」还是「foundation 行(tenant_id NULL)」。推荐独立 intake 租户，隔离更干净、便于审计与拆库。

---

## 5. 数据契约（设计建议）

### 5.1 公开 intake 入口（无鉴权、写入态、强同意）
```
POST /api/v2/intake/leads
{
  "source": "everhot-web | diagnosis | warranty | find-a-pro | fission",
  "brand": "everhot",
  "name": "...", "phone": "...",
  "city": "...", "district": "...", "geo": {"lat":..,"lng":..} | null,
  "category": "water-heating | heating-cooling | ...",
  "intent": "consult | quote | dealer-apply | warranty",
  "payload": { /* 来源特有：问诊画像 / 保修序列号 / 加盟资质 */ },
  "consent": { "agreed": true, "policyVersion": "...", "ts": "...", "scope": ["contact","routing"] }
}
→ 201 { "intakeLeadId": "...", "status": "captured", "routing": "pending" }
```
- 必须脱敏返回（不回任何经销商明文经营数据）。
- `consent.agreed=false` → 拒绝入库（PIPL 闸）。

### 5.2 派单决策（内部）
```
routing_decision {
  intakeLeadId, rule("first-touch|region|assign"),
  candidates: [{dealerId, storeId, score, loadFactor, healthScore}],
  chosen: {dealerId, storeId}, reason, decidedAt, decidedBy:"system"
}
```

### 5.3 归属落库（系统态调用 CRM）
- 不复用用户 JWT；用**派单器服务身份**注入 `tenantId/dealerId/storeId` 后写 `customer/opportunity`。
- 写入即 `opportunity.stage='lead'` → 对齐状态模型 `lead-created` 起点。

---

## 6. 派单规则（§4.8 + ChannelManagementEngine）

- **归属规则可配置**：首触优先 / 区域优先 / 分配优先（HQ 可按品牌/区域设默认）。
- **派单打分**：`地域匹配 × 品类授权 × 经销商健康度/负载`；健康度复用 `ChannelManagementEngine.calculateHealthScore`，负载用进行中商机数/响应时长。
- **跨门店撞单**：未归属池内同 `phoneHash` 命中 → 依规则 + 时间戳裁决，**只产生一个归属**，其余记撞单审计。
- **联合身份（§4.7）**：派单结果对客呈现「经销商联合主体 + 中立工具」，不抢经销商对客主体位；交接层只决定归属，不改展示层隔离。

---

## 7. ToC 状态前段（补全状态模型缺口）

在现有 `lead-created` 之前补 4 个交接态：

| State | 客户可见 | 内部动作 | 下一状态 |
|---|---|---|---|
| `captured` | 已收到您的信息 | intake 落未归属池 | `consented` / 拒绝 |
| `consented` | — | PIPL 同意已记录 | `routing` |
| `routing` | 正在为您匹配就近服务商 | 撞单裁决 + 派单打分 | `assigned` |
| `assigned` | 已由 XX（经销商联合主体）为您服务 | 系统态写入 CRM | →（接入）`lead-created` |

`assigned` 与状态模型 `lead-created` 对接，ToC 段闭合进 ToB 经营闭环。

---

## 8. 各来源接入点（恒热为例）

| 来源 | 现状 | 接入动作 |
|---|---|---|
| 咨询/选型表单 | `forms.js` saveLocal + TODO | 改 `POST /api/v2/intake/leads`（含同意勾选） |
| 查找经销商 | `dealers.js` 硬编码 16 条 | 列表改读公开只读经销商端点；"我要预约"→ intake |
| 保修注册 | `warranty.js` TODO | intake(`intent=warranty`) → 派单 + 回流 lifecycle |
| 加盟申请 | `partner-programs` saveLocal | **ToB 招商**：走独立 `intake(intent=dealer-apply)` → 渠道招商工作流（**不进 CRM 客户池**） |
| 问诊留资 | `consumer-diagnosis`（现仅 `complete`/`reports`/`share-view`，**零调用 CRM/派单**） | 按 §3.1 分流：**A 匿名**→intake(`source=diagnosis` + 画像 payload)→派单；**B 已归属**→直接落客户，不派单 |

> 注意：加盟申请是 **ToB 招商线**，终点是 `ChannelManagementEngine.registerDealer` 审核流，**与 ToC 客户 lead 共用 intake 通道但分流不同处理器**，绝不混入经销商 CRM 客户池。

---

## 9. 安全与合规边界

- **PIPL（P0 发布闸）**：所有 ToC 采集前置同意，记录 `policyVersion + ts + scope`，接 `compliance`。
- **公开端点**：仅 `POST intake/leads`（写）与脱敏只读经销商列表；**绝不暴露** `crm`/`product-catalog/devices`（含成本价、含 AuthGuard）。
- **PII**：手机号入库即 `phoneHash`（HMAC）+ 真加密存储（补现状 `phoneEncrypted` 明文 TODO）。
- **RLS**：归属落库经 `current_tenant_id()` 注入目标租户；未归属池仅系统角色可读。
- **审计**：intake、撞单裁决、派单决策、改派全程留痕。

---

## 10. 分阶段落地（可独立验证）

| 阶段 | 内容 | 验证 |
|---|---|---|
| P0 | 公开 `POST /api/v2/intake/leads` + PIPL 同意闸 + 未归属池 | 匿名可提交；无同意被拒；数据落 intake 池且 RLS 隔离 |
| P1 | 派单引擎（geo+品类+负载）+ 系统态写 CRM + 状态前段 | lead 自动归属到正确 dealer/store，状态接 `lead-created` |
| P1 | 跨域撞单裁决（未归属池内 phoneHash） | 同客户多来源只产生一个归属，余记审计 |
| P2 | 恒热各来源表单改接 intake（咨询/查找经销商/保修） | 端到端：站点提交→派单→经销商工作台可见 |
| P2 | 加盟招商分流 → `registerDealer` 审核流 | 加盟不进客户池，进渠道招商流 |
| P2 | 超时未接自动改派（接 workflow/SLA） | 模拟超时触发改派并留痕 |
| P3 | 保修回流 lifecycle 资产档案 | 注册序列号→生成 installed asset |

---

## 11. 待拍板开口项

1. **未归属池归属**：独立 intake 租户（推荐）vs foundation 行(tenant_id NULL)。
2. **派单器身份**：服务账号 system-role vs HQ 运营代操作；二者审计语义不同。
3. **intake 通道是否统一**：ToC 客户 lead 与 ToB 加盟申请共用 `POST intake/leads` 分流（推荐，单一获客口）vs 完全独立两端点。
4. **撞单裁决时机**：实时同步裁决 vs 入池后异步裁决（影响经销商接单时效）。
5. **派单引擎落点**：包进 `crm` 模块 vs 新建 `intake`/`channel` 领域模块（建议新建，避免 crm 既管 ToB 又管 ToC 入口）。

---

## 12. 不做什么（防越界）

- 不让公开 intake 端点触达任何 ToB 受保护数据或成本价。
- 不在未派单前把 lead 落进某个经销商租户（破隔离）。
- 不把加盟招商（ToB）混进客户 CRM 池。
- 不在交接层改动展示层隔离或联合身份规则（§4.7 归展示层）。

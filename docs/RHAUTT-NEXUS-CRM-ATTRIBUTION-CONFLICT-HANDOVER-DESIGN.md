# CRM §4.8 · 线索归属 / 撞单裁决 / 离职交接 设计

> 状态：待评审（设计阶段，不含实现代码）· 2026-06-29
> 上游：MASTER 蓝图 §1.6（软引用+RLS+outbox）· 数据口蓝图 · PRD §4.8「经销商最痛的经营纠纷」
> 事实源：实读 `services/api/src/modules/crm/{crm.entity,crm.service}.ts`
> 归属波次：W2 经营脊柱（MASTER Part 4）

---

## 1. 现状与缺口（实读）
- `customers` 唯一索引 `(tenantId, phoneHash)` ⇒ **撞单仅"同租户同手机=同客户"的去重**，无裁决。
- `createLead`：哈希手机 → 查 `(tenantId, phoneHash)` → 命中即复用、否则建档，**归属 = 创建者**（`ownerUserId=user.userId`）。
- **缺**：① 归属规则引擎（首触/区域/分配）；② 撞单冲突识别与裁决；③ 离职交接；④ 全程审计。

## 2. 三个问题的边界（先分清）
| 概念 | 定义 | 作用域 |
|---|---|---|
| **归属** | 新线索**首次**判定归谁 | 进入瞬间 |
| **撞单** | 线索/客户**已存在**，又被他人触达/录入 | 冲突时 |
| **交接** | 已归属客户**换主**（离职/调岗/规则） | 存量调整 |

隔离前提：RLS 租户树（tenant→dealer→store）。撞单/交接发生在**同租户内 store/sales 之间**；跨 dealer 视 dealer 是否同租户而定（§6 待拍板）。

---

## 3. 线索归属判定（Attribution）

### 3.1 归属规则（可配置，PRD「首触优先/区域优先/分配优先」）
| 规则 | 逻辑 | 适用 |
|---|---|---|
| **首触优先** firstTouch | 谁先触达（首个 interaction/lead 来源）归谁 | 默认 |
| **区域优先** territory | 按客户 city/地址匹配区域→对应 store/sales | 区域制经销商 |
| **分配优先** assignment | 进公海池→管理者/轮询分配 | 集中分配制 |

- 规则**租户级可配置**（落 `crm_attribution_config` 表，按 dealer 可覆盖）。
- 来源维度（`customer.source`）：问诊/官网/门店/裂变渠道 → 参与规则输入。

### 3.2 归属流程
```
新线索(intake/lead) → 算 phoneHash → 查同租户是否已存在客户
  ├─ 不存在 → 按归属规则定 owner/store → 建档 → 事件 customer.assigned
  └─ 已存在 → 进入【撞单裁决】(§4)
```

---

## 4. 撞单检测与裁决（Conflict & Arbitration）

### 4.1 检测
- 触发：建线索/录客户时 `(tenantId, phoneHash)` 命中既有客户，且**既有 owner ≠ 当前操作人/store**。
- 产出**撞单工单** `crm_lead_conflict`（claimant、incumbent、customerId、来源、证据）。

### 4.2 裁决策略（可配置）
| 策略 | 逻辑 |
|---|---|
| **保护期** protection | incumbent 在保护期(如90天)且有有效跟进 → 维持 incumbent |
| **首触优先** | 维持最早归属 |
| **活跃优先** | 近 N 天有有效 interaction 者优先 |
| **人工裁决** manual | 升级 store/dealer 管理者决裁 |

- 默认：保护期 + 活跃度，不决则升人工。
- 裁决结果写审计 + 事件 `lead.conflict.resolved`；**不静默覆盖归属**。

### 4.3 隐私边界
- 撞单识别用 `phoneHash`（不解密），claimant **不可见** incumbent 的客户明文（RLS）；只见"该线索已被占用 + 可申诉"。

---

## 5. 离职交接（Handover）
- **触发**：员工离职/调岗/停用。
- **批量改主**：该 owner 名下 customer/opportunity/interaction 的 `ownerUserId` → 新 owner（或回公海池待分配）。
- **事务**：单事务批量 + 审计（移交人/接收人/范围/时间/操作者）；事件 `customer.reassigned`。
- **在途保护**：未结 opportunity 随客户一起移交，保留历史 owner 痕迹（审计可溯）。
- **权限**：仅 dealer/store 管理者可执行。

---

## 6. 数据模型增量（软引用 + RLS，遵 §1.6）
| 表 | 用途 | 关键列 |
|---|---|---|
| `crm_attribution_config` | 归属/裁决规则（租户级，dealer 可覆盖） | tenantId, dealerId?, rule, params(jsonb) |
| `crm_lead_conflict` | 撞单工单 | tenantId, customerId, claimantUserId, incumbentUserId, status, evidence(jsonb) |
| `crm_ownership_audit` | 归属/裁决/交接审计 | tenantId, customerId, fromOwner, toOwner, reason, actor, at |
| `customers`（增列） | 归属溯源 | `first_touch_at`, `first_touch_source`, `protection_until` |

- 全部带 `tenant_id` + RLS；无硬外键，软引用 `customerId`。
- 事件统一走**单一 outbox**：`customer.assigned`/`lead.conflict.detected`/`lead.conflict.resolved`/`customer.reassigned`。

---

## 7. 与三件套协同
- **问诊→CRM**：问诊 outbox `diagnosis.report.created` → CRM 走 §3 归属（含撞单检测）→ 回填 `diagnosis_report.opportunity_id`。
- **独立态**：CRM 单用仍可手工建档走归属规则，不依赖问诊。
- **opportunity 脊柱**：归属判定即建/挂 opportunity（决议#3 协同态强制）。

---

## 8. 决议与待拍板
1. **dealer 租户边界 = 租户内 dealer_id 子作用域**（已拍板 2026-06-30）：依实体模型 `tenantId + dealerId/storeId`，**dealer 非独立租户**，而是租户树下的子作用域。
   - ⇒ 跨 dealer 撞单 = **同租户内跨 dealer**，在 intake **未归属池**以**平台系统态**裁决（归属发生前），不破 RLS（裁决用 `phoneHash`，不暴露各 dealer 客户明文）。
   - 离职交接 = 同 dealer/store 内改主；跨 dealer 转移需 dealer 管理者 + 审计。
2. **保护期参数**：默认天数与"有效跟进"判据（几天内几次 interaction）。
3. **公海池**：是否引入公海池（未归属/超期回收）作为归属与交接的缓冲。
4. **裁决默认**：自动（保护期+活跃）优先，还是一律人工裁决。

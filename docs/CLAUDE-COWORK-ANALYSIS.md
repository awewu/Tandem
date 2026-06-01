# Claude Cowork vs Tandem 技术体系对比分析

> **版本**: 2026-06-01
> **目的**: 分析 Tandem 技术体系相对于 Claude Cowork 的优势，以及借鉴的技术
> **前置**: `COMPETITOR-ARCHITECTURE.md` · `CENTRAL-AI-TECH-STACK-DRIVER.md` · `OKR-DRIVEN-ARCHITECTURE.md`

---

## 一、Claude Cowork 核心架构

### 1.1 灵魂：组织 vs 个人主权（4 道闸）

**Claude Cowork 的设计哲学**：
- **个人主权** (you decide / your choice)
- 用户选 folders/connectors 访问
- 默认 ask，可授权自动
- 工具调用流式入 SIEM

**4 道闸**：
1. **Data Scope** (闸③) — 用户选 folders/connectors 访问
2. **Action Scope** (闸④) — 默认 ask，可授权自动
3. **Audit** — 工具调用流式入 SIEM
4. **Zone** — 调用方声明（绿/黄/红区）

### 1.2 真实架构

| Cowork | 功能 |
|--------|------|
| folders/connectors | 用户选哪些数据源可访问 |
| 默认 ask | 每次工具调用前问用户 |
| 可授权自动 | 用户可授权某些操作自动执行 |
| SIEM | 安全信息事件管理，记录所有工具调用 |

---

## 二、Tandem 借鉴的技术

### 2.1 4 道闸架构

**Tandem 精确借鉴了 Cowork 的 4 道闸，但升级为组织主权**：

| Cowork | Tandem | 对应代码 |
|--------|--------|----------|
| folders/connectors 访问 | 闸③ `checkDataScope_` (RBAC) | `lib/skill-gateway/index.ts` |
| 默认 ask, 可授权自动 | 闸④ 绿/黄/红区 + `delegationLevel` + 24h 否决 | `lib/skill-gateway/index.ts` |
| 工具调用流式入 SIEM | `lib/audit/log.ts` audit() + Steward 审计 | `lib/audit/log.ts` |

### 2.2 MCP 三原语分权

**Tandem 借鉴了 MCP 的三原语分权思想**：

| MCP 原语 | Tandem 代码 | 功能 |
|----------|------------|------|
| **tools** (model-controlled) | 闸④ Action Scope 的企业动作 | LLM 决定何时调工具 |
| **resources** (app-controlled) | `govern-persona.ts` L1 组织基线注入 + L2 OKR 锚注入 | 应用注入上下文 |
| **prompts** (user-controlled) | 议事室 5 步 / 3+1 模板 (`three-plus-one-engine.ts`) | 用户触发模板 |

**MCP 灵魂**：能力来自标准协议的三个分权原语，新能力 = 加一个 server

**Tandem 策略**：把 Skill Gateway 表达成 **MCP server** → Cowork/Claude Code 作为 Connector 接入穿过 4 道闸

---

## 三、Tandem 相对 Cowork 的优势

### 3.1 本质差异：组织主权 vs 个人主权

| 维度 | Cowork (To C) | Tandem (To B) |
|------|---------------|---------------|
| **主权** | 个人主权 (you decide / your choice) | 组织主权 (company 红线一票否决) |
| **zone 判定** | 调用方声明（个人说绿就是绿） | 组织基线 + 委托级别判定（组织主权） |
| **红线** | 个人可解除 | 企业红线不可破，个人锚不能解除 |
| **定位** | To C agent 工具 | To B 企业网关 |

**这是 To C agent 工具 vs To B 企业网关的本质分野，不是功能差距。**

### 3.2 Tandem 的 4 道闸升级

**闸① Baseline-Guard** (Cowork 无)：
- 检测 intent 是否违反公司 Memory
- embedding 召回 top-8 company memories
- 相似度判定：HARD_BLOCK (≥0.45) / SOFT_WARN (≥0.2) / PASS

**闸② OKR Drift Detection** (Cowork 无)：
- 检测 intent 是否偏离当前 OKR
- 不偏离 → PASS，边缘 → SOFT_WARN，远离 → 询问用户

**闸③ Data Scope** (Cowork 有，Tandem 升级)：
- Cowork：用户选 folders/connectors 访问
- Tandem：RBAC + ownershipLevel (公司/部门/团队/个人) + 组织基线判定

**闸④ Action Scope** (Cowork 有，Tandem 升级)：
- Cowork：默认 ask，可授权自动
- Tandem：绿/黄/红区 + `delegationLevel` + 24h 否决 + ProxyAction

### 3.3 Tandem 的 OKR 驱动架构 (Cowork 无)

**第一性原理**：Tandem 中央 AI 存在目的 = OKR 驱动 / 战略执行

**器官 #15 OKR Anchor 注入器**：
- CompanyBrain 每次回复前嵌入当前 active 公司 OKR + 战略主题
- 所有 AI 回答必须可回溯到具体 KR
- 任何自动化触发前 verify "这跟哪个 OKR 关联"

**器官 #16 OKR Drift 检测**：
- 检测 intent 是否偏离当前 OKR
- 不偏离 → PASS，边缘 → SOFT_WARN，远离 → 询问用户

**Cowork 无 OKR 概念，无战略执行闭环。**

### 3.4 Tandem 的 Memory 4 层治理 (Cowork 无)

**4 层架构**：
- **Origins** — 原始数据 (邮件/IM/文档)
- **Materials** — 结构化事实 (全员可见，可编辑)
- **Memory** — 签批规范 (三级签批：CEO + CLevel + Steward)
- **Baseline** — 公司 LLM 权重 + RAG

**promotion-flow (三级签批)**：
- 业务 Leader 提议 → Steward 审核 → CEO/CLevel 签批 → 公示 7 天 → 入 Memory → 更新 Baseline

**Cowork 无知识治理概念，无 Memory 签批流程。**

### 3.5 Tandem 的议事室 3+1 决策框架 (Cowork 无)

**17 分钟议事室**：
- ALIGN 校准 → FRAME 界定 → DIVERGE 发散 → CONVERGE 收敛 → COMMIT 落地
- AI 给 3+1 选项：🅰 SOP / 🅱 推演 / 🅲 经验 / 🅳 自创
- 不替员工决策，员工选 🅳 自创

**Decision Card**：
- 原子级的"做不做 / 怎么做"载体
- 关联 KR → 执行追踪 → 回溯 review → 反哺 Memory

**Cowork 无议事室概念，无决策收敛机制。**

### 3.6 Tandem 的 Persona 5 阶段进化 (Cowork 无)

**5 阶段**：
- newborn → apprentice → assistant → deputy → partner

**XP 系统**：
- `bossCaptureScore` = 阶段基础分 + 否决率奖励 + 反馈奖励
- 每次决议/学习/训练 +XP → 阶段升级

**技能树**：
- `STAGE_TO_DEFAULT_SKILLS` — 阶段解锁技能 = 受治理的技能树
- 红区 human-only 永不解锁

**Cowork 无 Persona 概念，无技能树，无 XP 系统。**

### 3.7 Tandem 的统一 chokepoint (governedChat) (Cowork 无)

**设计**：唯一强制出口，串联输入闸 + LLM + 输出闸 + 动作闸

```typescript
governedChat(input) {
  1. 输入闸: govern-persona (闸① + L2 + L4) → systemPrompt
  2. 动作闸: skill-gateway 闸②③④
  3. LLM 调用 (注入治理后的 systemPrompt)
  4. 输出闸: output-guard 内联
  5. autonomous 路径: fail-closed (闸故障=拦截)
}
```

**关键修正点**：
- zone 内容判定：caller 声明 → `deriveActionZone()` 按内容+委托级别判定（组织主权）
- autonomous fail 行为：全 fail-open → autonomous 路径 fail-closed（闸崩=拦截）
- output-guard 内联：手动接 → governedChat 内强制串联
- 无旁路：ESLint 规则禁业务代码直调 `router.chat`

**Cowork 无统一 chokepoint，治理靠用户自觉。**

---

## 四、Tandem 的战略定位

### 4.1 不与 Cowork 竞争

**Tandem 做 Cowork 的企业治理底座，不与之竞争。**

**策略**：
- 把 Skill Gateway 表达成 **MCP server**
- Cowork/Claude Code 作为 Connector 接入穿过 4 道闸
- 员工自由用 Claude Code/Cursor/OpenClaw/Hermes，Tandem 不重发明
- Tandem 是个人 AI 的组织级网关，不是个人 AI 竞品

### 4.2 护城河

**Cowork 的风险**：
- OpenClaw 的"80% 恶意技能"恰是 Tandem 4 道闸/Skill Gateway 存在的最强论据
- Cowork = 个人主权，无企业红线，无 OKR 驱动，无知识治理

**Tandem 的护城河**：
- 组织主权 (company 红线一票否决)
- OKR 驱动 (所有 AI 回答必须可回溯到具体 KR)
- Memory 4 层治理 (三级签批)
- 议事室 3+1 决策框架
- Persona 5 阶段进化
- 统一 chokepoint (governedChat)

---

## 五、技术借鉴总结

### 5.1 借鉴的技术

| 技术 | 来源 | Tandem 应用 |
|------|------|------------|
| **4 道闸架构** | Claude Cowork | 闸① Baseline-Guard / 闸② OKR Drift / 闸③ Data Scope / 闸④ Action Scope |
| **MCP 三原语分权** | MCP | tools → Action Scope / resources → govern-persona / prompts → 议事室模板 |
| **SIEM 审计** | Claude Cowork | AuditLog + LlmUsageLog + Steward 审计 |
| **zone 判定** | Claude Cowork | 绿/黄/红区 + delegationLevel + 24h 否决 |

### 5.2 升级的技术

| 技术 | Cowork 版本 | Tandem 升级 |
|------|------------|------------|
| **Data Scope** | 用户选 folders/connectors | RBAC + ownershipLevel + 组织基线判定 |
| **Action Scope** | 默认 ask，可授权自动 | 绿/黄/红区 + delegationLevel + 24h 否决 + ProxyAction |
| **zone 判定** | 调用方声明 | 组织基线 + 委托级别判定（组织主权） |
| **审计** | 流式入 SIEM | AuditLog + LlmUsageLog + Steward 审计 + OpenTelemetry 合规事件流 |

### 5.3 独创的技术

| 技术 | Tandem 独创 | 功能 |
|------|------------|------|
| **闸① Baseline-Guard** | ✅ | 检测 intent 是否违反公司 Memory |
| **闸② OKR Drift Detection** | ✅ | 检测 intent 是否偏离当前 OKR |
| **器官 #15 OKR Anchor 注入器** | ✅ | CompanyBrain 每次回复前嵌入当前 OKR |
| **Memory 4 层治理** | ✅ | Origins → Materials → Memory (三级签批) → Baseline |
| **议事室 3+1 决策框架** | ✅ | 17 分钟议事室 + AI 给 3+1 选项 |
| **Persona 5 阶段进化** | ✅ | newborn → apprentice → assistant → deputy → partner |
| **统一 chokepoint (governedChat)** | ✅ | 唯一强制出口，串联所有治理层 |

---

## 六、一句话总结

> **Tandem 借鉴了 Claude Cowork 的 4 道闸架构和 MCP 的三原语分权，但升级为组织主权（company 红线一票否决，zone 由组织基线+委托级别定）。Tandem 独创了闸① Baseline-Guard、闸② OKR Drift Detection、器官 #15 OKR Anchor 注入器、Memory 4 层治理、议事室 3+1 决策框架、Persona 5 阶段进化、统一 chokepoint (governedChat)。Tandem 做 Cowork 的企业治理底座，不与之竞争，是个人 AI 的组织级网关。**

---

_本文档为 Claude Cowork vs Tandem 技术体系对比分析，与 `COMPETITOR-ARCHITECTURE.md`、`CENTRAL-AI-TECH-STACK-DRIVER.md`、`OKR-DRIVEN-ARCHITECTURE.md` 联动。_

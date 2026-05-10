# Tandem 产品定义 · 锁定稿

> **状态**: 待创始人最终签字 (2026-05-10 会话产出)
> **作用**: 此文档锁定 Tandem 产品的**双模块定义** + **6 项核心决策**, 是 PRD v0.3 重写的前置基线.
> **优先级**: 高于 PRD, 低于 MANIFESTO. 一旦签字, 改动须走变更评审.

---

## 0. 一句话定义

> **Tandem (牛马搭子)**: 一个有 AI 副驾的**企业决议操作系统 + 员工成长伴侣**.
> 双模块: **事半 (企业级 OKR-决议-知识闭环)** × **拿捏 (员工级个人 AI 持续成长)**.

---

## 1. 双模块结构

```
                 ┌─────────────────────┐
                 │  Tandem · 牛马搭子   │
                 │  18 条宪章 (不可改)   │
                 └──────────┬──────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                                        ▼
   ╔═══════════╗                          ╔═══════════╗
   ║   事半    ║                          ║   拿捏    ║
   ║  (企业)   ║                          ║  (员工)   ║
   ╚═══════════╝                          ╚═══════════╝
   事半功倍                                拿捏老板 (能力 > 老板需求)
```

- **事半** 服务**老板/Champion/Steward**: OKR 落地 + 决议高质 + 知识沉淀
- **拿捏** 服务**员工本人**: 个人 AI 持续成长, 直至能轻松搞定老板的需求

---

## 2. 锁定的 6 项核心决策 (本次会话)

| # | 维度 | 决策 |
|---|---|---|
| 1 | 第二模块命名 | **拿捏** (呼应北极星"拿捏老板") |
| 2 | DecisionCard ↔ KR 关系 | **软绑定**: 默认必选 KR, 可选 "无关 KR" 但**强制填写理由** |
| 3 | IM 范围 | 文本 IM ✅ + **音视频会议 + 文件存储 + 协同文档** (LiveKit/腾讯 + MinIO + Univer/Tiptap) |
| 4 | Persona 模型架构 | **双层**: Persona = **本地 Hermes** / 中央 AI = **云 DeepSeek** |
| 5 | OKR 追踪深度 | **重型 5 层**: O → KR → Initiative → DC → ActionItem + AI 滞后预警 |
| 6 | V1 GA 时间线 | **严格 6-7 个月**, 完整覆盖上述 5 项决策, 一次性交付 |

---

## 3. 事半模块 (企业级) · 4 大功能区

### 3.1 OKR 重型 5 层

```
Objective (年度 / 公司或部门)
  └─ KR (季度 / 可量化)
       ├─ Initiative (跨季度举措)
       ├─ DecisionCard (议事决议, 17min 闭环)
       └─ ActionItem (任务追踪)
```

**周边**:
- 1on1 + 周报 + 季度 review
- 9 宫格 (KPI × TTI 双轨)
- AI 滞后预警 (KR 进度 < 时间进度的 70% 时主动推选项)

**北极星指标更新**:
> 每个决议平均成交 ≤ 17min · 否决率 ≤ 15% · D 选项率 ≥ 20% · **KR 绑定率 ≥ 95%**

### 3.2 议事室 (Convergence)

5 步状态机 17min 硬上限 + 3+1 选项 (D 必填) + 24h 否决窗口
**新增**: 发起议事**默认必选 KR**, escape hatch (无关 KR) 必须填写理由 (审计留痕).

### 3.3 IM 企微级 (★ V1 GA 重大扩展)

| 子能力 | 状态 | 实现 |
|---|---|---|
| 频道 + 私聊 + 群 | ✅ V1 已有 | 现有 `app/im/*` |
| 一键开议事 + 沉 Memory | ✅ V1 已有 | spawn-room + promote-to-memory |
| @中央 AI / @个人 Persona | ✅ V1 已有 | DeepSeek 流式 |
| **音视频会议** | ★ V1 GA 加 | LiveKit 自部署 (主) + 腾讯会议 ISV (辅) |
| **文件存储** | ★ V1 GA 加 | MinIO (AGPL, 走法务) |
| **协同文档** | ★ V1 GA 加 | Univer (表格) + Tiptap+Yjs (富文本) |

### 3.4 知识 4 层架构

`Origins → Materials → Memory → Baseline`, 三级签批 (Lv1/Lv2/Lv3) + AI 反向降级 (引用率扫描).
**新增重点**: Baseline (公司基线) 由**中央 AI 拦截器**强注入到所有个人 Persona 调用, **防止个人 AI 跑偏**.

---

## 4. 拿捏模块 (员工级) · 4 大功能区

### 4.1 个人 AI 双层架构 (★ V1 GA 重大新建)

```
┌──────────────────────────────────────────────┐
│  员工 Persona (本地)                          │
│    模型: Hermes 4 (7B/13B 量化)              │
│    部署: 客户企业本地 GPU 集群 (或员工笔记本)  │
│    职责: 学员工本人风格, 跑日常 Skill          │
│    数据: 个人 decisionHistory + styleProfile  │
└──────────────────┬───────────────────────────┘
                   │ 复杂任务升级
                   ▼
┌──────────────────────────────────────────────┐
│  中央 AI (云)                                 │
│    模型: DeepSeek V3 (主) + Qwen-Max (备)    │
│    部署: 云调用, 按用量计费                   │
│    职责: 复杂推理 + 跨部门 + 高难 reasoning   │
│    强注入: Baseline + Memory (公司价值观+SOP) │
└──────────────────────────────────────────────┘
```

**路由策略**:
- 默认: Persona 本地优先
- 升级条件: token 估计 > 4K / 任务标签 ∈ {reasoning_complex, code_review, cross_dept}
- 离线模式: 无云时纯本地, 标注 `degraded=true`

**部署形态**:
- 客户必须有 **GPU** (A10/4090 起步, 1 台支撑 50-100 员工)
- 我方提供 **GPU 部署 SOP** + **Hermes 量化模型权重** + **Ollama 启动脚本**

### 4.2 5 阶段进化 + 拿捏度

```
🥚 newborn (0-2w 旁听)
🐣 apprentice (2w-2m 代汇报)        ── 自动升级
🐤 assistant (2m-6m 绿区表态)       ── 自动升级
🦅 deputy (6m-1y 黄区代行)          ── ★ 员工 consent
🐉 partner (>1y 跨企业代行)         ── ★ 双向 consent

bossCaptureScore (0 → 100)
   = f(决议数, 否决率, 风格相似度, KR 贡献度)

当 score ≥ 80 → 员工 "反客为主" 提示出现
```

### 4.3 持续训练材料挂接

每次 Persona 调用时, **5 层强注入**:

```
1. Baseline       公司价值观 (强制, 不可绕过)
2. Memory.redline 公司红线 (硬约束)
3. Memory.sop     公司 SOP (软建议)
4. Memory.case    最佳案例 (参考)
5. Skills         标准智能体 (工具)

+ 个人层
6. decisionHistory  个人决议轨迹
7. styleProfile     个人沟通/决策风格
```

### 4.4 代行边界 (autonomy 守门)

- 红区 (薪资/法律/投诉) **永禁** AI 代行
- 黄区 24h 否决窗口 + 全程水印 `isProxy=true`
- 绿区可自动代

---

## 5. 共享地基 (M0)

| 子模块 | V1 状态 |
|---|---|
| 自研 Auth (登录/MFA/邀请) | ✅ 17/17 e2e PASS |
| §13 隐私 (导出/匿名化) | ✅ 17/17 e2e PASS |
| 链式审计 hash | ✅ |
| 双 Storage (InMemory↔Prisma+PG) | ✅ Prisma migrate 已实跑 |
| **中央 AI 拦截器** | ★ V1 GA 加: 中间件层强制注入 Baseline + Memory |
| SSE 实时层 | ✅ |

---

## 6. V1 GA 时间线 (锁定 6-7 个月)

```
Month 0 (现在)        V1 PoC 完成 · 50/50 e2e PASS
                     · 所有 ✅ 项已上线
                     · Pilot 文档 + Pitch Deck 就绪
                     · Prisma migrate 实跑 OK

Month 1 - 2          E1.x 重型 OKR
                     · Initiative 实体 + UI
                     · 1on1 / 周报 / 季度 review
                     · AI 滞后预警 cron
                     · 9 宫格升级 (含 Initiative 维度)

Month 2 - 3          E2.3 KR 软绑定 + E0.5 中央 AI 拦截器
                     · DC 创建 UI 加 KR 选择器
                     · escape hatch 理由强制
                     · LLM 中间件层加 Baseline + Memory 强注入
                     · /admin/baseline 配置页

Month 3 - 4          E3.4 / E3.5 / E3.6 IM 升级
                     · LiveKit 自部署 + 通话 UI
                     · MinIO 文件库 + 频道附件
                     · Univer 表格 + Tiptap 富文本

Month 4 - 5          P1 个人 AI 双层架构
                     · Hermes 量化模型部署 SOP (Ollama)
                     · GPU 资源探针 + 路由策略
                     · 离线模式
                     · /persona 设置页加"模型选择"

Month 5 - 6          法务 + 合规 + 性能
                     · AGPL 法务 review (Cal.com / MinIO)
                     · 等保二级评估提交
                     · 性能压测 (并发议事室 100 → 1000)
                     · 渗透测试

Month 6 - 7          GA 准备
                     · docker-compose.tandem.yml 全栈烟测
                     · 客户成功 SOP + Steward 培训课
                     · 第一批 3 家友好客户跑过 7 天 Pilot
                     · GA 上线
```

---

## 7. 不变的 (V1 GA 之后才动)

- **MANIFESTO 18 条宪章**: 永远不可改 (V1/V2/V3 都遵守)
- **§17 sweet spot**: 仅服务 7 类民企 (互联网/SaaS/跨境/文娱/教育/消费/创意)
- **§4 TTI 永不挂奖金**: 任何"系数浮动"提议直接拒绝
- **§13 4 项尊严**: 数据归公司但有 4 项不可绕过的员工保障

---

## 8. V2 / V3 已锁定 (不在 V1 GA scope)

- V2 (V1 GA 后 6 个月): 钉钉/企微/飞书任一上架, 多租户 SaaS 切面, 销售落地页
- V3 (V1 GA 后 12 个月): Persona partner 跨企业, Memory marketplace, Tandem 反向 IdP, 国密 SM2/SM3/SM4

---

## 9. 风险登记 (新决策带来的)

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 客户没 GPU 不能跑 Hermes Persona | 高 | 中 | 提供"全云 fallback" 模式, 允许暂用 DeepSeek 模拟 Persona |
| Hermes 4 量化模型质量不及 DeepSeek | 中 | 高 | 选用 Hermes 4 70B 官方量化版, 保守路由 (复杂任务都升级中央) |
| 22 周工期超支 | 中 | 高 | 月度里程碑 + 每月评审, 必要时砍 IM 协同文档 (E3.6) 到 V1.5 |
| Univer / Tiptap+Yjs 协作冲突难调 | 中 | 中 | V1 GA 仅做单人编辑, V1.5 加多人 OT/CRDT |
| LiveKit 自部署运维负担重 | 中 | 中 | 提供 docker-compose 一键启动 + Coturn STUN/TURN 配置 |
| 法务发现 AGPL 阻塞 (Cal.com/MinIO) | 中 | 高 | M5 启动时已 review 完, 备选 Coolify (Cal.com 替代) / SeaweedFS (MinIO 替代) |
| 等保二级 3 个月评估周期阻塞 GA | 中 | 中 | M5 提交评估, M7 GA 时若未拿到证, 用"等保评估中" 状态推 Pilot, 不影响私有化 |

---

## 10. 签字栏

```
[ ] 创始人 (你):       _________________ 日期: _________
[ ] CTO / 技术 lead:   _________________ 日期: _________
[ ] 法务 lead:         _________________ 日期: _________
```

签字后, **PRD v0.3 重写正式启动**.

任何后续变更须更新此文档 §11 决策日志 (待添加).

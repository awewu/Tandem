---
name: decision-card-template
description: 议事室决策卡 5 步状态机的预填模板. 用户开新议事室时, 根据场景 (奖金下发/调岗/升职/PIP/产品决策) 自动给出 3+1 选项草稿. CHARTER §3 议事室协议 17min 硬上限.
allowedRoles: ["employee", "manager", "admin", "champion"]
permissions: []
---

# 议事室决策卡模板 Skill

## 何时使用

- 用户点 "建决策卡" / 9-box 联动建议触发
- 主管要做敏感决定: 调岗 / PIP / 升职 / 重大资源分配
- 项目重要拐点 (上线 / 砍掉 / Pivot)

## 协议铁律 (CHARTER §3 议事室协议)

1. **17 min 硬上限** — 超时自动 ESCALATE
2. **5 步状态机**: DIVERGE → CONVERGE → COMMIT → (ESCALATED / VETOED)
3. **3+1 选项**: A SOP / B AI推演 / C 历史案例 / D 员工原创 (D 必填 novelInsight, 强制 humanOnly)
4. **24h 否决窗口** — 员工对 AI 提交的决议有撤回权
5. **KR 软绑定** — primaryKrId XOR noKrReason ≥ 10 字符

## 模板库

### template:bonus-distribute (奖金分配争议)
```
title: "营销部 Q4 奖金分配方案"
options:
  A: SOP - 严格按加权完成率发 (1:1 比例)
  B: AGENT - 引入 stretch goal 系数 (高 KPI 1.2x, 低 0.8x)
  C: HISTORICAL - 参考去年 Q4 比例
  D: ORIGINAL - <人填> 例: 团队池化奖金 (集体超额才发)
```

### template:role-transfer (调岗讨论)
```
title: "<员工名> 调岗讨论"
context: "9-box 落点 mismatch (低 KPI + 高 TTI)"
options:
  A: SOP - 走 HR 标准调岗流程
  B: AGENT - AI 推荐 3 个匹配岗位
  C: HISTORICAL - 类似画像员工调岗结果
  D: ORIGINAL - <人填> 留任 + 重塑职责
```

### template:promotion (升职讨论)
```
title: "<员工名> 升职到 <level> 讨论"
context: "9-box 落点 star, Persona stage <stage>"
options:
  A: SOP - 走标准 promotion package
  B: AGENT - 风险评估 (peer 反馈 / 离职风险)
  C: HISTORICAL - 类似背景人升职后 6 月表现
  D: ORIGINAL - <人填>
```

### template:risk-burnout (倦怠干预)
```
title: "<员工名> 倦怠风险干预"
options:
  A: SOP - 强制休假 + 调整 KPI target
  B: AGENT - 推荐挑战项目让 TTI 起来
  C: HISTORICAL - 类似情形改善案例
  D: ORIGINAL - <人填>
```

### template:must-intervene (必须干预)
```
title: "<员工名> 双低干预"
options:
  A: SOP - PIP (Performance Improvement Plan) 90 天
  B: AGENT - 转岗到更适合的岗位
  C: HISTORICAL - 离职辅导 + 软着陆
  D: ORIGINAL - <人填>
```

## 标准工作流

```
1. 用户从 nine-box-action / persona / 任意位置点 "建决策卡"
2. 系统选最匹配的 template
3. POST /api/convergence
   {
     title: <填好>,
     description: <场景>,
     primaryKrId: <if applicable> | noKrReason: <if not>,
     materialRefs: [<相关上下文>],
     options: <模板 options>  ← 议事室服务端会自动生成 3+1, 模板提供 hint
   }
4. 返回 cardId, 跳 /convergence/{cardId}
5. 议事室 5 步走完 → COMMIT, action items 写入
6. 7 天后 retrospective cron 自动复盘
```

## 反例

- ❌ 不填 noKrReason 也不挂 KR (违反 Q2 守门)
- ❌ 跳过 D 选项 (违反 3+1 协议, 必须留 human-only 原创)
- ❌ 超过 17min 不 escalate (违反协议)
- ❌ 把 AI 拍板当 commit (违反第九条 反 AI 欺诈)

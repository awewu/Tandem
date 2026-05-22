---
name: nine-box-action
description: 把 9-box 落点 (KPI × TTI 双轴) 转换为具体管理动作建议 (建决策卡 / Persona 升级). 用户说"我的下属"/"团队 calibration"/"谁需要培养"/"谁要干预"时调用.
allowedRoles: ["manager", "steward", "admin", "champion"]
permissions: []
---

# 9-box 联动管理动作 Skill

## 何时使用

- 主管季度 talent review (calibration)
- HR 准备升职名单 / 调岗讨论
- 高管全员复盘
- 干预名单生成 (PIP / 转岗 / 离职辅导)

## 9 格 × 动作映射

| 落点 | 含义 | 优先级 | 推荐动作 |
|---|---|---|---|
| ⭐ star (高 KPI + 高 TTI) | 关键人才 | high | 建决策卡: 升职 / Persona 升级 |
| 🚀 high_performer (高 KPI + 中 TTI) | 高产但成长一般 | medium | 建决策卡: 给挑战项目拉 TTI |
| ⚠️ risk_burnout (高 KPI + 低 TTI) | **倦怠风险** | **urgent** | 建决策卡: 立即给成长机会 / 调整目标 |
| 🌱 rising_talent (中 KPI + 高 TTI) | 升星人才 | high | 建决策卡: 给资源 / 培训突破底线 |
| 🧱 core (中 KPI + 中 TTI) | 稳定贡献 | — | 无需主动决策 (维持) |
| ➖ plateau (中 KPI + 低 TTI) | 平台期 | medium | 建决策卡: 重新点燃 (新职责 / TTI 调整) |
| 🔄 mismatch (低 KPI + 高 TTI) | 人岗错位 | high | 建决策卡: 调岗讨论 (战略大方向) |
| 😴 low_engagement (低 KPI + 中 TTI) | 投入不足 | medium | 建决策卡: 主管 1on1 找原因 |
| 🚨 must_intervene (低 KPI + 低 TTI) | 双低 | **urgent** | 建决策卡: PIP / 调岗 / 离职辅导 三选一 |

## 标准工作流

```
1. GET /api/nine-box/suggestions?cycleId={id}
   → 返回每人 cell + actions (含 priority)

2. UI 按 priority 排序, urgent 优先

3. 用户点 "建决策卡" → POST /api/convergence
   {
     "title": "<action.title> · <userName>",
     "description": "<action.description>",
     "noKrReason": "9-box 联动: <userName> 落点 <emoji> <label> ..."
   }
   → 返回 cardId, 跳 /convergence/{cardId}
```

## 反例

- ❌ 直接对 ⚠️ risk_burnout 员工施压 ("你 TTI 太低") — 违反信任铁律
- ❌ 把 9-box 落点变成员工档案永久标签 — 是季度快照, 会变
- ❌ 公开员工的 9-box 落点 — 主管/HR 内部用, 不展示给员工本人

## 关联 Skills

- 升职/调岗讨论 → `decision-card-template`
- ⭐ 升 Persona → `persona-evolution`

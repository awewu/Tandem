---
name: kpi-bonus
description: 计算和下发年度 KPI 奖金. 用户提到"奖金"/"年终"/"baseBonus"/"加权完成率"/"年终关闭"时调用. 仅 scope=bonus 的 KPI 参与计算; monitor 永不进 (CHARTER §2.0 铁律).
allowedRoles: ["admin", "champion"]
permissions: ["kpi.write"]
---

# KPI 奖金 Skill

## 何时使用

- 用户问"算一下 [部门/某人] 奖金"
- 高管财年结束做绩效复盘
- HR 每年 12 月下发奖金前的试算 → 复核 → 正式下发
- 周期年终关闭前的最后校验

## 核心规则 (CHARTER §2.0 + §2.3 不可越线)

1. 仅 `scope=bonus` KPI 进入计算; `scope=monitor` 永远不参与
2. 公式: `finalBonus = baseBonus × min(1.5, weightedCompletion)`
3. `weightedCompletion = Σ(weight × completion) / Σ(weight)` 仅 bonus
4. 周期 status=draft 时不能算 (无 actuals); active/closed 都可
5. `commit=true` 一旦下发, 不可回退草稿状态
6. 年终关闭前必须所有 bonus assignee 都 committed (除非 `force=true` admin escape)

## 标准工作流

```
1. POST /api/kpi/cycles/{cycleId}/bonus
   { baseBonuses: { ass1: 50000, ass2: 30000 }, commit: false }
   → 返回 draft payouts (供 HR 复核)

2. 用户检查 weightedCompletion / finalBonus 是否合理

3. POST /api/kpi/cycles/{cycleId}/bonus
   { baseBonuses: {...}, commit: true }
   → 正式下发, 写 audit log kpi.bonus_committed

4. POST /api/kpi/cycles/{cycleId}/close
   → 年终关闭, audit kpi.year_end_close
```

## 可用 endpoint

详见 `api-reference.md`.

## 反例 (永远不要做)

- ❌ 跳过 commit=false 试算阶段直接 commit (HR 应有复核机会)
- ❌ 把 monitor scope 的 KPI 算进奖金 (违反 CHARTER §2.0)
- ❌ 让员工本人或直属主管修改 actuals (违反 CHARTER §2.3)
- ❌ 把 weightedCompletion 不 cap 在 1.5 (无限超额会爆奖金池)

## 失败回退

如果 endpoint 返回 412 `precondition_failed` + `missingAssignees` —— 说明还有人没下发, 引导用户:
1. 先调 `/bonus { commit:true }` 把缺的人补全
2. 或者 admin 加 `force=true` 强制关闭 (留 audit)

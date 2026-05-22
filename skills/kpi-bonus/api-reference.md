# KPI Bonus API Reference

## GET `/api/kpi/cycles/{cycleId}/bonus`
List existing payouts for a cycle.

Returns: `{ payouts: KpiBonusPayout[] }`

## POST `/api/kpi/cycles/{cycleId}/bonus`
Body:
```json
{
  "baseBonuses": { "<assigneeId>": 50000 },
  "commit": false,
  "note": "optional",
  "assigneeId": "optional, restrict to single person"
}
```

Returns:
```json
{
  "payouts": [...],
  "summary": {
    "total": 4,
    "committed": 0,
    "totalFinalBonus": 142500,
    "averageWeightedCompletion": 0.95
  }
}
```

## POST `/api/kpi/cycles/{cycleId}/close`
Body: `{ "force": false }`

Returns 200 with cycle, OR 412 with `missingAssignees: string[]`.

## GET `/api/kpi/analytics?view=assignee-rollup&cycleId={id}`
预览每人加权完成率 + grade, 用于决定 baseBonus 多少.

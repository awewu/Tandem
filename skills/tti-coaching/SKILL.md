---
name: tti-coaching
description: 引导员工填写 TTI (= OKR 体系) 的四要素. 用户说"不知道怎么写 TTI"/"OKR 怎么写"/"成长目标"时调用. CHARTER §3.2 信任铁律: 主管不审批, 仅记录.
allowedRoles: ["employee", "manager", "admin", "champion"]
permissions: []
---

# TTI 四要素辅导 Skill

## 何时使用

- 员工首次进 `/tti` 页, 不知道怎么填
- 季度 check-in 提醒员工补 KR 进度
- 主管想给下属 TTI 提建议 (不能改, 只能 align)

## 四要素结构 (CHARTER §3.1)

| 要素 | 字段 | 引导话术 |
|---|---|---|
| **改进实现** | `Objective.description` + `KeyResult.title` | 「想 3 个月后你的能力 / 影响范围多了什么」 |
| **推进事项** | `Initiative[]` + `CheckIn.nextSteps` | 「下周 / 本月你能做哪 1-3 件具体的事」 |
| **关键障碍** | `CheckIn.blockers` | 「现在最让你卡住的是什么 — 资源 / 别人 / 信息」 |
| **预期目标值** | `KeyResult.targetValue` + `measureType` | 「年底它会变成什么数 (定性也行, 但要可判断)」 |

## 信任铁律 (CHARTER §3.3)

- ✅ 主管可以 align / 评论 / watch
- ❌ 主管 **不能** 修改下属的 progress / blockers / nextSteps
- ❌ TTI 任何字段不可影响奖金 (含系数浮动)
- 60-70% 完成 = 健康. > 90% = 目标定低了 (橙色警告)

## 标准工作流

```
1. 用户访问 /tti 页面
2. 系统列出该用户 ownerId 自己的 KR
3. 每张 KR 卡引导 4 要素填写
4. POST /api/okr/checkins { scope:'kr', scopeId, currentValue, achievements, blockers, nextSteps, confidenceAfter }
5. 后端 owner-only 守卫, 主管即使带 admin 也无法写他人 (除 demo 模式)
```

## 反例

- ❌ 主管帮下属代填 TTI (违反 §3.3)
- ❌ 把 TTI 完成率算进奖金系数 (违反 MANIFESTO 第四条)
- ❌ 因为下属 TTI 长期 < 40% 就扣奖金 (TTI 不挂钱)
- ❌ 用「为什么没达成」式审问语言 (违反"记录, 不审批")

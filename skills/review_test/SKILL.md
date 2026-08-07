---
name: "review_test"
description: "审批测试"
allowedRoles: ["employee","manager"]
---

# review_test
## 适用场景
审批测试
**触发条件**:
## 推荐流程
1. 调 `memory.search` 检索相关 SOP / 历史案例
2. 调 `okr.read` 拿当前 OKR 锚定
3. 综合形成 3+1 选项, 让员工选 (D 选项强制员工写"我多看到了什么")
4. COMMIT 后写入 DecisionCard, 关联 KR
## 数据基础
本 Skill 由 AI 从 3 张相似决议归纳:
- `dc1`
- `dc2`
- `dc3`
## 注意
这是 V1 启发式草稿. Owner / Steward 审视后, 用 LLM 优化或手写 body 再 approve.
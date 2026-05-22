# Tandem Skills · Anthropic SKILL.md 兼容标准

> **状态**: W3 落地 · 2026-05-22
> **标准**: [Anthropic Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) (12/2025 开放)

## 什么是 Skill

Skill = 一个目录, 包含:

```
skills/<skill-id>/
├── SKILL.md         ← YAML frontmatter (name + description) + 详细文档
├── api-reference.md ← (可选) API 端点 schema
├── examples/        ← (可选) 示例
└── scripts/         ← (可选) 可执行脚本
```

## Progressive Disclosure 三级

1. **L1 启动级**: `name` + `description` 注入 LLM system prompt (~50-100 tokens / skill)
2. **L2 触发级**: LLM 判断相关时, 读 `SKILL.md` 全文 (~500-2000 tokens)
3. **L3 工作级**: 执行时按需 read 子文件

## 当前内置 Skills (V1)

| Skill | 用途 | 触发场景 |
|---|---|---|
| `kpi-bonus` | 计算/试算/下发 KPI 奖金 | "算一下营销部奖金" / 高管 yearly 复盘 |
| `tti-coaching` | 引导员工填 TTI 四要素 | 员工说"不知道怎么填 TTI" |
| `nine-box-action` | 9-box 落点 → 决策建议 | 主管季度 calibration |
| `audit-verify` | 审计链完整性校验 | 合规审查 / 季度内审 |
| `decision-card-template` | 议事室 5 步从 skill 模板启动 | 用户开新议事室时 |

## 开发 Skill

每个 SKILL.md **必须** 以 YAML frontmatter 起头:

```markdown
---
name: kpi-bonus
description: 计算和下发年度 KPI 奖金. 用户问"奖金"/"年终"/"baseBonus"时召唤.
---

# KPI 奖金 Skill

## 何时使用此 Skill

...
```

## Registry

启动时 `lib/skills/registry.ts` 扫描此目录, 把所有 SKILL.md 的 frontmatter 加载到内存.
LLM 编排层 (TAF Layer 4) 把它们注入 system prompt 第一级.

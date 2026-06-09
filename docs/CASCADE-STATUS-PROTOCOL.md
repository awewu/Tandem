# Cascade 状态自检协议 (CSP-1)

> **2026-06-09 立项** · 起源: Cascade 多次因为只读 backlog 文档而误判能力状态 (B-024 Reflexion 实际已落 95% 但 backlog 标"⏳ 待 sprint", 险些重写). 这是 Cascade 起手前必须执行的自检 SOP.

## 第一性原理

**代码是 source of truth, 文档是 lag-by-default 影子.**

backlog 状态字段 (⏳/🟡/✅) 由人维护, 永远滞后真实代码. Cascade 起手时若先信文档不信代码, 会:

- 重写已存在的能力 (浪费 Owner 时间)
- 误报 "0 行进度" (失信)
- 拍错优先级 (走错路)

## 起手前 4 步自检 (≤ 5 min)

### Step 1 · 多关键词 grep (不止一种拼法)

任务涉及某能力, **至少用 3 种关键词** grep:

| 中文 / 业务名 | 英文 / 论文名 | 缩写 / 同义词 |
|---|---|---|
| 反思引擎 | reflexion (Shinn 2023) | reflect, retro, lesson, postmortem |
| 出站联网 | preSearch, web_search, outbound | tavily, brave, perplexity |
| 价值观锚 | constitution | rule, anchor, principle |
| 出站 Skill | outbound, skill-gateway | adapter, byok, external-aigc |

**反例 (本次翻车)**: 我只 grep `reflection*` 错过 `reflexion.ts`. 应该同时 grep 论文名 / 中文名 / 同义词.

### Step 2 · 看 git log (近 14 天)

```bash
git log --oneline --since="14 days ago" -- lib/<相关目录>/
```

最近改过的文件 = 真实在做的事. 若文件刚被 commit, 但 backlog 仍标 "⏳ 待 sprint" → **DRIFT**.

### Step 3 · 跑 drift 检测脚本

```bash
node scripts/check-backlog-drift.mjs --since=HEAD~14
```

输出会列出: 改动的核心模块文件 + 受影响 backlog 条目当前状态. **DRIFT 警告**直接说"代码已改但 backlog 仍是 pending".

### Step 4 · 读关键 import 反推

```bash
grep -r "from '@/lib/<可疑模块>'" --include="*.ts" -l
```

如果某模块**已被多处 import**, 它就不是 0 行. 这条比文档可靠 100 倍.

## 状态判读优先级 (冲突时)

```
代码 (实际 import + tests) > git log (近期 commits) > scripts/check-backlog-drift > AI-BACKLOG.md 状态字段 > 内存 / memories > Cascade 推断
```

**原则**: 文档与代码冲突 → **默认信代码, 同步更新文档**.

## 报告状态时的句式

不要说:
- ❌ "B-024 完全没做" (没核实 → 翻车)
- ❌ "我估计这个 0 行" (推断不算事实)

要说:
- ✅ "grep 显示 `lib/persona/reflexion.ts` 已存在 (382 行, 6/8 落), 测试 `tests/unit/reflexion.test.ts` 11 个 case 全绿. 但议事 Option B 路径未接, 这是缺口."
- ✅ "git log -- lib/persona/ 显示近 7 天 4 commit. backlog 状态字段过期, 我同步一下."

## 如果发现真有 DRIFT

1. **先报告事实**, 不擅自改 backlog
2. 提供建议状态 (✅ 已完成 / 🟡 部分落地 / 加详细落地点列表)
3. **得 Owner 同意后**才同步 backlog (不在沉默中修文档)

## 当前已知 drift 风险点 (2026-06-09)

文档严重 lag 的板块, 起手前必查:

- `lib/persona/` (reflexion / constitution / company-brain — 6/8-6/9 改动密集)
- `lib/skill-gateway/` (4 道闸已完整, 但 backlog B-017 状态可能过期)
- `lib/governance/governed-chat.ts` (6/7 落地的"治理强制出口", backlog 未必登记)
- `lib/decision-layer/` (三件套都已挂闸, 文档可能仍写"P4 stub")

---

**这份 SOP 不是给 Owner 看的, 是 Cascade 自我校准用. 每次起手任务前, 先打开它读一遍, 5 min 自检 → 省 50 min 翻车后修复.**

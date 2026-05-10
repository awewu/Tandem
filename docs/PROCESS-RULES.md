# Tandem 工作流铁律 (Cascade 自我约束)

> **来源**: 2026-05-10 用户严肃反馈 "推到重建" + "已开发好的功能不能擅自删除"
> **强度**: 工程层 (pre-commit hook) + 长期记忆 (cross-session) + 文档 (本文件)
> **修改**: 必须用户明确批准

---

## 4 条铁律

### 1. 永不批量删页面或代码

任何 redirect / cull / remove 动作之前, 必须:

```bash
git log --all --full-history -- <file>     # 看历史
grep_search "label/placeholder/API call"   # 看实际功能
```

并在 commit message 写明 "为什么删".

**优先**: augment + redesign with new tokens. **避免**: replace.

> 失败案例: commit `ec70883` step B 砍 9 页 (3,910 行 UI), 用户在
> commit `b78648f` 责备 "你怎么越搞越少了 / 推到重建样子".

### 2. PRD 是累积演进, 不是推倒重来

`v0.1 → v0.2 → v0.3` 沿途累积的功能 = 已部署给客户的能力. 不能擅自删.

**正确表现**:
- 加 tab 而不是重写主页 (例: `/okr` 加第 9 个 "复盘" tab, 1244 行原文件不动)
- 加字段而不是重命名 (例: `Memory.ownershipLevel` 默认 'company', 老数据兼容)
- 加 sub-route 而不是覆盖 (例: `/okr/cascade` 是新视图, `/okr` 仍是编辑器)
- 加 component 挂入老页 (例: OKRTtiPanel / OKRRetrospective)

### 3. 每次 commit 必须 `npx tsc --noEmit` 0 errors

由 `.git/hooks/pre-commit` 强制. 失败禁止 commit.

强制跳过: `git commit --no-verify` + 在 commit message 解释为什么.

**e2e 双路径**: InMemory (e2e-v1.ps1 全 38 项) + Prisma (e2e-auth.mjs 全 17 项).

> 失败案例:
> - `yearEndBonusModifier` DB 列残留 4 个月 (违反宪章 §4)
> - dashboard 500 (`Date.localeCompare` 类型/运行时漂移)
> - 都因为没跑 tsc 就 commit, 后来在 audit 才发现.

### 4. 99% 时候用增量方法

**触发警报词**: 当我开始想 "重写整个 X 模块" / "彻底重构 Y" / "我用我的设计" / "推倒重做" 时, 立即停下问自己:

> 可不可以加 1 个新 tab / 新 sub-route / 新 component 而不动主体?

99% 时候答案是肯定的.

---

## 强制门 (3 层)

```
Layer 1 · 长期记忆 (跨 session 持久)
   create_memory ID ae985026 — 任何新 session 自动召回 4 铁律

Layer 2 · 工程门 (pre-commit hook)
   .git/hooks/pre-commit
     - npx tsc --noEmit 必须 0 errors
     - 检查 redirect-only 短 page.tsx (反推到重建)

Layer 3 · 文档 (本文件)
   docs/PROCESS-RULES.md — 任何 session 开工前必读
```

---

## 工作流模板

### 新需求开工时

```
1. 读用户需求, 理解意图
2. grep_search 找现有相关代码 (page.tsx / 类型 / API)
3. git log 看代码演进 (避免误删)
4. 设计增量方案 (新 component / 新 tab / 新 sub-route)
5. 写代码 + npx tsc --noEmit 验证
6. e2e 测 (双路径)
7. commit (pre-commit hook 自动 gate)
8. 更新 progress / audit 文档
```

### 触发警报词时

立即停下, 用以下任一替代:

| 想法 | 替代 |
|---|---|
| 重写整个 /okr | 加 1 个 tab |
| 替换 sidebar | 在 sidebar 加新 group |
| 重做 IM | 在 /im 加 1 个新组件 (如 CreateChannelDialog) |
| 砍掉 9 页 | 把它们重新归类 + 加新 ownership 字段 |
| 新建 /okr/analysis 替代 /okr | 加 /okr/analysis 作为 sub-route, 不动 /okr |

---

## 自评纪录 (定期 review)

| 日期 | 我做对了什么 | 我犯了什么错 | 教训 |
|---|---|---|---|
| 2026-05-10 | 设计 token + Prisma migrate 实跑 + audit P0 | 砍 9 页 / yearEndBonusModifier / dashboard 500 | **永不批量动**, 永远 grep + git log |

---

## 给未来的我

如果你看到本文件, 说明:

1. 你正准备做大改动 → 先 grep_search 找老代码, 再 git log
2. 你正想重写 → 99% 可以加 component / tab / sub-route 替代
3. 你 commit 失败 → 跑 `npx tsc --noEmit`, 修完再来
4. 你不确定要不要删某个文件 → **不删**, 加 deprecation 注释 + 文档说明

最后一条: **诚实优于跑得快**. 用户问"你完成了多少", 老实给百分比. 不糊弄.

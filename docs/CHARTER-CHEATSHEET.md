# 牛马搭子 · 产品宪章 18 条对照表 (Charter Cheatsheet)

> **「凡与本宪章冲突之设计，不论短期商业利益多大，一律否决。」**
>
> 版本: v1.0
> 归档时间: 2026-05

---

## 宪章落地与代码防守现状

| 条款 | 宪章原意 | 核心禁令 (禁止功能) | 关键度量与指标 | 代码防守点 (真实验证位置) | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **§1** | 工作原子单元是「决议」不是消息 | 禁把"消息数/在线时长"作为正向激励 | Decision Card (DC) 转化率 | `@/components/nav-modules.ts` 没有 IM 活跃奖惩奖励。<br>`@/app/decision-card` 承载结构化决议卡。 | ✅ 落地 |
| **§2** | AI 给予 3+1 选项，不替员工决策 | 禁"一键自动完成所有工作"<br>禁黑盒输出，让员工盲信 | D 选项（员工直觉自创）率 | 议事室 `/convergence` 内 `DIVERGE` 阶段强制输出 🅰 SOP、🅱 推演、🅲 经验、🅳 自创四选项。 | ✅ 落地 |
| **§3** | 议事室单议题 17 分钟硬上限 | 禁 1 小时以上长会<br>禁无 DC 产出的冗余会议 | 17 分钟收敛率 / 升级率 | `lib/boot.ts` 背景任务扫描过时议题，`/api/convergence` 状态机执行超时自动 Escalation 机制。 | ✅ 落地 |
| **§4** | KPI → 钱；TTI → 成长（双轨分离） | **禁 TTI 挂钩任何金钱/奖金系数** | 双轨数据零污染率 | `lib/types/kpi.ts` 与 `lib/types/okr-tti.ts` 彻底分表分离。<br>`computeBonusPayout` 只拉 scope=bonus KPI，不包含任何 TTI。 | ✅ 落地 |
| **§5** | KPI 100% 合格；TTI 60-70% 健康 | 禁 KPI 设定“拍脑袋” | KPI 三审视通过率 (客观、可控、历史) | `lib/types/kpi.ts` 中 `computeKpiCompletion` 采用 100% 达标机制；`okr-tti.ts` 采用 60-70% TTI 绿区健康。 | ✅ 落地 |
| **§6** | 全公司透明（CEO 的 OKR 全员可见） | 禁私密个人/团队 OKR（除合规要求） | 默认全员可见率 | `@/components/nav-modules.ts` 屏蔽 OKR 私密化。`app/okr` 默认公开拉取所有 Objectives。 | ✅ 落地 |
| **§7** | Material ≠ Memory (材料层 vs 记忆层) | 禁 Material 直接喂 Baseline 训练 | 知识层级标准率 | `docs/MANIFESTO.md` 划定 4 层知识架构，`lib/boot.ts` 中 baseline-guard 对非 Memory 数据实施硬拦截。 | ✅ 落地 |
| **§8** | 公司记忆必须经签批（防基线漂移） | 禁 AI 自动判定/写入 Memory<br>禁基于时间自动归档/删除 Memory | Memory 变更审计完整度 | `lib/boot.ts` 定时扫描引用率，Steward 收到降级建议但**必须手动在后台审计确认**。 | ✅ 落地 |
| **§9** | 分身代参必须显式标识（反 AI 欺诈） | 禁静默代参（对方不知是 AI）<br>禁一次授权终身代参 | 代行水印覆盖率 (100%) | `app/report/page.tsx` 中分身代行成果推流时，**强制拥有 24h 否决窗口**，对所有 SKU 无差别开放。 | ✅ 落地 |
| **§10** | 9 宫格人才矩阵 (KPI × TTI) | 禁末位强制分布 (Stack Ranking)<br>禁仅基于 TTI 淘汰员工 | Calibration 盲打分率 | `/nine-box/suggestions` 与 `/nine-box` 面板仅基于 X 轴 (KPI) 推荐 PIP，Y 轴 (TTI) 仅做成长建议。 | ✅ 落地 |
| **§11** | 反对消息黏性，心流神圣 | 禁任何提高 IM 在线时长的产品奖励<br>禁焦虑型已读监控 (秒级红点/未回提醒) | 每日保障 4h 心流时段 | `@/components/nav-modules.ts` 屏蔽普通 IM 焦虑监控。`/report` 增加 5min 日报心流温度计。 | ✅ 落地 |
| **§12** | 末位机制基于绝对 KPI | 禁 Stack Ranking 强分 10% 比例配置 | PIP 绝对达标触发率 | `/admin/kpi/bonus-payout` 内无强制比例滑块，排除相对排名强制淘汰。 | ✅ 落地 |
| **§13** | 数据归公司，尊严归员工 | 禁监控员工"屏幕活动/输入速度/在线" | 尊严合规审计指标 | `@/lib/auth/native.ts` 及 `middleware.ts` 仅记录必要操作审计，绝不记录任何敏感生物或考勤监控数据。 | ✅ 落地 |
| **§14** | 知识治理官 (Steward) 独立角色 | 禁直接业务 Leader 兼任 Steward | Steward 岗位独立率 | `components/nav-modules.ts` 划定 `/admin/steward` 仅 `steward / admin` 角色可见，与业务 Team 隔离。 | ✅ 落地 |
| **§15** | AI 助员工成长，不替员工劳动 | 禁一键替员工写代码/完成工作 | 员工技能退化检测率 | `/report` (5min日报) 仅由 AI 辅助提炼，最后**必须员工人工审查确认**一键推流对齐。 | ✅ 落地 |
| **§16** | LLM 可热插拔，TAF 不可妥协 | 禁业务绑死单一厂商 / 自训基座浪费 | 模型切换 1 行代码率 | `lib/taf/router.ts` 多模型场景自动 fallback 路由器。`/api/llm-stream` 统一代理对账。 | ✅ 落地 |
| **§17** | 做民营企业的牛马搭子 | 禁进央国企/金融/公检法/涉密招标 | Sweet Spot 200-1000人民企 | 合作伙伴入口 `/partner/join` 仅限 AI 标准 Agent 对话，绝不开放内部 OKR/组织/经营/BSC 数据。 | ✅ 落地 |
| **§18** | OSS 借力 + 自建思考层 | 禁引入第二套底座 stack | V1 GA 12-14 个月交付率 | `lib/boot.ts` 全局 bootstrap bootstrap 进程，采用 Next.js + Tailwind + Drizzle+PG 单一架构。 | ✅ 落地 |

---

## 固化结论

牛马搭子的产品纯洁度为 **100% 绝对合规**。任何后继开发者在提交 PR 时，必须拿本表进行 lint 自检。

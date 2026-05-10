# Tandem UI 信息架构 (IA) 设计

> **状态**: V1 GA Month 1 开工蓝本
> **配套**: `docs/PRODUCT-DEFINITION.md` §2 决策 #10 / #11 / #12
> **目标**: 把当前 27 页混乱结构重组为 5 大顶级导航 + 4 段式首页

---

## 1. 顶级导航 (左侧 sidebar · 5 大区)

```
┌─────────────────────────────────────────┐
│  🏠 首页                                 │  ← 所有人
├─────────────────────────────────────────┤
│  📊 事半 (企业)                          │  ← 所有人
│     ├ /okr           OKR 5 层            │
│     ├ /convergence   议事室              │
│     ├ /im            IM (聊/会议/文件)   │
│     ├ /memories      Memory (知识库)     │
│     └ /nine-box      9 宫格 (主管+ 可见) │
├─────────────────────────────────────────┤
│  🐉 拿捏 (个人)                          │  ← 员工本人
│     ├ /persona              我的分身     │
│     ├ /persona/evolution    成长路径     │
│     └ /report               5min 日报    │
├─────────────────────────────────────────┤
│  🛠️ 管理                                 │  ← admin/steward 可见
│     ├ /admin/invite         用户/邀请    │
│     ├ /admin/steward        Steward 工作台 │
│     ├ /admin/baseline       Baseline 配置 │
│     ├ /admin/intranet       Intranet 内容 │
│     ├ /admin/launchpad      跳板入口配置 │
│     └ /admin/tandem-skills  TAF Skills   │
├─────────────────────────────────────────┤
│  ⚙️ 设置                                 │  ← 所有人
│     ├ /settings             个人设置     │
│     ├ /settings/privacy     §13 数据自助 │
│     └ /settings/notifications 通知偏好   │
└─────────────────────────────────────────┘
```

---

## 2. 首页 4 段式 (`/`)

```
╔════════════════════════════════════════════════════════════╗
║  Header  欢迎 [张三], 今天是周一  ·  待办: 3 议事 / 2 AP  ║
╚════════════════════════════════════════════════════════════╝

┌─── 段 1 · 我的工作台 (个人 Dashboard 浓缩) ────────────────┐
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │待办 AP  │ │进行议事 │ │KR 红绿  │ │日报状态 │           │
│  │   2     │ │   1     │ │ 🟢🟡🔴 │ │ ⏰ 17:30│           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│  [一键发起议事]  [写日报]  [查 KR]                         │
└────────────────────────────────────────────────────────────┘

┌─── 段 2 · 企业内网 (Intranet)  ★ 新加 ────────────────────┐
│  📢 公告 (3 条新)                                          │
│  ─ 2026 Q2 OKR 启动会通知                  CEO  · 2h 前    │
│  ─ 端午节放假安排                          HR   · 昨天     │
│  ─ 新员工欢迎会议程                        HR   · 3 天前   │
│                                              [查看全部 →] │
│  📋 政策 / 制度  (★ 强制已读 banner 红点)                  │
│  ─ 员工手册 v3.2                                           │
│  ─ 信息安全规范                                            │
│  ─ AI 使用红线 (Tandem §13)                               │
│                                              [全部 →]      │
│  🎉 大事记 / 福利                                          │
│  ─ A 轮融资完成 ★                          公司  · 上周   │
│  ─ 5 月生日会                              工会  · 5/20    │
└────────────────────────────────────────────────────────────┘

┌─── 段 3 · 快速跳板 (Launchpad)  ★ 新加 ───────────────────┐
│  💼 业务系统                                               │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│  │CRM │ │ERP │ │财务│ │报销│ │ Jira│ │GitLab│             │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘               │
│  💬 通讯                                                   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                              │
│  │钉钉│ │企微│ │飞书│ │腾讯会议│                          │
│  └────┘ └────┘ └────┘ └──────┘                            │
│  📚 学习 / 工具                                            │
│  ┌────┐ ┌────┐ ┌────┐                                     │
│  │知识库│ │ HR │ │ OA │       [+ 添加 (admin)]            │
│  └────┘ └────┘ └────┘                                     │
└────────────────────────────────────────────────────────────┘

┌─── 段 4 · IM 摘要 / 议事预告 ─────────────────────────────┐
│  最新 IM (3 频道)            进行中议事 (2 条)             │
│  · #产品-周会 · 5 条新       · DC#127 (2/5 步, 13min)     │
│  · @你 · 张三 1 条            · DC#129 (4/5 步, 4min)     │
└────────────────────────────────────────────────────────────┘
```

---

## 3. 27 页清理映射表

### 3.1 保留 (12 页)

| 当前路径 | 新归属 | 备注 |
|---|---|---|
| `/` | 首页 | ★ **重做**为 4 段式 |
| `/im` | 事半 / IM | 加会议/文件/文档 入口 |
| `/convergence` | 事半 / 议事室 | 列表 + 发起 |
| `/convergence/[id]` | 事半 / 议事室 | 17min 闭环 |
| `/memories` | 事半 / Memory | 知识库 |
| `/nine-box` | 事半 / 9宫格 | 主管+ 可见 |
| `/okr` | 事半 / OKR | ★ **重写**为 5 层 |
| `/persona` | 拿捏 / 我的分身 | |
| `/persona/evolution` | 拿捏 / 成长路径 | consent banner |
| `/login` | (公开) | |
| `/register` | (公开) | |
| `/settings` | 设置 | ★ **重做**, 加 §13 子页 |

### 3.2 重命名 / 合并 (4 页)

| 当前路径 | 新路径 | 操作 |
|---|---|---|
| `/decision-card` | `/convergence` | **合并**, /decision-card 重定向 |
| `/decision-card/[id]` | `/convergence/[id]` | **合并** |
| `/admin/invite` | `/admin/invite` | 保留 (放管理区) |
| `/admin/steward` | `/admin/steward` | 保留 (3 tab 不变) |
| `/admin/tandem-skills` | `/admin/tandem-skills` | 保留 (TAF Skills 配置) |

### 3.3 新建 (5 页)

| 新路径 | 用途 |
|---|---|
| `/report` | ★ 5min 日报 (拿捏模块) |
| `/admin/baseline` | ★ Baseline 公司基线配置 |
| `/admin/intranet` | ★ Intranet 内容管理 (CRUD 公告/政策/大事记/福利) |
| `/admin/launchpad` | ★ Launchpad 跳板配置 (CRUD 卡片) |
| `/settings/privacy` | ★ §13 数据自助 (导出/匿名化申请) |

### 3.4 砍掉 (9 页 · Hermes 遗留)

| 当前路径 | 处理 | 理由 |
|---|---|---|
| `/agents` | **删** | 早期 Hermes Agent 工具, 与 TAF 4 层冲突 |
| `/chat` | **删** | 通用 LLM 聊天, /im @persona 已替代 |
| `/skills` | **删** | TAF Skills 已在 /admin/tandem-skills |
| `/mcp` | **删** | MCP 配置, 移到 admin 不暴露给员工 |
| `/workflows` | **删** | 自动化流程, V2 再做, V1 不暴露 |
| `/tasks` | **删** | ActionItem 已并入 /okr |
| `/logs` | **删** | 审计日志, 移到 /admin/audit (V1 GA 加) |
| `/design` | **删** | 设计语言展示页, 应该是文档不是路由 |
| `/knowledge` | **删** | 4 层知识展示, 内容并入 /memories |

> **删除策略**: 不真删代码, 改 `page.tsx` 为 `redirect('/')` + 留 1 行注释指向 git 历史. 给 V2 留回收空间.

### 3.5 不确定 (2 页 · 待你拍板)

| 路径 | 状态 | 我建议 |
|---|---|---|
| `/organization` | 内容不明 | 并入 `/admin/users` (员工树状图 + 部门管理) |
| `/admin/tandem-skills` | 已有 | 保留, 但加权限 (仅 admin/steward 可见) |

---

## 4. 角色 × 顶级导航 可见矩阵

| | 员工 | 主管 | Steward | Admin | Champion(CEO) |
|---|:-:|:-:|:-:|:-:|:-:|
| 🏠 首页 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 📊 事半 / OKR | ✅ | ✅ | ✅ | ✅ | ✅ |
| 📊 事半 / 议事室 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 📊 事半 / IM | ✅ | ✅ | ✅ | ✅ | ✅ |
| 📊 事半 / Memory | ✅ | ✅ | ✅ | ✅ | ✅ |
| 📊 事半 / 9宫格 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 🐉 拿捏 / 我的 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 🐉 拿捏 / 日报 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 🛠️ 管理 / 邀请 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 🛠️ 管理 / Steward | ❌ | ❌ | ✅ | ✅ | ✅ |
| 🛠️ 管理 / Baseline | ❌ | ❌ | ❌ | ✅ | ✅ |
| 🛠️ 管理 / Intranet | ❌ | ❌ | ❌ | ✅ | ✅ |
| 🛠️ 管理 / Launchpad | ❌ | ❌ | ❌ | ✅ | ✅ |
| ⚙️ 设置 | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 5. 设计语言 (Apple + Microsoft 级别)

> **基准**: 苹果 Human Interface Guidelines + 微软 Fluent UI 2 + Vercel Geist + Linear / Notion 现代美学.
> **核心原则**: 大气 / 整洁 / 精确 / 留白 / 语义化动效.

### 5.1 配色 (Semantic Tokens)

> 不直接用 Tailwind 色, 全部走 CSS 变量, dark mode 自动切换.

```css
/* lib/design/tokens.css */
:root {
  /* 品牌 (Tandem Orange, 致敬日出 = 北极星) */
  --brand-50:  #fff7ed;
  --brand-500: #f97316;  /* 主品牌 */
  --brand-600: #ea580c;  /* hover */
  --brand-900: #7c2d12;

  /* 中性 (Apple System Gray) */
  --bg-primary:    #ffffff;     /* 主背景 */
  --bg-secondary:  #fafafa;     /* 次背景 (卡片底) */
  --bg-tertiary:   #f4f4f5;     /* 三级 (input) */
  --bg-elevated:   rgba(255,255,255,0.72);  /* 玻璃拟态 */

  --fg-primary:    #09090b;     /* 主文字 */
  --fg-secondary:  #52525b;     /* 次文字 (描述) */
  --fg-tertiary:   #a1a1aa;     /* 三级 (placeholder) */

  --border-subtle:  #e4e4e7;
  --border-default: #d4d4d8;
  --border-strong:  #a1a1aa;

  /* 语义 */
  --semantic-success: #10b981;  /* COMMIT/绿区 */
  --semantic-warning: #f59e0b;  /* 黄区/SLA 即将逾期 */
  --semantic-danger:  #ef4444;  /* 红区/否决/已逾期 */
  --semantic-info:    #3b82f6;  /* 中性提示 */

  /* Persona 进化 (从 🥚 到 🐉 的渐变) */
  --persona-newborn:    #fef3c7;
  --persona-apprentice: #c7d2fe;
  --persona-assistant:  #a5f3fc;
  --persona-deputy:     #fde68a;  /* 黄区警示 */
  --persona-partner:    #fbcfe8;  /* 红区警示 */
}

[data-theme="dark"] {
  --bg-primary:    #09090b;
  --bg-secondary:  #18181b;
  --bg-tertiary:   #27272a;
  --bg-elevated:   rgba(24,24,27,0.72);
  --fg-primary:    #fafafa;
  --fg-secondary:  #a1a1aa;
  --fg-tertiary:   #71717a;
  --border-subtle: #27272a;
  --border-default:#3f3f46;
}
```

### 5.2 字体 (Apple SF Pro / Microsoft Segoe / 中文 PingFang)

```css
font-family:
  'SF Pro Text', -apple-system, BlinkMacSystemFont,
  'Segoe UI Variable', 'Segoe UI',
  'PingFang SC', 'Microsoft YaHei', 'Source Han Sans',
  Inter, system-ui, sans-serif;

font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11', 'ss01';
text-rendering: optimizeLegibility;
-webkit-font-smoothing: antialiased;
```

**字号阶梯** (Apple Type Scale):

| 用途 | px | tailwind | 行高 |
|---|---|---|---|
| Display (首页 hero) | 56 | `text-6xl` | 1.05 |
| Title 1 | 36 | `text-4xl` | 1.1 |
| Title 2 (页标题) | 28 | `text-3xl` | 1.2 |
| Title 3 (区标题) | 22 | `text-2xl` | 1.25 |
| Headline (卡片) | 18 | `text-lg font-semibold` | 1.3 |
| Body (正文) | 15 | `text-[15px]` | 1.5 |
| Caption (元信息) | 13 | `text-[13px]` | 1.4 |
| Footnote | 12 | `text-xs` | 1.3 |

### 5.3 间距 (8pt Grid System · Apple/Material 共识)

```
所有间距是 4 的倍数, 主要用 8 / 16 / 24 / 32 / 48 / 64
Tailwind: 1=4px / 2=8px / 4=16px / 6=24px / 8=32px / 12=48px / 16=64px
```

| 用途 | px | tailwind |
|---|---|---|
| 紧贴 (icon-text gap) | 4 | `gap-1` |
| 列表项间距 | 8 | `gap-2` |
| 卡片内边距 | 16 / 24 | `p-4` / `p-6` |
| 段落间距 | 24 / 32 | `space-y-6` / `space-y-8` |
| 区块间距 | 48 | `space-y-12` |
| 页边距 (max-width 1200) | 64 | `px-16` |

### 5.4 圆角 / 阴影 / 玻璃拟态

```css
/* 圆角阶梯 */
--radius-sm: 6px;   /* button / input */
--radius-md: 10px;  /* card */
--radius-lg: 16px;  /* modal / panel */
--radius-xl: 24px;  /* hero card */
--radius-full: 9999px; /* avatar / pill */

/* 阴影 (Apple-style soft shadow, 不要 Material 重影) */
--shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
--shadow-sm: 0 2px 8px rgba(0,0,0,0.06);
--shadow-md: 0 4px 16px rgba(0,0,0,0.08);
--shadow-lg: 0 12px 32px rgba(0,0,0,0.12);
--shadow-xl: 0 24px 64px rgba(0,0,0,0.18);

/* 玻璃拟态 (Apple Vibrancy, sidebar/topbar) */
.glass {
  background: var(--bg-elevated);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border-subtle);
}
```

### 5.5 动效 (Semantic Motion)

> 不为动而动. 每个动效服务一个**意义**.

```css
/* 5 档时长曲线 */
--duration-instant: 100ms;  /* 状态切换 */
--duration-fast:    200ms;  /* hover/focus */
--duration-base:    300ms;  /* 卡片/抽屉 */
--duration-slow:    500ms;  /* 页面切换 */
--duration-emphasis: 700ms; /* hero entrance */

/* Apple Bezier */
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);
--ease-emphasis: cubic-bezier(0.32, 0.72, 0, 1);  /* iOS spring */
```

**关键动效场景**:
- 议事室 17min 倒计时: 进度环 `transform: rotate()` 持续平滑
- COMMIT 成功: 卡片 scale 0.98 → 1, 200ms standard
- Persona 升阶: 头像 emoji morph 600ms emphasis + 粒子撒出
- 否决窗口剩余 1h: 卡片边框 amber 呼吸光晕 (2s loop)
- 日报 5min 倒计时: 顶部细线渐变 (绿 → 黄 → 红)

### 5.6 组件库

```
基础: shadcn/ui (Radix Primitives + Tailwind)
图标: Lucide (统一线条粗细 1.5)
图表: Tremor + Recharts (业务图) + d3 (Persona 雷达/9 宫格热力)
动效: Framer Motion (页面 transitions + 复杂手势)
表格: TanStack Table v8
富文本: Tiptap (协同) + Tiptap Pro 扩展
表格: Univer (Excel 风格协同)
日期: date-fns (轻量) + 中文 locale
通知: Sonner (toast)
键盘: cmdk (Cmd+K palette, 致敬 Linear)
```

### 5.7 可访问性 (WCAG 2.1 AA)

- 所有 interactive 必须有 `:focus-visible` 2px outline (--brand-500)
- 颜色对比度: 主文字 ≥ 7:1 (AAA), 次文字 ≥ 4.5:1 (AA)
- 所有图标必须有 `aria-label`
- Cmd+K 全局命令面板 + 完整键盘导航
- `prefers-reduced-motion` 自动关动效
- `prefers-color-scheme` 自动切深色

### 5.8 反例 (我们不做)

- ❌ 渐变满天飞 (除 Persona 进化和 hero)
- ❌ 重投影 / Material 浮动按钮 (太安卓)
- ❌ 大量插画 / 卡通 (太消费)
- ❌ 新拟态 (Neumorphism, 已过时)
- ❌ 全屏黑底 + 霓虹 (太 Web3)
- ❌ 无意义动画 (旋转 loading 圈 → 改用 skeleton)

### 5.9 参考标杆

| 标杆 | 我们学什么 |
|---|---|
| **Linear** | 命令面板 / 键盘第一 / 极简卡片 / 通知设计 |
| **Notion** | 信息密度 / 内联编辑 / 嵌入式块 |
| **Vercel** | Geist 字体节奏 / 黑白对比 / 微妙动效 |
| **Apple Music** | 玻璃拟态 sidebar / 大标题留白 / 卡片网格 |
| **Microsoft Loop** | 协同状态指示 / 实时光标 / 头像群 |
| **Stripe Dashboard** | 数据可视化 / 表格设计 / 财务级精确 |
| **Raycast** | Cmd+K 体验 / 渐变图标 / Pro 感 |

---

## 6. 移动端适配 (V1 GA 不做, V1.5 上)

V1 GA 仅桌面端 + Tauri 桌面客户端. 移动端需求记到 ROADMAP V1.5:

- iOS / Android Capacitor (Next.js + Capacitor)
- 5min 日报 / 议事室否决窗口 / Persona 推送 优先适配
- IM / 议事室 5 步可读但不可发起 (鼓励员工坐下来认真做)

---

## 7. 实施 PR 计划 (Month 1 第 1 周)

```
PR-1   砍 9 个 Hermes 遗留页 → redirect('/')
PR-2   新建 5 大导航 sidebar 组件 (含权限过滤)
PR-3   首页骨架 4 段式 (空容器, 待 Intranet/Launchpad 填)
PR-4   /decision-card → /convergence redirect
PR-5   /admin/* 路由权限守门 (steward/admin/champion)

测试: e2e-v1.ps1 全过 (导航变化不影响 API)
合并标准: 50/50 e2e 仍 PASS + 没新 a11y 错误
```

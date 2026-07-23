# Rheem VI/SI 权威标准（单一事实源）

> **此文件是 Rheem 品牌 VI/SI 的单一权威标准。**
> 所有其他 VI 参考文件（见下方"废弃文件"列表）均已废弃，仅保留以供参考。
> 代码令牌事实源：`public/css/rheem-official-tokens.css`（勿直接修改值）。
> 平台令牌系统：`public/css/rhautt-comfort-tokens.css`（`--rc-*` 体系，消费 rheem primitive）。

---

## 1. 品牌溯源与定位

Rheem 是瑞美集团设备品牌，瑞合瑞德暖通科技集团中国独家授权运营。

**品牌个性：** 可靠（Reliable）· 高效（Efficient）· 可持续（Sustainable）· 专业支持（Expert-backed）

**核心主题：**
- 稳供：设备年复一年可靠运行，峰值热水稳定保障
- 高效：节能、降低电费、退税/补贴、低碳足迹
- 可持续：低 GWP 制冷剂、Energy Star、热泵热水零现场排放
- 安心：泄漏检测、质保、安心运行
- 专家：本地专家、应用咨询、培训、商用支持
- 通达：本地备货、次日交付、24 小时紧急取货

**官方站参考（重大决策前须实时刷新）：**
- `https://www.rheem.com/products/water`
- `https://www.rheem.com/products/residential/`
- `https://www.rheem.com/products/commercial/`

---

## 2. 颜色令牌（rheem.com 2026-06-21 实测校验）

### Primitive（勿修改，定义于 `rheem-official-tokens.css`）

| 变量 | 值 | 验证来源 |
|---|---|---|
| `--rheem-color-red` | `#E4002B` | rheem.com common.css ×143 |
| `--rheem-color-red-deep` | `#C20025` | rmc-btn-primary:hover rgb(193.8,0,36.55) |
| `--rheem-color-red-active` | `#B60022` | rmc-btn-primary:active |
| `--rheem-color-blue` | `#1B365D` | --rmc-primary ×85 |
| `--rheem-color-gray-10` | `#596067` | body text ×119 |
| `--rheem-color-gray-8` | `#63666A` | muted text |
| `--rheem-color-teal` | `#4F868E` | ×120 |
| `--rheem-color-green` | `#789D4A` | ×110 |
| `--rheem-color-orange` | `#EF6820` | ×110 |
| `--rheem-color-surface` | `#F2F5F7` | ×74 |
| `--rheem-color-border` | `#D6DADD` | --rmc-primary-border ×97 |
| `--rheem-color-ink` | `#101828` | most-used dark ×223 |

### 语义（平台层，定义于 `rhautt-comfort-tokens.css`，`--rc-*` 命名空间）

- `--rc-red-rheem` → `var(--rheem-color-red)` `#E4002B`
- `--rc-brand-primary`（`[data-brand="rheem"]`） → `var(--rc-red-rheem)`
- `--rc-brand-primary-hover` → `var(--rheem-color-red-deep)` `#C20025`
- `--rc-bg-subtle` → `#F2F5F7`；`--rc-bg-surface` → `#FFFFFF`
- `--rc-text-primary`、`--rc-text-secondary`、`--rc-border-subtle` 见 comfort-tokens

### ⚠️ 废弃值（不得使用）

| 值 | 来源 | 替换为 |
|---|---|---|
| `#A00F28` | `rheem-vi.md`（未实测） | `var(--rheem-color-red-deep)` `#C20025` |
| `#A50016` | `packages/tokens/rheem-cn.css` `--brand-primary-dk` | `var(--rheem-color-red-deep)` |
| `#C41230` | 旧 Rheem red | `var(--rheem-color-red)` `#E4002B` |

---

## 3. 字体

```css
font-family: "Roboto", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

规则：
- Dashboard H1：22–28px
- Panel 标题：15–18px
- 表格/正文：12–14px
- 指标数字：22–32px
- 字间距：0（仅大写小标签允许适度 letter-spacing）
- 不随视口缩放字号

---

## 4. 形状与阴影

| 令牌 | 值 | 用途 |
|---|---|---|
| `--rheem-radius-sm` | `4px` | 小 UI 元素 |
| `--rheem-radius-md` | `6px` | 输入框、通用组件 |
| `--rheem-radius-lg` | `8px` | 按钮、卡片 |
| `--rheem-shadow-panel` | `0 8px 24px rgba(16,24,40,.08)` | 浮层/面板 |

---

## 5. Logo 规则

- 使用官方 Rheem 红色圆形徽章（白色文字）。
- 临时原型可用：`https://upload.wikimedia.org/wikipedia/commons/0/0b/Rheem_logo.svg`
- **生产门控：** `public/images/rheem-logo.svg` 未经品牌方授权包替换前，禁止用于生产。
- 禁止：拉伸、裁切、变色、旋转、叠加中文、添加 "Since 1925"、置于嘈杂背景。
- 品牌主导页面：logo 或 Rheem wordmark 须在首屏可见。
- 运营工作台：允许紧凑 logo 位置，但不得使品牌识别消失。

---

## 6. 颜色语义角色

| 颜色 | 用途 | 中文调性 | 好用词 | 避免 |
|---|---|---|---|---|
| 红 `#E4002B` | 品牌标识、主 CTA、紧急商用路径、激活态 | 果断、可靠、推进 | 稳供、确认、联系专家 | 激情、爆款、网红红 |
| 蓝 `#1B365D` | 工程规格、文档、专业导航 | 工程、标准、权威 | 规格、蓝本、定规 | 炫酷、科技蓝 |
| 灰 `#63666A` | 工作面、表格、二级文本 | 中性、承压 | 参数、工况、状态 | 高级灰 |
| 青 `#4F868E` | 水/系统连续性、支持生态 | 清洁、流动 | 水路、恒供、系统流 | 清新、治愈 |
| 绿 `#789D4A` | 效率与可持续 | 节能、低碳 | 低碳、善度、减排 | 绿色生活方式泛化 |
| 橙 `#EF6820` | 退税、警告、待确认 | 提醒、机会 | 补贴、提示、窗口期 | 焦虑、抢购 |

---

## 7. 产品分类边界（Rheem vs Ruud）

**Rheem（水侧/水暖）：**
- 燃气/电/太阳能/热泵热水器、壁挂炉、地暖、暖气片、家用冷热软水系统、水处理净化、商用热水、泳池加热

**Ruud（气侧/空调）：**
- 中央空调、VRF、分体机、空气源热泵（制冷/制热）、通风新风、空气净化/加湿/除湿、商用空调

**五恒舒适系统：**
- 水辐射/毛细管为主 → Rheem 主导品牌
- 空调+通风为主 → Ruud 主导品牌
- 混合方案 → 明确分类后再应用视觉标识

---

## 8. 组件规范（摘要）

**按钮：** Primary = Rheem 红填充 + 白文字 + ≤8px 圆角；hover → `#C20025`；focus ring = `0 0 0 4px rgba(232,38,75,.24)`

**导航：** 专业工作台用侧边导航；营销/产品页用顶部导航；激活态可用 Rheem 红填充或左侧红色标记

**卡片/面板：** 圆角 ≤8px；避免嵌套卡片；主面板可用红色顶边/左边线（少用）

**表格：** 设备/规格/报价/文档/审计必用表格；需状态徽章、排序过滤、空/加载态

**徽章：** 品牌域（水暖/商用）、状态（待审/通过/警告/异常）、产品类别、角色

**空/加载/错误态：** 必须说明缺失内容和下一步操作；禁止可爱插图（消费者居家页例外）

---

## 9. 布局模式

**专业工作台**（设计师/工程师/安装/销售）：侧边导航 + 顶部项目状态栏 + 指标条 + 主分析面板 + 明细表格 + 右侧审计/支持面板

**商用方案页**：角色选择器 → 应用咨询 CTA → 产品/规格查找 → 物流/库存 → 培训/支持 → 案例

**居家产品页**：品类选择器 → 价值主张块 → 节能/退税/融资 → 查找专业人员 → 质保/注册 → 教育卡

---

## 10. 响应式断点

- Mobile：360–767px
- Tablet：768–1199px
- Desktop：≥1200px

规则：无横向 body 滚动（表格内部容器除外）；导航可折叠；指标网格降列；表格容器内滚动；按钮标签保持可读

---

## 11. 中文本地化准则（摘要）

调性锚点：稳 · 准 · 省 · 善 · 通

**短语映射（常用）：**
- "Tested. Trusted. Tough." → 经久验证，值得信赖，坚韧耐用。
- "Peace of Mind Performance" → 安心运行，性能有据。
- "One partner. Infinite solutions." → 一个伙伴，多元方案。

**UI 文案规则：**
- 标签首选 4–8 字锚点：稳供、定规、节能、善度、文档、校核、交付、质保
- 诗意锚点须配具体副标题（如 `稳供` + `峰值热水需求覆盖 96%`）
- 商用页强调：运行时间、应用适配、规格、交付、紧急支持
- 居家页调性：舒适、节能、质保、专业安装、教育

**禁用：** "智慧生态赋能"、"极致科技美学"、"重塑未来"、"瑞美红"装饰标签、Logo 内叠加中文

---

## 12. 视觉审计评分标准

每个界面 0–5 分评分维度：品牌准确性 · 信息层级 · 组件一致性 · 响应式 · 无障碍 · HVAC 专业可信度 · 反通用性

**任何维度 <4 分须在审批前修改。**

---

## 废弃文件列表（已整合入本文档）

以下文件内容已全部整合，头部已加废弃声明。阅读时以本文件为准。

| 文件 | 原用途 | 废弃原因 |
|---|---|---|
| `skills/rheem-design-director/references/rheem-official-vi.md` | Rheem 官方 VI | 内容已整合 |
| `skills/rheem-design-director/references/rheem-design-system-standard.md` | 设计系统标准 | 内容已整合；深红值 `#A00F28` 有误 |
| `skills/rheem-design-director/references/vi-brand-system-skill.md` | VI 品牌体系技能 | 内容已整合 |
| `skills/rheem-vi-ui-designer/references/rheem-vi.md` | 设计执行版规范 | 内容已整合；深红值 `#A00F28` 有误 |
| `skills/rheem-design-director/references/rheem-chinese-localization.md` | 中文本地化 | 内容已整合 |

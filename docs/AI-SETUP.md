# Tandem · 开发者与演示 AI 运行验证手册 (AI Setup & Verification Guide)

> **「让产品用最真实的数据跑起来，拒绝任何 PPT-SaaS 式的欺骗。」**

---

## 一、 AI 模块部署与 Provider 注册

Tandem 的多模型路由器 (TAF Router) 是企业大模型调用的引擎。在开发/演示环境中，如果你看到页面徽章显示 **「降级模式（未调用 LLM）」**，说明后台没有注册可用的 Provider。

### 1. 配置环境变量 (`.env.local`)

根据你使用的 Provider，在项目根目录下创建或编辑 `.env.local` 文件，填入你的 API Key：

```bash
# DeepSeek API (高性价比推理/降级兜底)
DEEPSEEK_API_KEY=sk-xxxx...

# Kimi / Moonshot API (长文本复盘)
KIMI_API_KEY=sk-xxxx...

# 字节跳动火山引擎 (高频低成本)
DOUBAO_API_KEY=sk-xxxx...

# Claude / Anthropic (议事决策/多步 Agent)
ANTHROPIC_API_KEY=sk-xxxx...

# 通用 OpenAI (如用转发中转)
OPENAI_API_KEY=sk-xxxx...
```

### 2. Provider 的自动注册机制

在 `lib/boot.ts` 的 `boot()` 流程中，系统会自动读取环境变量。若发现对应的 API Key 存在，就会自动通过 `router.registerProvider(...)` 将其注册进 TAF Router。

---

## 二、 核心 AI 场景的真伪自检

### 1. 5 分钟智能对齐日报 (`/report`)

- **入口**：左侧 Rails 菜单 -> 「拿捏」 -> 「5min 智能日报」。
- **运行特征**：
  1. 锚定一个 KR（必须）。
  2. 在下方文本框输入任意碎碎念，点击「AI 智能提炼 & 对齐」。
  3. **流式打字机**：如果 LLM 可用，右侧面板会立即浮现 **`AI 思考中（流式输出）`** 窗口，字符边输入边闪烁流式展示。
  4. **对账卡片渲染**：LLM 输出完毕后，自动换成格式化卡片。顶部会显示绿色徽章 **`LLM · {model_name}`**；如果未配大模型，则会降级并显示黄色 **`降级模式（未调用 LLM）`**。
  5. **Optimistic 推流**：点击「确认智能推流」，全局 OKR store 进度条会**立刻**更新，并向后台落库。
- **自检 API**：POST `/api/ai/extract-daily-report`

### 2. 本周回顾（AI 周报 `/report/weekly`）

- **入口**：左侧 Rails 菜单 -> 「拿捏」 -> 「本周回顾」。
- **运行特征**：
  1. 页面加载时，系统会瞬间向 `/api/ai/weekly-recap` 发送 POST 异步请求。
  2. **硬统计瞬间就位**：后台计算出本周 check-in、SLA 进度增量后，立刻通过 `stats` 事件返回。4 张顶部数据卡瞬间显示骨架灰色刷白，随后数据上墙（**不等大模型**）。
  3. **LLM 异步流式加载**：汇总区会展示 `正在等待 LLM 首个 token` -> `流式生成中`，随后 summary 等 JSON 字段流式打字渲染。
- **自检 API**：POST `/api/ai/weekly-recap`

### 3. Command Palette AI 智能意图路由 (`⌘K`)

- **入口**：全局任何页面按 `⌘K` 或 `Ctrl+K`。
- **运行特征**：
  1. 输入 ≥4 个字的自然语言（如 *“我想看看绩效”* 或 *“团队本周阻碍”*）。
  2. 250ms 防抖过后，系统先跑关键词规则；若无强命中，自动调用 `/api/agent/intent` 走 LLM 兜底。
  3. **AI 网关解析**：LLM 匹配 `ROUTE_CATALOG` 路由，并直接以 🤖 前缀和匹配百分比（如 `🤖 看我的绩效目标 · 85%`）将建议卡塞入 **`智能建议`** 分组中。
- **自检 API**：POST `/api/agent/intent`

---

## 三、 命令行一键预热与演示准备

由于 Next.js 在开发模式下使用 on-demand compilation（按需编译），首次点开新页面或接口会遭遇 3-5 秒编译卡顿。
我们提供了一套**「预热脚本」**，在开演示或给客户 show-and-tell 之前，在本地运行此命令，将所有主页面全部编译预热：

```bash
# 推荐 (跨平台，Node 18+ 自带 fetch):
npm run pre-warm

# 或 Windows PowerShell 备选 (功能等价):
powershell -File ./scripts/pre-warm.ps1
```

这会让你的本地演示体验流畅 10 倍！

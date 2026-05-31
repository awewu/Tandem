/**
 * lib/store/chat.ts · Chat / Agent / Task (region 1)
 *
 * 从 lib/store.ts 机械拆分 (B8, 2026-05-31). 行为/persist key 不变.
 * persist keys: 铁山-chat-store / 铁山-agent-store / 铁山-task-store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// #region 1 · Chat / Agent / Task ────────────────────────────────────
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  /** 用户对该回答的反馈：用于沉淀 best practice 信号 */
  rating?: 'up' | 'down';
  /** 是否已收藏到 Knowledge */
  starred?: boolean;
  /** 这条消息由哪个 Agent 回答的（用于链式协作链路上显示标签） */
  agentId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  agentId?: string;
}

/**
 * 每个 Agent 可以独立配置 LLM 代理（OpenAI 兼容协议）
 *
 * - type='hermes'           走默认 Hermes CLI（/api/stream）
 * - type='openai-compatible' 个人模式：用户自填 key，走 /api/llm-stream 转发
 * - type='team'             Team 模式：key 在服务端，用公司 token 池，用户零配置
 *                           teamProvider = TAF router 中注册的 provider 名
 */
export interface LLMProvider {
  type: 'hermes' | 'openai-compatible' | 'team';
  /** openai-compatible 模式: 兼容端点根路径 */
  baseURL?: string;
  /** openai-compatible 模式: 个人 API Key（仅存 localStorage） */
  apiKey?: string;
  /** 自定义头部 */
  headers?: Record<string, string>;
  /** 引用的预设 key（仅展示用） */
  presetKey?: string;
  /** team 模式: 对应 TAF router 注册的 provider 名（如 'claude-opus-4-5'） */
  teamProvider?: string;
}

export interface ProviderPreset {
  key: string;
  label: string;
  type: LLMProvider['type'];
  /** team 模式专用: TAF router 中的 provider 名 */
  teamProvider?: string;
  baseURL?: string;
  defaultModel?: string;
  /** 用于 UI 卡片徽章显示 */
  badge?: string;
  /** 'personal' | 'team' — 用于分组展示 */
  group?: 'personal' | 'team';
  /** Team 模式下的说明文案 */
  description?: string;
}

/**
 * PROVIDER_PRESETS
 *
 * Team 组：key 由服务端提供，员工无需填 API key
 * Personal 组：用户自填 key，完全本地控制
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  // ── Team 组（公司 Token 池）─────────────────────────────────────────
  {
    key: 'team-claude-opus',
    label: 'Claude Opus 4.5',
    type: 'team',
    teamProvider: 'claude-opus-4-5',
    defaultModel: 'claude-opus-4-5',
    badge: 'Team · Opus',
    group: 'team',
    description: '企业旗舰 · 200K 上下文 · 最强推理',
  },
  {
    key: 'team-deepseek',
    label: 'DeepSeek V3',
    type: 'team',
    teamProvider: 'deepseek-v3',
    defaultModel: 'deepseek-chat',
    badge: 'Team · DeepSeek',
    group: 'team',
    description: '高性价比推理 · 企业兜底',
  },
  {
    key: 'team-doubao',
    label: 'Doubao Pro 256K',
    type: 'team',
    teamProvider: 'doubao-pro',
    defaultModel: 'doubao-1-5-pro-256k',
    badge: 'Team · Doubao',
    group: 'team',
    description: '超长文档 / 高频任务',
  },
  {
    key: 'team-kimi',
    label: 'Kimi Moonshot',
    type: 'team',
    teamProvider: 'kimi-k2',
    defaultModel: 'moonshot-v1-128k',
    badge: 'Team · Kimi',
    group: 'team',
    description: '128K 长上下文',
  },

  // ── Personal 组（用户自填 key）───────────────────────────────────────
  {
    key: 'hermes',
    label: 'Hermes CLI (默认)',
    type: 'hermes',
    badge: 'Hermes',
    group: 'personal',
    description: '本地 Hermes / Ollama',
  },
  {
    key: 'openai',
    label: 'OpenAI',
    type: 'openai-compatible',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    badge: 'OpenAI',
    group: 'personal',
    description: 'GPT-4o / o1 系列',
  },
  {
    key: 'anthropic',
    label: 'Anthropic',
    type: 'openai-compatible',
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-opus-4-5',
    badge: 'Claude',
    group: 'personal',
    description: 'Claude Opus / Sonnet',
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    type: 'openai-compatible',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    badge: 'DeepSeek',
    group: 'personal',
  },
  {
    key: 'moonshot',
    label: 'Moonshot 月之暗面',
    type: 'openai-compatible',
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-32k',
    badge: 'Kimi',
    group: 'personal',
  },
  {
    key: 'qwen',
    label: 'Qwen 通义千问',
    type: 'openai-compatible',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-max',
    badge: 'Qwen',
    group: 'personal',
  },
  {
    key: 'zhipu',
    label: 'Zhipu 智谱 GLM',
    type: 'openai-compatible',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    badge: 'GLM',
    group: 'personal',
  },
  {
    key: 'ollama',
    label: 'Ollama 本地',
    type: 'openai-compatible',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    badge: 'Ollama',
    group: 'personal',
  },
  {
    key: 'custom',
    label: '自定义代理',
    type: 'openai-compatible',
    baseURL: '',
    defaultModel: '',
    badge: '自定义',
    group: 'personal',
    description: '任意 OpenAI 兼容端点',
  },
];

export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  skills: string[];
  systemPrompt: string;
  temperature?: number;
  /** 专属 LLM 代理配置；不设置则走默认 Hermes CLI */
  provider?: LLMProvider;
  /**
   * 轻量化 Workflow：当前 Agent 完成后，自动把输出作为输入交给下一个 Agent。
   * 数组顺序 = 调用顺序。空数组或不设置 = 不接力。
   */
  chainTo?: string[];
}

export interface Task {
  id: string;
  name: string;
  cron: string;
  agentId: string;
  prompt: string;
  enabled: boolean;
  status?: 'idle' | 'running' | 'success' | 'failed';
  lastRunAt?: string;
}

interface ChatStore {
  conversations: Conversation[];
  activeId: string | null;
  isStreaming: boolean;
  addConversation: (c: Conversation) => void;
  setActive: (id: string | null) => void;
  addMessage: (convId: string, msg: Message) => void;
  updateMessage: (convId: string, msgId: string, patch: Partial<Message> | ((msg: Message) => Partial<Message>)) => void;
  deleteConversation: (id: string) => void;
  setStreaming: (v: boolean) => void;
  updateConversation: (id: string, patch: Partial<Conversation>) => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      conversations: [],
      activeId: null,
      isStreaming: false,
      addConversation: (c) =>
        set((state) => ({
          conversations: [c, ...state.conversations],
          activeId: c.id,
        })),
      setActive: (id) => set({ activeId: id }),
      addMessage: (convId, msg) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() }
              : c
          ),
        })),
      updateMessage: (convId, msgId, patch) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) => {
                    if (m.id !== msgId) return m;
                    const resolved = typeof patch === 'function' ? patch(m) : patch;
                    return { ...m, ...resolved };
                  }),
                  updatedAt: Date.now(),
                }
              : c
          ),
        })),
      deleteConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeId: state.activeId === id ? null : state.activeId,
        })),
      setStreaming: (v) => set({ isStreaming: v }),
      updateConversation: (id, patch) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c
          ),
        })),
    }),
    { name: '铁山-chat-store' }
  )
);

interface AgentStore {
  agents: AgentConfig[];
  addAgent: (a: AgentConfig) => void;
  updateAgent: (id: string, patch: Partial<AgentConfig>) => void;
  deleteAgent: (id: string) => void;
}

/** 默认 provider: DeepSeek（服务端已配 DEEPSEEK_API_KEY，走 /api/llm-stream 代理） */
const DEEPSEEK_PROVIDER: LLMProvider = {
  type: 'openai-compatible',
  baseURL: 'https://api.deepseek.com/v1',
  // API key 由服务端 /api/llm-stream-proxy 注入, 前端留空
  apiKey: '',
};

export const PRESET_AGENTS: AgentConfig[] = [
  {
    id: 'agent-designer',
    name: '🎨 设计Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['design', 'ui-ux', 'visual'],
    systemPrompt: `你是一位资深UI/UX设计师。擅长：
1. 用户界面设计 - 现代、简洁、易用
2. 用户体验优化 - 流程梳理、交互设计
3. 视觉规范制定 - 配色、字体、组件库
4. 设计评审 - 发现问题并提供改进建议
5. 原型设计 - 从低保真到高保真
输出时请提供具体的设计建议和可执行的方案。`,
    temperature: 0.7,
  },
  {
    id: 'agent-pm',
    name: '📦 产品经理Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['product', 'prd', 'analysis'],
    systemPrompt: `你是一位经验丰富的产品经理。擅长：
1. 需求分析 - 用户调研、竞品分析、痛点挖掘
2. PRD撰写 - 清晰的功能描述、验收标准
3. 优先级排序 - RICE模型、价值评估
4. 产品规划 - 路线图制定、版本迭代
5. 数据驱动 - 指标定义、数据分析
请用结构化的方式输出，包含背景、目标、方案、验收标准。`,
    temperature: 0.6,
  },
  {
    id: 'agent-strategy',
    name: '🎯 战略Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['strategy', 'business', 'planning'],
    systemPrompt: `你是一位战略咨询专家。擅长：
1. 市场分析 - 行业趋势、竞争格局、机会识别
2. 商业模式设计 - 价值主张、盈利模型
3. 战略规划 - 愿景目标、战略路径、关键举措
4. 风险评估 - SWOT分析、风险应对
5. 组织对齐 - 战略解码、OKR制定
请提供高屋建瓴的洞察和可落地的执行方案。`,
    temperature: 0.5,
  },
  {
    id: 'agent-marketing',
    name: '📢 市场策划Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['marketing', 'content', 'growth'],
    systemPrompt: `你是一位资深市场策划专家。擅长：
1. 品牌策略 - 品牌定位、视觉识别、传播策略
2. 内容营销 - 文案撰写、内容规划、多渠道分发
3. 增长黑客 - 获客策略、转化优化、裂变设计
4. 活动策划 - 线上线下活动、事件营销
5. 社媒运营 - 账号矩阵、社群运营、KOL合作
请提供创意十足且可执行的市场方案。`,
    temperature: 0.8,
  },
  {
    id: 'agent-tech-lead',
    name: '💻 技术负责人Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['architecture', 'coding', 'review'],
    systemPrompt: `你是一位技术负责人/架构师。擅长：
1. 技术架构 - 系统架构设计、技术选型
2. 代码评审 - 代码质量、性能优化、安全审计
3. 方案设计 - 详细设计文档、接口设计
4. 技术规划 - 技术路线图、债务管理
5. 团队指导 - Best Practice、技术分享
请提供严谨的技术方案和清晰的代码示例。`,
    temperature: 0.4,
  },
  {
    id: 'agent-writer',
    name: '✍️ 文案写作Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['writing', 'editing', 'translation'],
    systemPrompt: `你是一位专业文案撰稿人。擅长：
1. 商业文案 - 品牌故事、产品描述、宣传文案
2. 技术文档 - 使用手册、API文档、白皮书
3. 内容润色 - 语言优化、逻辑梳理、风格调整
4. 多语言翻译 - 中英互译、本地化适配
5. 创意写作 - 故事脚本、创意概念
请根据目标受众调整语言风格，确保专业且易读。`,
    temperature: 0.7,
  },
  {
    id: 'agent-data-analyst',
    name: '📊 数据分析Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['analysis', 'sql', 'visualization'],
    systemPrompt: `你是一位数据分析师。擅长：
1. 数据探索 - 数据清洗、统计分析、模式识别
2. SQL查询 - 复杂查询优化、ETL流程
3. 可视化 - 图表设计、Dashboard构建
4. 业务洞察 - 指标解读、趋势预测、建议输出
5. A/B测试 - 实验设计、显著性检验
请用数据说话，提供清晰的图表描述和洞察结论。`,
    temperature: 0.5,
  },
  {
    id: 'agent-hr',
    name: '👥 HR Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['hr', 'recruiting', 'training'],
    systemPrompt: `你是一位资深HR专家。擅长：
1. 招聘面试 - 岗位分析、面试题库、评估标准
2. 绩效管理 - 考核方案、反馈沟通、改进计划
3. 培训发展 - 学习路径、能力模型、职业规划
4. 员工关系 - 文化建设、冲突调解、满意度提升
5. HR政策 - 制度设计、合规审查
请提供人性化且专业的HR解决方案。`,
    temperature: 0.6,
  },

  // ====== 恒热 / 热水专家业务专属 Agent ======
  {
    id: 'agent-hh-promo',
    name: '🚿 恒热产品推广 Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['marketing', 'content', 'ecommerce'],
    systemPrompt: `你是恒热品牌（即热式电热水器）的产品推广专家，深度理解中国家用热水器市场。擅长：
1. 卖点萃取 - 即热出水、恒温技术、5重安防、节能省电、零冷水、不锈钢内胆等核心利益点的提炼
2. 渠道适配 - 京东/天猫详情页、抖音直播话术、小红书种草、私域社群、线下导购卡
3. 受众分层 - 一线刚需用户（出租屋/小户型）、二线改善用户（精装/老房改造）、三线品质用户（别墅/复式）
4. 卖点 vs 痛点对照 - 把功能参数翻译成"洗澡不忽冷忽热""不用等热水""装修不用预留水箱位"等用户语言
5. 合规底线 - 避开"绝对""第一""最强"等违反广告法的表述，用"实测""权威认证""某协会数据"替代
输出请包含：核心卖点 / 文案矩阵（标题/详情/短视频钩子）/ 渠道分发建议 / 落地素材清单。`,
    temperature: 0.75,
  },
  {
    id: 'agent-hh-geo',
    name: '🔍 恒热品牌 GEO Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['seo', 'geo', 'content'],
    systemPrompt: `你是品牌 GEO（Generative Engine Optimization，面向 AI 搜索/对话引擎的内容优化）专家，专为恒热品牌服务。擅长：
1. 目标问句梳理 - 用户在 ChatGPT/豆包/Kimi/百度AI/腾讯元宝里会问什么"哪个品牌的即热式电热水器值得买""恒热和XX对比""出租屋装哪种热水器"
2. AI 答案语料结构 - 用结构化（FAQ / Compare Table / 数据 / 引用）让 LLM 在生成时优先采纳
3. 第三方信号建设 - 知乎/小红书/什么值得买/B站/汽车之家家居频道的回答与真实评测
4. 实体化 - 让"恒热"在 Wikipedia/百度百科/品牌词条/行业白皮书里成为可被检索的明确实体
5. 监测复盘 - 周度跑一次 prompt 矩阵看 AI 回答里恒热的"露出位"和"语义画像"
输出请包含：问句矩阵（≥10 条）/ 内容标准 SCQA 框架 / 投放渠道清单 / KPI 与监测方式 / 30 天落地节奏。`,
    temperature: 0.6,
  },
  {
    id: 'agent-hh-mps',
    name: '🏭 恒热生产计划 Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['manufacturing', 'mps', 'planning'],
    systemPrompt: `你是恒热工厂的主生产计划（MPS）排程专家，理解即热式电热水器制造工艺与上游供应链。擅长：
1. 需求预测 - 渠道分销补单 + 大促囤货 + 工程项目 + 出口订单四源汇总；考虑季节性（冬季需求峰值 11-2 月）
2. 产能盘点 - SMT 线 / 注塑 / 钣金 / 总装 / 老化测试每段瓶颈识别；班次/工时/良率换算成日产能
3. 物料齐套 - 关键件（加热膜、温控器、IGBT、不锈钢内胆、控制板）BOM 拉齐；ABC 分类管理
4. 排程方法 - APS 思路：粗排（周）+ 细排（日/班）；关键约束：换型时间、烤漆窗口、老化测试 24h 占用
5. 风险预案 - 缺料替代件清单、加班/外协方案、订单优先级（A: 大促/工程, B: 渠道, C: 库存）
输出请用：需求-产能差异表 / 物料齐套率 / 周排产计划（每日机型 + 数量 + 工序节拍）/ 风险与对策。`,
    temperature: 0.4,
  },
  {
    id: 'agent-hh-video',
    name: '🎬 恒热视频脚本 Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['video', 'script', 'douyin'],
    systemPrompt: `你是恒热品牌的短视频脚本撰稿人，专精抖音/视频号/小红书 30s-90s 卖货/种草视频。擅长：
1. 钩子前 3 秒 - 痛点反差/冲突镜头/数字标签（"洗到一半没热水的崩溃""90 元一年的电费"）
2. 分镜脚本 - 镜头号/景别/时长/画面/字幕/旁白/BGM 五栏脚本
3. 卖货节奏 - "痛点 → 普通方案缺陷 → 恒热的解 → 数据/认证 → 价格利益点 → CTA"六段式
4. 平台差异 - 抖音强冲突强转化；小红书强生活方式 + 多图 carousel；视频号强品牌信任
5. 投流适配 - 给出 3 个标题候选 + 5 个 #话题 + 封面文案，方便巨量引擎/聚光投放
输出请直接给完整可拍摄分镜表 + 3 套封面文案 + 投放参数建议，避免空泛创意描述。`,
    temperature: 0.85,
  },
  {
    id: 'agent-hh-gtm',
    name: '🚀 恒热 GTM Agent',
    model: 'deepseek-chat',
    provider: DEEPSEEK_PROVIDER,
    skills: ['gtm', 'strategy', 'channel'],
    systemPrompt: `你是恒热品牌的市场进入（GTM）策略专家。擅长：
1. 市场切片 - 按城市等级/装修阶段/户型/水压/家庭结构切出可打的细分市场
2. 渠道矩阵 - 京东自营/天猫旗舰/抖音电商/快手/线下 KA（红星美凯龙/居然之家）/家装公司渠道/工程招标/出口
3. 价格架构 - 引流款（小升数）/ 主推款（中端）/ 旗舰款（智能/恒温），对应渠道分价格盘
4. 节奏排布 - 6 周 GTM Sprint：W1 调研 → W2 定位/卖点 → W3 内容生产 → W4 KOL/达人 → W5 大促放量 → W6 复盘
5. 关键节点 - 与 618/双 11/品牌日/节气营销（霜降"洗热水澡"心智占位）联动
输出请用：市场细分 / 渠道分工 / 价格盘 / 6 周 Sprint 时间表 / 关键 KPI 与里程碑。`,
    temperature: 0.55,
  },
];

export const useAgentStore = create<AgentStore>()(
  persist(
    (set) => ({
      agents: [...PRESET_AGENTS],
      addAgent: (a) => set((state) => ({ agents: [...state.agents, a] })),
      updateAgent: (id, patch) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      deleteAgent: (id) =>
        set((state) => ({ agents: state.agents.filter((a) => a.id !== id) })),
    }),
    {
      name: '铁山-agent-store',
      // v3: 预设 Agent 模型 → kimi-2.6（Hermes Kimi 板块）
      // v4: 追加 5 个恒热业务专属 Agent
      // v5: 修复 kimi-2.6 为 deepseek-chat + 绑定 DEEPSEEK_PROVIDER
      version: 5,
      migrate: (persistedState: unknown, fromVersion: number) => {
        const state = persistedState as { agents?: AgentConfig[] } | null;
        if (!state || !Array.isArray(state.agents)) return state ?? { agents: [...PRESET_AGENTS] };
        if (fromVersion < 3) {
          const presetIds = new Set(PRESET_AGENTS.map((p) => p.id));
          state.agents = state.agents.map((a) =>
            presetIds.has(a.id) ? { ...a, model: 'kimi-2.6' } : a
          );
        }
        if (fromVersion < 4) {
          const existingIds = new Set(state.agents.map((a) => a.id));
          const missing = PRESET_AGENTS.filter((p) => !existingIds.has(p.id));
          state.agents = [...state.agents, ...missing];
        }
        if (fromVersion < 5) {
          // 把所有 kimi-2.6 替换成 deepseek-chat + 注入 provider
          const presetMap = new Map(PRESET_AGENTS.map((p) => [p.id, p]));
          state.agents = state.agents.map((a) => {
            if (a.model === 'kimi-2.6') {
              const preset = presetMap.get(a.id);
              return preset ? { ...a, model: preset.model, provider: preset.provider } : { ...a, model: 'deepseek-chat', provider: DEEPSEEK_PROVIDER };
            }
            return a;
          });
        }
        return state;
      },
    }
  )
);

interface TaskStore {
  tasks: Task[];
  addTask: (t: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set) => ({
      tasks: [],
      addTask: (t) => set((state) => ({ tasks: [...state.tasks, t] })),
      updateTask: (id, patch) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      deleteTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
    }),
    { name: '铁山-task-store' }
  )
);
// #endregion

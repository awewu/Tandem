import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
 * - type='hermes'：走默认 Hermes CLI（/api/stream）
 * - type='openai-compatible'：走代理（/api/llm-stream），可指向任意兼容端点
 *   （OpenAI / DeepSeek / Moonshot / Qwen / Zhipu / Ollama / 自建中转 等）
 */
export interface LLMProvider {
  type: 'hermes' | 'openai-compatible';
  /** 兼容端点根路径，如 https://api.openai.com/v1 */
  baseURL?: string;
  /** API Key（注意：persist 在浏览器 localStorage，仅本地使用） */
  apiKey?: string;
  /** 自定义头部，例如 { 'X-Org-Id': '...' } */
  headers?: Record<string, string>;
  /** 引用的预设 key（仅展示用） */
  presetKey?: string;
}

export interface ProviderPreset {
  key: string;
  label: string;
  type: LLMProvider['type'];
  baseURL?: string;
  defaultModel?: string;
  /** 用于 UI 卡片徽章显示 */
  badge?: string;
}

/** 一键切换的常见 OpenAI 兼容供应商 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  { key: 'hermes',    label: 'Hermes CLI (默认)',    type: 'hermes',                                                                          badge: 'Hermes' },
  { key: 'openai',    label: 'OpenAI',                 type: 'openai-compatible', baseURL: 'https://api.openai.com/v1',                          defaultModel: 'gpt-4o',                  badge: 'OpenAI' },
  { key: 'anthropic', label: 'Anthropic 代理',         type: 'openai-compatible', baseURL: 'https://api.anthropic.com/v1',                       defaultModel: 'claude-3-5-sonnet-20241022', badge: 'Claude' },
  { key: 'deepseek',  label: 'DeepSeek',               type: 'openai-compatible', baseURL: 'https://api.deepseek.com/v1',                        defaultModel: 'deepseek-chat',           badge: 'DeepSeek' },
  { key: 'moonshot',  label: 'Moonshot 月之暗面',      type: 'openai-compatible', baseURL: 'https://api.moonshot.cn/v1',                         defaultModel: 'moonshot-v1-32k',         badge: 'Kimi' },
  { key: 'qwen',      label: 'Qwen 通义千问',          type: 'openai-compatible', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',  defaultModel: 'qwen-max',                badge: 'Qwen' },
  { key: 'zhipu',     label: 'Zhipu 智谱 GLM',         type: 'openai-compatible', baseURL: 'https://open.bigmodel.cn/api/paas/v4',               defaultModel: 'glm-4-plus',              badge: 'GLM' },
  { key: 'ollama',    label: 'Ollama 本地',            type: 'openai-compatible', baseURL: 'http://localhost:11434/v1',                          defaultModel: 'llama3.1',                badge: 'Ollama' },
  { key: 'custom',    label: '自定义代理',             type: 'openai-compatible', baseURL: '',                                                   defaultModel: '',                        badge: '自定义' },
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

// 预设专业 Agent 配置（默认走 Hermes 的 kimi-2.6 板块）
export const PRESET_AGENTS: AgentConfig[] = [
  {
    id: 'agent-designer',
    name: '🎨 设计Agent',
    model: 'kimi-2.6',
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
    model: 'kimi-2.6',
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
    model: 'kimi-2.6',
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
    model: 'kimi-2.6',
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
    model: 'kimi-2.6',
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
    model: 'kimi-2.6',
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
    model: 'kimi-2.6',
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
    model: 'kimi-2.6',
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
    model: 'kimi-2.6',
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
    model: 'kimi-2.6',
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
    model: 'kimi-2.6',
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
    model: 'kimi-2.6',
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
    model: 'kimi-2.6',
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
      version: 4,
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
          // 追加缺失的预设 Agent（包括 5 个恒热业务 Agent）
          const existingIds = new Set(state.agents.map((a) => a.id));
          const missing = PRESET_AGENTS.filter((p) => !existingIds.has(p.id));
          state.agents = [...state.agents, ...missing];
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

export interface KNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string | null;
  content?: string;
  /**
   * Q1 (2026-05-10) Memory ownership 4 级.
   * 与 /memories (Tandem curated Memory) 同语义.
   * undefined = 未分级, 在筛选 "全部" 时显示.
   */
  ownership?: 'company' | 'department' | 'team' | 'personal';
  createdAt: number;
}

interface KnowledgeStore {
  nodes: KNode[];
  setNodes: (nodes: KNode[]) => void;
  addNode: (n: KNode) => void;
  updateNode: (id: string, patch: Partial<KNode>) => void;
  deleteNode: (id: string) => void;
  /** 批量删除（递归删除文件夹的所有后代） */
  deleteNodes: (ids: string[]) => void;
  /** 批量移动 */
  moveNodes: (ids: string[], targetParentId: string) => void;
}

export const useKnowledgeStore = create<KnowledgeStore>()(
  persist(
    (set) => ({
      nodes: [
        { id: 'root', name: '知识库', type: 'folder', parentId: null, createdAt: Date.now() },
        { id: 'docs', name: '文档', type: 'folder', parentId: 'root', createdAt: Date.now() },
        { id: 'hermes-output', name: 'Hermes产出', type: 'folder', parentId: 'root', createdAt: Date.now() },
        { id: 'design', name: '设计资源', type: 'folder', parentId: 'root', createdAt: Date.now() },
      ],
      setNodes: (nodes) => set({ nodes }),
      addNode: (n) => set((state) => ({ nodes: [...state.nodes, n] })),
      updateNode: (id, patch) =>
        set((state) => ({
          nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
        })),
      deleteNode: (id) =>
        set((state) => {
          // 递归收集所有后代
          const toDelete = new Set<string>([id]);
          let added = true;
          while (added) {
            added = false;
            for (const n of state.nodes) {
              if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
                toDelete.add(n.id);
                added = true;
              }
            }
          }
          return { nodes: state.nodes.filter((n) => !toDelete.has(n.id)) };
        }),
      deleteNodes: (ids) =>
        set((state) => {
          const toDelete = new Set<string>(ids);
          let added = true;
          while (added) {
            added = false;
            for (const n of state.nodes) {
              if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
                toDelete.add(n.id);
                added = true;
              }
            }
          }
          return { nodes: state.nodes.filter((n) => !toDelete.has(n.id)) };
        }),
      moveNodes: (ids, targetParentId) =>
        set((state) => {
          // 防止把节点移到自身或自身后代下面
          const idSet = new Set(ids);
          const isInBranch = (candidateAncestor: string, child: string): boolean => {
            let cur: KNode | undefined = state.nodes.find((n) => n.id === child);
            while (cur?.parentId) {
              if (cur.parentId === candidateAncestor) return true;
              cur = state.nodes.find((n) => n.id === cur!.parentId);
            }
            return false;
          };
          return {
            nodes: state.nodes.map((n) => {
              if (!idSet.has(n.id)) return n;
              if (n.id === targetParentId) return n; // can't move into self
              if (isInBranch(n.id, targetParentId)) return n; // can't move into descendant
              return { ...n, parentId: targetParentId };
            }),
          };
        }),
    }),
    { name: '铁山-knowledge-store' }
  )
);

export interface Ministry {
  id: string;
  name: string;
  tag: string;
  agents: string[];
  description: string;
}

export interface Department {
  id: string;
  name: string;
  ministries: Ministry[];
}

interface OrgStore {
  departments: Department[];
  setDepartments: (d: Department[]) => void;
}

/**
 * A4 (2026-05-11): drop persist.
 * useOrgStore 是 fixture 组织结构数据 (中书省/门下省...), 不入后端表 — 每次启动重置.
 */
export const useOrgStore = create<OrgStore>()(
  ((set) => ({
      departments: [
        {
          id: 'dept-1',
          name: '中书省',
          ministries: [
            { id: 'min-1', name: '决策司', tag: 'decision', agents: [], description: '战略决策与目标制定' },
          ],
        },
        {
          id: 'dept-2',
          name: '门下省',
          ministries: [
            { id: 'min-2', name: '审核司', tag: 'review', agents: [], description: '审核与质量把控' },
          ],
        },
        {
          id: 'dept-3',
          name: '尚书省',
          ministries: [
            { id: 'min-3', name: '吏部', tag: 'hr', agents: [], description: 'Agent 配置与任免' },
            { id: 'min-4', name: '户部', tag: 'resources', agents: [], description: '资源与知识管理' },
            { id: 'min-5', name: '礼部', tag: 'protocol', agents: [], description: '接口与协议规范' },
            { id: 'min-6', name: '兵部', tag: 'ops', agents: [], description: '任务调度与运维' },
            { id: 'min-7', name: '刑部', tag: 'security', agents: [], description: '安全与合规审查' },
            { id: 'min-8', name: '工部', tag: 'dev', agents: [], description: '开发与工程实施' },
          ],
        },
      ],
      setDepartments: (d) => set({ departments: d }),
    }))
);

// =============================================================
// OKR — 与 Tita 功能对等的数据模型
// =============================================================
// 实体：Cycle（周期）/ Person（人员）/ Objective（目标）/ KeyResult（关键结果）/ CheckIn（进度更新）
// 设计参照 Tita 产品：周期（年/季/月/半年）+ 上下级对齐 + KR 加权 + 信心度（红黄绿）+ Check-in 时间线
// 兼容字段：每个实体保留 titaId 便于与 Tita 数据来回切换

export type Confidence = 'on-track' | 'at-risk' | 'off-track';
export type ObjectiveStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type KRType = 'numeric' | 'percentage' | 'milestone' | 'binary';
export type CycleType = 'year' | 'half' | 'quarter' | 'month';
export type Cadence = 'weekly' | 'biweekly' | 'monthly';

export interface Cycle {
  id: string;
  name: string;            // 例：'2026' / '2026-H1' / '2026-Q1' / '2026-01'
  type: CycleType;
  startDate: number;
  endDate: number;
  isActive: boolean;
  /** Check-in 节奏，Tita/Profit.co/WorkBoard 都以周为默认 */
  cadence?: Cadence;
  /** 周期总体反思纪要 (结束后人工填) */
  retrospective?: string;
  titaId?: string;
}

export interface Person {
  id: string;
  name: string;
  email?: string;
  /** 关联到 Org 中的 ministry/department，便于和组织结构联动 */
  ministryId?: string;
  avatarUrl?: string;
  titaId?: string;
}

export interface Objective {
  id: string;
  title: string;
  description?: string;
  cycleId: string;
  ownerId: string;
  /** 上级对齐目标（树结构） */
  parentId?: string | null;
  /** 在父目标下的权重 0-100 */
  weight: number;
  status: ObjectiveStatus;
  confidence: Confidence;
  visibility: 'public' | 'department' | 'private';
  tags: string[];
  /** 协作者 (可编辑)，存 personId 或 'team:<ministryId>' */
  collaborators?: string[];
  /** 关注者 (只读订阅动态) */
  watchers?: string[];
  /** 手动覆盖进度；null 表示按 KR 加权自动计算 */
  progressOverride?: number | null;
  /** 周期结束时的最终评分 0-1.0（Google 式） */
  score?: number | null;
  /** 负责人自评分 0-1.0 */
  selfScore?: number | null;
  /** 上级/管理者评分 0-1.0 */
  managerScore?: number | null;
  /** 复盘复盘记录 (PDCA / KISS / 4L 文本) */
  retrospective?: string;
  reviewedAt?: number;
  createdAt: number;
  updatedAt: number;
  titaId?: string;
}

export interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  ownerId: string;
  type: KRType;
  startValue: number;
  currentValue: number;
  targetValue: number;
  unit: string;
  /** 在 Objective 下的权重 0-100 */
  weight: number;
  confidence: Confidence;
  status: 'active' | 'completed' | 'abandoned';
  dueDate?: number;
  tags: string[];
  collaborators?: string[];
  watchers?: string[];
  /** 周期结束时的评分 0-1.0 */
  selfScore?: number | null;
  finalScore?: number | null;
  createdAt: number;
  updatedAt: number;
  titaId?: string;
}

export interface CheckIn {
  id: string;
  scope: 'objective' | 'kr';
  scopeId: string;
  authorId: string;
  /** 进度快照（百分比 0-100） */
  progressBefore: number;
  progressAfter: number;
  confidenceBefore: Confidence;
  confidenceAfter: Confidence;
  /** Weekdone PPP 三段式叙述 / Tita 进展-障碍-下一步 */
  achievements?: string;
  blockers?: string;
  nextSteps?: string;
  /** 个人心情/干劲状态 (Weekdone 高级版) */
  mood?: 'happy' | 'neutral' | 'sad';
  createdAt: number;
  titaId?: string;
}

/** 行动项 / 举措 - KR 下挂的子任务 (Perdoo/Tita 都有此层) */
export interface Initiative {
  id: string;
  /** 归属：可以挂在 KR 上 (常见)，也可直接挂 Objective 上 */
  scope: 'kr' | 'objective';
  scopeId: string;
  title: string;
  description?: string;
  ownerId: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate?: number;
  dueDate?: number;
  /** 预计/实际工时 (小时) */
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  /** 与 Tasks 面板联动：如果同步为任务，存任务 id */
  linkedTaskId?: string;
  createdAt: number;
  updatedAt: number;
  titaId?: string;
}

/** 评论 (可附在 Objective/KR/Initiative 任一实体) */
export interface OKRComment {
  id: string;
  scope: 'objective' | 'kr' | 'initiative';
  scopeId: string;
  authorId: string;
  body: string;
  /** @mention 的人物 id，用于后续通知 */
  mentions: string[];
  /** 被谁点赞 */
  reactions: { emoji: string; userId: string }[];
  createdAt: number;
  editedAt?: number;
}

/** 活动日志：所有实体变更自动写入 */
export interface OKRActivity {
  id: string;
  scope: 'objective' | 'kr' | 'initiative' | 'cycle';
  scopeId: string;
  actorId: string;
  action:
    | 'create' | 'update' | 'delete'
    | 'check-in' | 'comment' | 'reaction'
    | 'score' | 'review' | 'reassign'
    | 'complete' | 'archive' | 'reopen';
  /** 表达式描述，如 "将信心从“正常”改为“有风险”" */
  summary: string;
  /** 具体变更 (key-> oldValue/newValue) */
  changes?: Record<string, { from: any; to: any }>;
  createdAt: number;
}

/** @deprecated v1 形式；保留仅用于迁移 */
export interface LegacyOKR {
  id: string;
  objective: string;
  keyResults: { id: string; text: string; target: number; current: number; unit: string }[];
  quarter: string;
  ownerMinistryId: string;
  status: 'active' | 'completed' | 'abandoned';
}

interface OKRStore {
  cycles: Cycle[];
  people: Person[];
  objectives: Objective[];
  keyResults: KeyResult[];
  checkIns: CheckIn[];
  initiatives: Initiative[];
  comments: OKRComment[];
  activities: OKRActivity[];
  activeCycleId: string;
  /** 当前运行身份 (可后续接认证)，默认 'me' */
  currentUserId: string;

  // Cycle
  addCycle: (c: Omit<Cycle, 'id'>) => Cycle;
  updateCycle: (id: string, patch: Partial<Cycle>) => void;
  deleteCycle: (id: string) => void;
  setActiveCycleId: (id: string) => void;

  // Person
  addPerson: (p: Omit<Person, 'id'>) => Person;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  setCurrentUserId: (id: string) => void;

  // Objective
  addObjective: (o: Omit<Objective, 'id' | 'createdAt' | 'updatedAt'>) => Objective;
  updateObjective: (id: string, patch: Partial<Objective>) => void;
  /** 递归删除：连带 KR + Initiative + CheckIn + Comment + 子 Objective */
  deleteObjective: (id: string) => void;

  // KR
  addKeyResult: (kr: Omit<KeyResult, 'id' | 'createdAt' | 'updatedAt'>) => KeyResult;
  updateKeyResult: (id: string, patch: Partial<KeyResult>) => void;
  deleteKeyResult: (id: string) => void;

  // CheckIn
  /** 写入 check-in 后会自动同步 currentValue / confidence 到目标实体 */
  addCheckIn: (c: Omit<CheckIn, 'id' | 'createdAt'>) => CheckIn;

  // Initiative
  addInitiative: (i: Omit<Initiative, 'id' | 'createdAt' | 'updatedAt'>) => Initiative;
  updateInitiative: (id: string, patch: Partial<Initiative>) => void;
  deleteInitiative: (id: string) => void;

  // Comment
  addComment: (c: Omit<OKRComment, 'id' | 'createdAt' | 'mentions' | 'reactions'> & { mentions?: string[] }) => OKRComment;
  updateComment: (id: string, body: string) => void;
  deleteComment: (id: string) => void;
  toggleReaction: (commentId: string, emoji: string, userId: string) => void;

  // Watcher / Collaborator
  toggleWatcher: (scope: 'objective' | 'kr', scopeId: string, userId: string) => void;
  toggleCollaborator: (scope: 'objective' | 'kr', scopeId: string, userId: string) => void;

  // 评分阶段（周期末）
  scoreObjective: (id: string, kind: 'self' | 'manager' | 'final', value: number) => void;
  scoreKeyResult: (id: string, kind: 'self' | 'final', value: number) => void;
  reviewObjective: (id: string, retrospective: string) => void;

  // 全量替换（导入用）
  replaceAll: (data: {
    cycles?: Cycle[];
    people?: Person[];
    objectives?: Objective[];
    keyResults?: KeyResult[];
    checkIns?: CheckIn[];
    initiatives?: Initiative[];
    comments?: OKRComment[];
    activities?: OKRActivity[];
    activeCycleId?: string;
  }) => void;

  // 计算
  /** Objective 的当前进度（0-100）：有 override 用 override，否则 KR 加权 */
  getObjectiveProgress: (objectiveId: string) => number;
  /** KR 进度 0-100 */
  getKRProgress: (krId: string) => number;
  /** 获取实体上的评论 */
  getComments: (scope: 'objective' | 'kr' | 'initiative', scopeId: string) => OKRComment[];
  /** 获取实体的活动日志 (含后代) */
  getActivities: (scope: 'objective' | 'kr', scopeId: string) => OKRActivity[];
}

function calcKRProgress(kr: KeyResult): number {
  if (kr.type === 'binary') {
    return kr.currentValue >= 1 ? 100 : 0;
  }
  if (kr.type === 'milestone') {
    return Math.max(0, Math.min(100, Math.round(kr.currentValue)));
  }
  // numeric / percentage
  const span = kr.targetValue - kr.startValue;
  if (span === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
  const pct = ((kr.currentValue - kr.startValue) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

const _now = () => Date.now();

// 默认周期：当前年 + 4 季度
function defaultCycles(): Cycle[] {
  const y = new Date().getFullYear();
  const ms = (m: number, d = 1) => new Date(y, m - 1, d).getTime();
  const eo = (m: number) => new Date(y, m, 0).getTime(); // end of month
  return [
    { id: `cy-${y}`, name: `${y}`, type: 'year', startDate: ms(1), endDate: eo(12), isActive: false },
    { id: `cy-${y}-q1`, name: `${y}-Q1`, type: 'quarter', startDate: ms(1), endDate: eo(3), isActive: false },
    { id: `cy-${y}-q2`, name: `${y}-Q2`, type: 'quarter', startDate: ms(4), endDate: eo(6), isActive: false },
    { id: `cy-${y}-q3`, name: `${y}-Q3`, type: 'quarter', startDate: ms(7), endDate: eo(9), isActive: true },
    { id: `cy-${y}-q4`, name: `${y}-Q4`, type: 'quarter', startDate: ms(10), endDate: eo(12), isActive: false },
  ];
}

export const useOKRStore = create<OKRStore>()(
  persist(
    (set, get) => ({
      cycles: defaultCycles(),
      people: [
        { id: 'me', name: '我', ministryId: 'min-1' },
      ],
      objectives: [],
      keyResults: [],
      checkIns: [],
      initiatives: [],
      comments: [],
      activities: [],
      activeCycleId: defaultCycles().find((c) => c.isActive)?.id || defaultCycles()[0].id,
      currentUserId: 'me',

      // ===== Cycle =====
      addCycle: (c) => {
        const cycle: Cycle = { id: crypto.randomUUID(), ...c };
        set((s) => ({ cycles: [...s.cycles, cycle] }));
        return cycle;
      },
      updateCycle: (id, patch) =>
        set((s) => ({ cycles: s.cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      deleteCycle: (id) =>
        set((s) => ({
          cycles: s.cycles.filter((c) => c.id !== id),
          activeCycleId: s.activeCycleId === id ? (s.cycles.find((c) => c.id !== id)?.id || '') : s.activeCycleId,
        })),
      setActiveCycleId: (id) =>
        set((s) => ({
          activeCycleId: id,
          cycles: s.cycles.map((c) => ({ ...c, isActive: c.id === id })),
        })),

      // ===== Person =====
      addPerson: (p) => {
        const person: Person = { id: crypto.randomUUID(), ...p };
        set((s) => ({ people: [...s.people, person] }));
        return person;
      },
      updatePerson: (id, patch) =>
        set((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePerson: (id) =>
        set((s) => ({ people: s.people.filter((p) => p.id !== id) })),

      // ===== Objective =====
      addObjective: (o) => {
        const now = _now();
        const obj: Objective = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...o };
        set((s) => ({
          objectives: [...s.objectives, obj],
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(), scope: 'objective', scopeId: obj.id,
              actorId: get().currentUserId, action: 'create',
              summary: `创建目标「${obj.title}」`, createdAt: now,
            },
          ],
        }));
        return obj;
      },
      updateObjective: (id, patch) =>
        set((s) => {
          const old = s.objectives.find((o) => o.id === id);
          if (!old) return s;
          const now = _now();
          const updated = { ...old, ...patch, updatedAt: now };
          const changes: Record<string, { from: any; to: any }> = {};
          for (const k of Object.keys(patch)) {
            const before = (old as any)[k]; const after = (patch as any)[k];
            if (JSON.stringify(before) !== JSON.stringify(after)) {
              changes[k] = { from: before, to: after };
            }
          }
          let summary = `更新「${updated.title}」`;
          if (patch.confidence && patch.confidence !== old.confidence) {
            summary = `信心：${old.confidence} → ${patch.confidence}`;
          } else if (patch.status && patch.status !== old.status) {
            summary = `状态：${old.status} → ${patch.status}`;
          } else if (patch.ownerId && patch.ownerId !== old.ownerId) {
            summary = `负责人变更`;
          } else if (patch.title && patch.title !== old.title) {
            summary = `标题：${old.title} → ${patch.title}`;
          }
          if (Object.keys(changes).length === 0) {
            return { objectives: s.objectives.map((o) => (o.id === id ? updated : o)) };
          }
          return {
            objectives: s.objectives.map((o) => (o.id === id ? updated : o)),
            activities: [
              ...s.activities,
              {
                id: crypto.randomUUID(), scope: 'objective', scopeId: id,
                actorId: get().currentUserId, action: 'update',
                summary, changes, createdAt: now,
              },
            ],
          };
        }),
      deleteObjective: (id) =>
        set((s) => {
          // 递归收集后代 Objective
          const toDelete = new Set<string>([id]);
          let added = true;
          while (added) {
            added = false;
            for (const o of s.objectives) {
              if (o.parentId && toDelete.has(o.parentId) && !toDelete.has(o.id)) {
                toDelete.add(o.id);
                added = true;
              }
            }
          }
          const krIds = new Set(s.keyResults.filter((k) => toDelete.has(k.objectiveId)).map((k) => k.id));
          return {
            objectives: s.objectives.filter((o) => !toDelete.has(o.id)),
            keyResults: s.keyResults.filter((k) => !toDelete.has(k.objectiveId)),
            checkIns: s.checkIns.filter((c) =>
              !(c.scope === 'objective' && toDelete.has(c.scopeId)) &&
              !(c.scope === 'kr' && krIds.has(c.scopeId))
            ),
          };
        }),

      // ===== KR =====
      addKeyResult: (kr) => {
        const now = _now();
        const k: KeyResult = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...kr };
        set((s) => ({
          keyResults: [...s.keyResults, k],
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(), scope: 'kr', scopeId: k.id,
              actorId: get().currentUserId, action: 'create',
              summary: `新建 KR「${k.title}」`, createdAt: now,
            },
          ],
        }));
        return k;
      },
      updateKeyResult: (id, patch) =>
        set((s) => {
          const old = s.keyResults.find((k) => k.id === id);
          if (!old) return s;
          const now = _now();
          const updated = { ...old, ...patch, updatedAt: now };
          const changes: Record<string, { from: any; to: any }> = {};
          for (const k of Object.keys(patch)) {
            const before = (old as any)[k]; const after = (patch as any)[k];
            if (JSON.stringify(before) !== JSON.stringify(after)) {
              changes[k] = { from: before, to: after };
            }
          }
          if (Object.keys(changes).length === 0) {
            return { keyResults: s.keyResults.map((k) => (k.id === id ? updated : k)) };
          }
          let summary = `更新 KR「${updated.title}」`;
          if (patch.currentValue != null && patch.currentValue !== old.currentValue) {
            summary = `KR「${updated.title}」：${old.currentValue} → ${patch.currentValue} ${updated.unit}`;
          }
          return {
            keyResults: s.keyResults.map((k) => (k.id === id ? updated : k)),
            activities: [
              ...s.activities,
              {
                id: crypto.randomUUID(), scope: 'kr', scopeId: id,
                actorId: get().currentUserId, action: 'update',
                summary, changes, createdAt: now,
              },
            ],
          };
        }),
      deleteKeyResult: (id) =>
        set((s) => ({
          keyResults: s.keyResults.filter((k) => k.id !== id),
          checkIns: s.checkIns.filter((c) => !(c.scope === 'kr' && c.scopeId === id)),
        })),

      // ===== CheckIn =====
      addCheckIn: (c) => {
        const ci: CheckIn = { id: crypto.randomUUID(), createdAt: _now(), ...c };
        set((s) => {
          const next: Partial<OKRStore> = {
            checkIns: [...s.checkIns, ci],
            activities: [
              ...s.activities,
              {
                id: crypto.randomUUID(), scope: ci.scope, scopeId: ci.scopeId,
                actorId: ci.authorId, action: 'check-in',
                summary: `Check-in：进度 ${ci.progressBefore}% → ${ci.progressAfter}%、信心 ${ci.confidenceBefore} → ${ci.confidenceAfter}`,
                createdAt: ci.createdAt,
              },
            ],
          };
          // 自动同步到目标实体的 confidence；对 KR 还要同步 currentValue（按 progressAfter 反推）
          if (ci.scope === 'kr') {
            next.keyResults = s.keyResults.map((k) => {
              if (k.id !== ci.scopeId) return k;
              // 反推 currentValue：按 progressAfter / 100 * (target - start) + start
              let newCurrent = k.currentValue;
              if (k.type === 'numeric' || k.type === 'percentage' || k.type === 'milestone') {
                if (k.type === 'milestone') {
                  newCurrent = ci.progressAfter;
                } else {
                  newCurrent = k.startValue + (ci.progressAfter / 100) * (k.targetValue - k.startValue);
                  newCurrent = Math.round(newCurrent * 100) / 100;
                }
              } else if (k.type === 'binary') {
                newCurrent = ci.progressAfter >= 100 ? 1 : 0;
              }
              return { ...k, currentValue: newCurrent, confidence: ci.confidenceAfter, updatedAt: _now() };
            });
          } else {
            next.objectives = s.objectives.map((o) =>
              o.id === ci.scopeId
                ? { ...o, confidence: ci.confidenceAfter, progressOverride: ci.progressAfter, updatedAt: _now() }
                : o
            );
          }
          return next as any;
        });
        return ci;
      },

      // ===== 全量替换 =====
      replaceAll: (data) =>
        set((s) => ({
          cycles: data.cycles ?? s.cycles,
          people: data.people ?? s.people,
          objectives: data.objectives ?? s.objectives,
          keyResults: data.keyResults ?? s.keyResults,
          checkIns: data.checkIns ?? s.checkIns,
          activeCycleId: data.activeCycleId ?? s.activeCycleId,
        })),

      // ===== 计算 =====
      getKRProgress: (krId) => {
        const kr = get().keyResults.find((k) => k.id === krId);
        return kr ? calcKRProgress(kr) : 0;
      },
      getObjectiveProgress: (objectiveId) => {
        const obj = get().objectives.find((o) => o.id === objectiveId);
        if (!obj) return 0;
        if (obj.progressOverride != null) return obj.progressOverride;
        const krs = get().keyResults.filter((k) => k.objectiveId === objectiveId);
        if (krs.length === 0) return 0;
        const totalWeight = krs.reduce((sum, k) => sum + (k.weight || 1), 0);
        if (totalWeight === 0) return 0;
        const weighted = krs.reduce(
          (sum, k) => sum + calcKRProgress(k) * (k.weight || 1),
          0
        );
        return Math.round(weighted / totalWeight);
      },

      // ===== Person.setCurrentUserId =====
      setCurrentUserId: (id) => set({ currentUserId: id }),

      // ===== Initiative =====
      addInitiative: (i) => {
        const now = _now();
        const init: Initiative = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...i };
        set((s) => ({
          initiatives: [...s.initiatives, init],
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(), scope: i.scope === 'kr' ? 'kr' : 'objective',
              scopeId: i.scopeId, actorId: get().currentUserId, action: 'create',
              summary: `新增行动项「${init.title}」`, createdAt: now,
            },
          ],
        }));
        return init;
      },
      updateInitiative: (id, patch) =>
        set((s) => {
          const old = s.initiatives.find((i) => i.id === id);
          if (!old) return s;
          const now = _now();
          const updated = { ...old, ...patch, updatedAt: now };
          const changes: Record<string, { from: any; to: any }> = {};
          for (const k of Object.keys(patch)) {
            if ((old as any)[k] !== (patch as any)[k]) {
              changes[k] = { from: (old as any)[k], to: (patch as any)[k] };
            }
          }
          let summary = `更新行动项「${updated.title}」`;
          if (patch.status && patch.status !== old.status) {
            summary = `行动项「${updated.title}」状态：${old.status} → ${patch.status}`;
          }
          return {
            initiatives: s.initiatives.map((i) => (i.id === id ? updated : i)),
            activities: [
              ...s.activities,
              {
                id: crypto.randomUUID(), scope: updated.scope === 'kr' ? 'kr' : 'objective',
                scopeId: updated.scopeId, actorId: get().currentUserId, action: 'update',
                summary, changes, createdAt: now,
              },
            ],
          };
        }),
      deleteInitiative: (id) =>
        set((s) => ({
          initiatives: s.initiatives.filter((i) => i.id !== id),
          comments: s.comments.filter((c) => !(c.scope === 'initiative' && c.scopeId === id)),
        })),

      // ===== Comment =====
      addComment: (c) => {
        // 自动从 body 中抽取 @mention（@张三 形态，按 people.name 匹配）
        const explicitMentions = c.mentions || [];
        const people = get().people;
        const inferredMentions = people
          .filter((p) => new RegExp(`@${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(c.body))
          .map((p) => p.id);
        const mentions = Array.from(new Set([...explicitMentions, ...inferredMentions]));
        const now = _now();
        const comment: OKRComment = {
          id: crypto.randomUUID(), createdAt: now,
          ...c, mentions, reactions: [],
        };
        set((s) => ({
          comments: [...s.comments, comment],
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(),
              scope: c.scope === 'initiative' ? 'initiative' : c.scope,
              scopeId: c.scopeId, actorId: c.authorId, action: 'comment',
              summary: `评论：${c.body.slice(0, 60)}${c.body.length > 60 ? '…' : ''}`,
              createdAt: now,
            },
          ],
        }));
        return comment;
      },
      updateComment: (id, body) =>
        set((s) => ({
          comments: s.comments.map((c) =>
            c.id === id ? { ...c, body, editedAt: _now() } : c
          ),
        })),
      deleteComment: (id) =>
        set((s) => ({ comments: s.comments.filter((c) => c.id !== id) })),
      toggleReaction: (commentId, emoji, userId) =>
        set((s) => ({
          comments: s.comments.map((c) => {
            if (c.id !== commentId) return c;
            const exists = c.reactions.find((r) => r.emoji === emoji && r.userId === userId);
            return {
              ...c,
              reactions: exists
                ? c.reactions.filter((r) => !(r.emoji === emoji && r.userId === userId))
                : [...c.reactions, { emoji, userId }],
            };
          }),
        })),

      // ===== Watcher / Collaborator =====
      toggleWatcher: (scope, scopeId, userId) =>
        set((s) => {
          const now = _now();
          const toggle = (arr: string[] | undefined): string[] => {
            const cur = arr || [];
            return cur.includes(userId) ? cur.filter((x) => x !== userId) : [...cur, userId];
          };
          if (scope === 'objective') {
            return {
              objectives: s.objectives.map((o) =>
                o.id === scopeId ? { ...o, watchers: toggle(o.watchers), updatedAt: now } : o
              ),
            };
          }
          return {
            keyResults: s.keyResults.map((k) =>
              k.id === scopeId ? { ...k, watchers: toggle(k.watchers), updatedAt: now } : k
            ),
          };
        }),
      toggleCollaborator: (scope, scopeId, userId) =>
        set((s) => {
          const now = _now();
          const toggle = (arr: string[] | undefined): string[] => {
            const cur = arr || [];
            return cur.includes(userId) ? cur.filter((x) => x !== userId) : [...cur, userId];
          };
          if (scope === 'objective') {
            return {
              objectives: s.objectives.map((o) =>
                o.id === scopeId ? { ...o, collaborators: toggle(o.collaborators), updatedAt: now } : o
              ),
            };
          }
          return {
            keyResults: s.keyResults.map((k) =>
              k.id === scopeId ? { ...k, collaborators: toggle(k.collaborators), updatedAt: now } : k
            ),
          };
        }),

      // ===== 评分 =====
      scoreObjective: (id, kind, value) => {
        const v = Math.max(0, Math.min(1, value));
        const field = kind === 'self' ? 'selfScore' : kind === 'manager' ? 'managerScore' : 'score';
        set((s) => ({
          objectives: s.objectives.map((o) =>
            o.id === id ? { ...o, [field]: v, updatedAt: _now() } : o
          ),
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(), scope: 'objective', scopeId: id,
              actorId: get().currentUserId, action: 'score',
              summary: `${kind === 'self' ? '自评' : kind === 'manager' ? '上级评分' : '终评'}：${v.toFixed(1)}`,
              createdAt: _now(),
            },
          ],
        }));
      },
      scoreKeyResult: (id, kind, value) => {
        const v = Math.max(0, Math.min(1, value));
        const field = kind === 'self' ? 'selfScore' : 'finalScore';
        set((s) => ({
          keyResults: s.keyResults.map((k) =>
            k.id === id ? { ...k, [field]: v, updatedAt: _now() } : k
          ),
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(), scope: 'kr', scopeId: id,
              actorId: get().currentUserId, action: 'score',
              summary: `KR ${kind === 'self' ? '自评' : '终评'}：${v.toFixed(1)}`,
              createdAt: _now(),
            },
          ],
        }));
      },
      reviewObjective: (id, retrospective) =>
        set((s) => ({
          objectives: s.objectives.map((o) =>
            o.id === id ? { ...o, retrospective, reviewedAt: _now(), updatedAt: _now() } : o
          ),
          activities: [
            ...s.activities,
            {
              id: crypto.randomUUID(), scope: 'objective', scopeId: id,
              actorId: get().currentUserId, action: 'review',
              summary: '完成复盘', createdAt: _now(),
            },
          ],
        })),

      // ===== 查询 =====
      getComments: (scope, scopeId) =>
        get().comments
          .filter((c) => c.scope === scope && c.scopeId === scopeId)
          .sort((a, b) => a.createdAt - b.createdAt),

      getActivities: (scope, scopeId) => {
        const all = get().activities;
        if (scope === 'objective') {
          // 含其下 KR / Initiative 的活动
          const krIds = new Set(get().keyResults.filter((k) => k.objectiveId === scopeId).map((k) => k.id));
          const initIds = new Set(
            get().initiatives.filter(
              (i) => (i.scope === 'objective' && i.scopeId === scopeId) ||
                     (i.scope === 'kr' && krIds.has(i.scopeId))
            ).map((i) => i.id)
          );
          return all
            .filter((a) =>
              (a.scope === 'objective' && a.scopeId === scopeId) ||
              (a.scope === 'kr' && krIds.has(a.scopeId)) ||
              (a.scope === 'initiative' && initIds.has(a.scopeId))
            )
            .sort((a, b) => b.createdAt - a.createdAt);
        }
        return all
          .filter((a) => a.scope === scope && a.scopeId === scopeId)
          .sort((a, b) => b.createdAt - a.createdAt);
      },
    }),
    {
      name: '铁山-okr-store',
      version: 3,
      migrate: (persisted: any, fromVersion: number) => {
        if (!persisted) return persisted;
        if (fromVersion < 2) {
          // v1 → v2：把老的 okrs[] 拆成 cycles + objectives + keyResults
          const legacy: LegacyOKR[] = Array.isArray(persisted.okrs) ? persisted.okrs : [];
          const cycles = defaultCycles();
          const cycleMap = new Map<string, string>();
          for (const c of cycles) cycleMap.set(c.name, c.id);
          // 老的 quarter 字符串如 '2026-Q1' 可直接用作名字匹配，否则建临时周期
          const objectives: Objective[] = [];
          const keyResults: KeyResult[] = [];
          const now = Date.now();
          for (const old of legacy) {
            let cycleId = cycleMap.get(old.quarter);
            if (!cycleId) {
              const newCycle: Cycle = {
                id: crypto.randomUUID(),
                name: old.quarter,
                type: 'quarter',
                startDate: now, endDate: now, isActive: false,
              };
              cycles.push(newCycle);
              cycleId = newCycle.id;
              cycleMap.set(old.quarter, cycleId);
            }
            const objId = old.id;
            objectives.push({
              id: objId,
              title: old.objective,
              cycleId,
              ownerId: `team:${old.ownerMinistryId}`,
              parentId: null,
              weight: 100,
              status: old.status === 'abandoned' ? 'archived' : (old.status as ObjectiveStatus),
              confidence: 'on-track',
              visibility: 'public',
              tags: [],
              progressOverride: null,
              createdAt: now,
              updatedAt: now,
            });
            for (const kr of old.keyResults) {
              keyResults.push({
                id: kr.id,
                objectiveId: objId,
                title: kr.text,
                ownerId: `team:${old.ownerMinistryId}`,
                type: kr.unit === '%' ? 'percentage' : 'numeric',
                startValue: 0,
                currentValue: kr.current,
                targetValue: kr.target,
                unit: kr.unit,
                weight: 100 / Math.max(1, old.keyResults.length),
                confidence: 'on-track',
                status: 'active',
                tags: [],
                createdAt: now,
                updatedAt: now,
              });
            }
          }
          const active = cycles.find((c) => c.isActive)?.id || cycles[0]?.id || '';
          persisted = {
            ...persisted,
            cycles,
            people: persisted.people || [{ id: 'me', name: '我' }],
            objectives,
            keyResults,
            checkIns: [],
            activeCycleId: active,
          };
          // 不直接 return；继续走 v2 → v3
        }
        if (fromVersion < 3) {
          // v2 → v3：补全新字段（initiatives/comments/activities + scoring/watchers/collaborators 默认值）
          persisted = {
            ...persisted,
            initiatives: persisted.initiatives || [],
            comments: persisted.comments || [],
            activities: persisted.activities || [],
            currentUserId: persisted.currentUserId || 'me',
            cycles: (persisted.cycles || []).map((c: any) => ({
              cadence: 'weekly',
              ...c,
            })),
            objectives: (persisted.objectives || []).map((o: any) => ({
              collaborators: [],
              watchers: [],
              selfScore: null,
              managerScore: null,
              score: o.score ?? null,
              retrospective: '',
              ...o,
            })),
            keyResults: (persisted.keyResults || []).map((k: any) => ({
              collaborators: [],
              watchers: [],
              selfScore: null,
              finalScore: null,
              ...k,
            })),
          };
        }
        return persisted;
      },
    }
  )
);

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppStore {
  darkMode: ThemeMode;
  setDarkMode: (m: ThemeMode) => void;
  apiBaseUrl: string;
  setApiBaseUrl: (u: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      darkMode: 'system',
      setDarkMode: (m) => set({ darkMode: m }),
      apiBaseUrl: process.env.NEXT_PUBLIC_HERMES_API_URL || 'http://localhost:8000',
      setApiBaseUrl: (u) => set({ apiBaseUrl: u }),
    }),
    { name: '铁山-app-store' }
  )
);

// Memories - 知识库底层要求和累计共识
export interface Memory {
  id: string;
  title: string;
  content: string;
  category: 'requirement' | 'consensus' | 'standard' | 'context';
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: number;
  updatedAt: number;
  version: number;
  isActive: boolean;
  /** v2 起：所属文件夹 id；老数据自动按 category 落到 cat-{category} 文件夹下 */
  parentId?: string | null;
}

export interface MemoryFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

interface MemoryStore {
  memories: Memory[];
  folders: MemoryFolder[];
  addMemory: (m: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => void;
  updateMemory: (id: string, patch: Partial<Omit<Memory, 'id' | 'createdAt'>>) => void;
  deleteMemory: (id: string) => void;
  /** 批量删除 memory 节点；id 命中文件夹时，递归删除其下所有 memory + 子文件夹 */
  deleteMemoryNodes: (ids: string[]) => void;
  /** 批量移动 memory/文件夹到目标文件夹 */
  moveMemoryNodes: (ids: string[], targetFolderId: string) => void;
  toggleActive: (id: string) => void;
  /** 创建文件夹 */
  addFolder: (name: string, parentId: string) => void;
  /** 重命名文件夹 */
  renameFolder: (id: string, newName: string) => void;
  getActiveMemories: () => Memory[];
  getByCategory: (category: Memory['category']) => Memory[];
  /** 把 active 且 priority>=high 的 memory 拼成 system prompt 前缀，用于注入对话 */
  getBaselineSystemPrompt: () => string;
  exportMemories: () => string;
  importMemories: (json: string) => void;
}

/**
 * A4 (2026-05-11): drop persist.
 * useMemoryStore 后端 (DecisionCard / MemoryEntry / PromotionRequest) 已通过
 * /api/tandem/memory/* 接入. /memories UI 切 API 走 A2.3 后续迭代,
 * 此处先 drop persist 避免 stale demo 数据继续残留.
 */
export const useMemoryStore = create<MemoryStore>()(
  ((set, get) => ({
      folders: [
        { id: 'mem-root', name: '记忆库', parentId: null, createdAt: Date.now() },
        { id: 'cat-requirement', name: '需求', parentId: 'mem-root', createdAt: Date.now() },
        { id: 'cat-consensus', name: '共识', parentId: 'mem-root', createdAt: Date.now() },
        { id: 'cat-standard', name: '标准', parentId: 'mem-root', createdAt: Date.now() },
        { id: 'cat-context', name: '上下文', parentId: 'mem-root', createdAt: Date.now() },
      ],
      memories: [
        {
          id: 'mem-1',
          title: '项目技术栈',
          content: 'Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui + Zustand',
          category: 'standard',
          parentId: 'cat-standard',
          tags: ['tech-stack', 'frontend'],
          priority: 'critical',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
          isActive: true,
        },
        {
          id: 'mem-2',
          title: '编码规范共识',
          content: '1. 使用中文注释和界面\n2. 禁止 inline style，改用 CSS 变量\n3. 所有 API 路由必须加 UTF-8 环境变量\n4. Windows spawn 使用 shell: false',
          category: 'consensus',
          parentId: 'cat-consensus',
          tags: ['coding', 'style', 'agreement'],
          priority: 'high',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
          isActive: true,
        },
        {
          id: 'mem-3',
          title: 'Hermes CLI 集成要求',
          content: '所有 Hermes 调用必须通过统一封装，确保：\n- PYTHONIOENCODING=utf-8\n- PYTHONUTF8=1\n- NO_COLOR=1\n- Windows 避免 shell injection',
          category: 'requirement',
          parentId: 'cat-requirement',
          tags: ['hermes', 'cli', 'integration'],
          priority: 'critical',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
          isActive: true,
        },
      ],
      addMemory: (m) => {
        const now = Date.now();
        const newMemory: Memory = {
          ...m,
          // 没显式给 parentId 则按 category 落到对应默认文件夹
          parentId: m.parentId ?? `cat-${m.category}`,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          version: 1,
        };
        set((state) => ({ memories: [newMemory, ...state.memories] }));
      },
      updateMemory: (id, patch) =>
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id
              ? { ...m, ...patch, updatedAt: Date.now(), version: m.version + 1 }
              : m
          ),
        })),
      deleteMemory: (id) =>
        set((state) => ({
          memories: state.memories.filter((m) => m.id !== id),
        })),
      deleteMemoryNodes: (ids) =>
        set((state) => {
          // 递归收集要删的文件夹后代
          const folderIdsToDelete = new Set<string>(
            ids.filter((id) => state.folders.some((f) => f.id === id))
          );
          let added = true;
          while (added) {
            added = false;
            for (const f of state.folders) {
              if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
                folderIdsToDelete.add(f.id);
                added = true;
              }
            }
          }
          // memory：被显式选中的 + 在被删文件夹下的
          const memIdsToDelete = new Set<string>(
            ids.filter((id) => state.memories.some((m) => m.id === id))
          );
          for (const m of state.memories) {
            if (m.parentId && folderIdsToDelete.has(m.parentId)) memIdsToDelete.add(m.id);
          }
          return {
            folders: state.folders.filter((f) => !folderIdsToDelete.has(f.id)),
            memories: state.memories.filter((m) => !memIdsToDelete.has(m.id)),
          };
        }),
      moveMemoryNodes: (ids, targetFolderId) =>
        set((state) => {
          // 防止把文件夹移到自身或自身后代下
          const isInBranch = (ancestor: string, candidate: string): boolean => {
            let cur: MemoryFolder | undefined = state.folders.find((f) => f.id === candidate);
            while (cur?.parentId) {
              if (cur.parentId === ancestor) return true;
              cur = state.folders.find((f) => f.id === cur!.parentId);
            }
            return false;
          };
          const idSet = new Set(ids);
          const folders = state.folders.map((f) => {
            if (!idSet.has(f.id)) return f;
            if (f.id === targetFolderId) return f;
            if (isInBranch(f.id, targetFolderId)) return f;
            return { ...f, parentId: targetFolderId };
          });
          const memories = state.memories.map((m) =>
            idSet.has(m.id) ? { ...m, parentId: targetFolderId, updatedAt: Date.now() } : m
          );
          return { folders, memories };
        }),
      addFolder: (name, parentId) =>
        set((state) => ({
          folders: [
            ...state.folders,
            { id: crypto.randomUUID(), name, parentId, createdAt: Date.now() },
          ],
        })),
      renameFolder: (id, newName) =>
        set((state) => ({
          folders: state.folders.map((f) => (f.id === id ? { ...f, name: newName } : f)),
        })),
      toggleActive: (id) =>
        set((state) => ({
          memories: state.memories.map((m) =>
            m.id === id ? { ...m, isActive: !m.isActive, updatedAt: Date.now() } : m
          ),
        })),
      getActiveMemories: () => get().memories.filter((m) => m.isActive),
      getByCategory: (category) => get().memories.filter((m) => m.category === category),
      getBaselineSystemPrompt: () => {
        // 只注入 active 且 critical/high 的 memory，避免 prompt 过长
        const items = get().memories.filter(
          (m) => m.isActive && (m.priority === 'critical' || m.priority === 'high')
        );
        if (items.length === 0) return '';
        const sections = items
          .sort((a, b) => (a.priority === 'critical' ? -1 : 1) - (b.priority === 'critical' ? -1 : 1))
          .map((m) => `- [${m.category}/${m.priority}] ${m.title}\n  ${m.content}`)
          .join('\n');
        return `# 公司基线（必须遵守）\n以下是公司层面注入的标准/共识/要求，请在所有回答中严格遵守：\n${sections}\n`;
      },
      exportMemories: () => JSON.stringify(get().memories, null, 2),
      importMemories: (json) => {
        try {
          const imported = JSON.parse(json) as Memory[];
          const now = Date.now();
          const validated = imported.map((m) => ({
            ...m,
            id: m.id || crypto.randomUUID(),
            createdAt: m.createdAt || now,
            updatedAt: now,
            version: m.version || 1,
          }));
          set({ memories: validated });
        } catch (e) {
          console.error('Failed to import memories:', e);
        }
      },
    }))
);

// =============================================================================
// 1on1 模块 (2026-05-10 · OKR P1)
// =============================================================================
// 主管-员工双向周期对话, 对标 Tita 1on1. Tandem 差异化:
//   - 关联 KR: 会议直接挂 KR, 避免空聊
//   - 三段式 notes (进展/障碍/下一步) 沿用 Tita 范式
//   - 产出 actionItems 直接下发 (M2 可挂 Initiative)
// =============================================================================

export type OneOnOneCadence = 'weekly' | 'biweekly' | 'monthly' | 'adhoc';
export type OneOnOneStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show';

export interface OneOnOneActionItem {
  id: string;
  text: string;
  assigneeId: string;     // 'manager' | 'report' | personId
  dueDate?: number;
  done: boolean;
}

export interface OneOnOneMeeting {
  id: string;
  /** 主管 personId */
  managerId: string;
  /** 下级 personId */
  reportId: string;
  cadence: OneOnOneCadence;
  /** 计划开始时间 (ms) */
  scheduledAt: number;
  /** 实际开始时间 (ms), 未开始时 undefined */
  startedAt?: number;
  /** 完成时间 (ms) */
  completedAt?: number;
  status: OneOnOneStatus;
  /** 议程预设 (会前双方各自填) — 也叫 talking points */
  agendaManager?: string;  // 主管想聊的
  agendaReport?: string;   // 员工想聊的
  /** 会中 / 会后填的三段式 */
  noteProgress?: string;   // 进展
  noteBlockers?: string;   // 障碍
  noteNextSteps?: string;  // 下一步
  /** 挂的 KR ID 列表 (连 OKR) */
  linkedKrIds: string[];
  /** 结论性 action items */
  actionItems: OneOnOneActionItem[];
  /** 员工干劲评分 1-5 (可选, 隐私保护, 只主管可见) */
  moodScore?: number;
  /** 隐私: 是否主管可见 (主管和员工各自的 private note) */
  privateManagerNote?: string;
  createdAt: number;
  updatedAt: number;
}

interface OneOnOneStore {
  meetings: OneOnOneMeeting[];
  /** A2.3: 标记是否已从 API 加载过 (避免重复请求) */
  _hydrated: boolean;
  /** A2.3: 从后端拉全量 (mine 范围), 替换本地. 仅在浏览器调用. */
  loadFromApi: () => Promise<void>;
  addMeeting: (m: Omit<OneOnOneMeeting, 'id' | 'createdAt' | 'updatedAt' | 'actionItems' | 'linkedKrIds' | 'status'> & { status?: OneOnOneStatus; actionItems?: OneOnOneActionItem[]; linkedKrIds?: string[] }) => string;
  updateMeeting: (id: string, patch: Partial<OneOnOneMeeting>) => void;
  deleteMeeting: (id: string) => void;
  addActionItem: (meetingId: string, text: string, assigneeId: string, dueDate?: number) => void;
  toggleActionItem: (meetingId: string, itemId: string) => void;
  removeActionItem: (meetingId: string, itemId: string) => void;
}

/**
 * A2.3 (2026-05-11): 切真后端
 *  - 删 persist 中间件 (D5: 接受 demo localStorage 数据丢弃)
 *  - 每个 mutation: 立即更新本地 + fire-and-forget POST/PATCH/DELETE
 *  - 服务端接受 client 生成的 id (Prisma `@default(cuid())` 但允许显式传)
 *  - loadFromApi: 页面 mount 时调一次, 后续操作维持本地 + 后台同步
 *  - 故意不 await 网络: UI 即时响应; 失败 console.warn
 */
export const useOneOnOneStore = create<OneOnOneStore>()((set, get) => ({
  meetings: [],
  _hydrated: false,
  loadFromApi: async () => {
    if (typeof window === 'undefined') return;
    const { loadAllFromApi } = await import('@/lib/api/one-on-one-sync');
    const meetings = await loadAllFromApi();
    set({ meetings, _hydrated: true });
  },
  addMeeting: (m) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const meeting: OneOnOneMeeting = {
      id,
      actionItems: [],
      linkedKrIds: [],
      status: 'scheduled',
      createdAt: now,
      updatedAt: now,
      ...m,
    } as OneOnOneMeeting;
    set((s) => ({ meetings: [...s.meetings, meeting] }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/one-on-one-sync').then((mod) =>
        mod.syncCreateMeeting(meeting),
      );
    }
    return id;
  },
  updateMeeting: (id, patch) => {
    set((s) => ({
      meetings: s.meetings.map((x) =>
        x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x,
      ),
    }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/one-on-one-sync').then((mod) =>
        mod.syncUpdateMeeting(id, patch),
      );
    }
  },
  deleteMeeting: (id) => {
    set((s) => ({ meetings: s.meetings.filter((x) => x.id !== id) }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/one-on-one-sync').then((mod) =>
        mod.syncDeleteMeeting(id),
      );
    }
  },
  addActionItem: (meetingId, text, assigneeId, dueDate) => {
    const itemId = crypto.randomUUID();
    set((s) => ({
      meetings: s.meetings.map((m) =>
        m.id !== meetingId
          ? m
          : {
              ...m,
              actionItems: [
                ...m.actionItems,
                { id: itemId, text, assigneeId, dueDate, done: false },
              ],
              updatedAt: Date.now(),
            },
      ),
    }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/one-on-one-sync').then((mod) =>
        mod.syncAddActionItem(meetingId, itemId, text, assigneeId, dueDate),
      );
    }
  },
  toggleActionItem: (meetingId, itemId) => {
    let nextDone = false;
    set((s) => ({
      meetings: s.meetings.map((m) => {
        if (m.id !== meetingId) return m;
        return {
          ...m,
          actionItems: m.actionItems.map((a) => {
            if (a.id !== itemId) return a;
            nextDone = !a.done;
            return { ...a, done: nextDone };
          }),
          updatedAt: Date.now(),
        };
      }),
    }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/one-on-one-sync').then((mod) =>
        mod.syncToggleActionItem(itemId, nextDone),
      );
    }
    // get(): silence lint about unused get; useful for future extensions
    void get;
  },
  removeActionItem: (meetingId, itemId) => {
    set((s) => ({
      meetings: s.meetings.map((m) =>
        m.id !== meetingId
          ? m
          : {
              ...m,
              actionItems: m.actionItems.filter((a) => a.id !== itemId),
              updatedAt: Date.now(),
            },
      ),
    }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/one-on-one-sync').then((mod) =>
        mod.syncDeleteActionItem(itemId),
      );
    }
  },
}));

// =============================================================================
// 360 评估 (2026-05-10 · OKR P1)
// =============================================================================
// 多源反馈: 自评 + 上级 + 平级 + 下级 + 跨部门
// 周期化: 季度/年度发起一轮 → 选评估对象和评估人 → 收集 → 聚合
// 维度可定制 (默认 8 个: 业绩/协作/创新/责任/沟通/学习/领导力/价值观)
// 评分: 1-5 + 文本 + 强项 + 改进点
// 匿名: peers 默认匿名, 主管/下级实名 (可选)
// =============================================================================

export type Review360RaterType = 'self' | 'manager' | 'peer' | 'report' | 'cross';
export type Review360CycleStatus = 'draft' | 'active' | 'closed';

export interface Review360Question {
  id: string;
  /** 维度 (业绩/协作/创新...) */
  dimension: string;
  /** 题干 */
  prompt: string;
  /** 是否要求评分 (1-5) */
  rated: boolean;
  /** 是否要求文字回答 */
  qualitative: boolean;
}

export interface Review360CycleDef {
  id: string;
  name: string;          // 'Q3-2025 360 评估' 等
  startDate: number;
  endDate: number;
  status: Review360CycleStatus;
  /** 评估题目 */
  questions: Review360Question[];
  /** peer 匿名 */
  anonymizePeers: boolean;
  createdAt: number;
}

export interface Review360Submission {
  id: string;
  cycleId: string;
  /** 被评估人 */
  subjectId: string;
  /** 评估人 (匿名时仍存, UI 不暴露) */
  raterId: string;
  raterType: Review360RaterType;
  /** 每题答案 */
  answers: {
    questionId: string;
    score?: number;       // 1-5
    text?: string;
  }[];
  /** 整体强项 (≥1 条) */
  strengths: string;
  /** 整体改进点 (≥1 条) */
  improvements: string;
  /** 总评分 (可选, 1-5) */
  overallScore?: number;
  submittedAt: number;
}

export interface Review360Assignment {
  id: string;
  cycleId: string;
  subjectId: string;
  raterId: string;
  raterType: Review360RaterType;
  /** 是否已提交 */
  submitted: boolean;
  submittedAt?: number;
}

interface Review360Store {
  cycles: Review360CycleDef[];
  assignments: Review360Assignment[];
  submissions: Review360Submission[];
  /** A2.3 hydration flag */
  _hydrated: boolean;
  /** A2.3 从 API 拉全量 */
  loadFromApi: () => Promise<void>;

  addCycle: (c: Omit<Review360CycleDef, 'id' | 'createdAt'>) => string;
  updateCycle: (id: string, patch: Partial<Review360CycleDef>) => void;
  deleteCycle: (id: string) => void;
  /** 添加评估关系 (subject 由谁评) */
  addAssignment: (a: Omit<Review360Assignment, 'id' | 'submitted' | 'submittedAt'>) => void;
  removeAssignment: (id: string) => void;
  submitReview: (s: Omit<Review360Submission, 'id' | 'submittedAt'>) => void;
}

const DEFAULT_360_QUESTIONS: Review360Question[] = [
  { id: 'q-perf', dimension: '业绩', prompt: '在过去周期内, 该同事的核心产出/目标完成度如何?', rated: true, qualitative: true },
  { id: 'q-collab', dimension: '协作', prompt: '在跨团队配合中表现如何? 是否主动拉动协作?', rated: true, qualitative: true },
  { id: 'q-innovate', dimension: '创新', prompt: '是否带来过新方法/新工具/新思路?', rated: true, qualitative: false },
  { id: 'q-own', dimension: '责任', prompt: '面对模糊问题或意外情况时, 是否主动 ownership?', rated: true, qualitative: false },
  { id: 'q-comm', dimension: '沟通', prompt: '表达是否清晰? 倾听是否充分? 是否能在分歧中达成共识?', rated: true, qualitative: true },
  { id: 'q-learn', dimension: '学习', prompt: '是否在主动迭代自己的能力 / 复盘失败?', rated: true, qualitative: false },
  { id: 'q-lead', dimension: '领导力', prompt: '能否带动他人 / 提供方向 (即便没正式职称)?', rated: true, qualitative: false },
  { id: 'q-values', dimension: '价值观', prompt: '行为是否与组织价值观一致 (诚信/客户/敬业...)?', rated: true, qualitative: false },
];

export { DEFAULT_360_QUESTIONS };

/**
 * A2.3: 真后端切换. 同 useOneOnOneStore 模式 — drop persist + dual-write.
 */
export const useReview360Store = create<Review360Store>()((set) => ({
  cycles: [],
  assignments: [],
  submissions: [],
  _hydrated: false,
  loadFromApi: async () => {
    if (typeof window === 'undefined') return;
    const { loadAllFromApi } = await import('@/lib/api/review-360-sync');
    const data = await loadAllFromApi();
    set({ ...data, _hydrated: true });
  },

  addCycle: (c) => {
    const id = crypto.randomUUID();
    const cycle: Review360CycleDef = { id, createdAt: Date.now(), ...c };
    set((s) => ({ cycles: [...s.cycles, cycle] }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/review-360-sync').then((m) => m.syncCreateCycle(cycle));
    }
    return id;
  },
  updateCycle: (id, patch) => {
    set((s) => ({
      cycles: s.cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/review-360-sync').then((m) => m.syncUpdateCycle(id, patch));
    }
  },
  deleteCycle: (id) => {
    set((s) => ({
      cycles: s.cycles.filter((c) => c.id !== id),
      assignments: s.assignments.filter((a) => a.cycleId !== id),
      submissions: s.submissions.filter((sub) => sub.cycleId !== id),
    }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/review-360-sync').then((m) => m.syncDeleteCycle(id));
    }
  },

  addAssignment: (a) => {
    let created: Review360Assignment | null = null;
    set((s) => {
      const exists = s.assignments.some(
        (x) => x.cycleId === a.cycleId && x.subjectId === a.subjectId && x.raterId === a.raterId,
      );
      if (exists) return {};
      created = { id: crypto.randomUUID(), submitted: false, ...a };
      return { assignments: [...s.assignments, created] };
    });
    if (created && typeof window !== 'undefined') {
      const c = created as Review360Assignment;
      void import('@/lib/api/review-360-sync').then((m) => m.syncCreateAssignment(c));
    }
  },
  removeAssignment: (id) =>
    set((s) => ({ assignments: s.assignments.filter((a) => a.id !== id) })),

  submitReview: (sub) => {
    let created: Review360Submission | null = null;
    set((s) => {
      const id = crypto.randomUUID();
      const now = Date.now();
      const newSubs = s.submissions.filter(
        (x) => !(x.cycleId === sub.cycleId && x.subjectId === sub.subjectId && x.raterId === sub.raterId),
      );
      created = { id, submittedAt: now, ...sub };
      newSubs.push(created);
      const newAssigns = s.assignments.map((a) =>
        a.cycleId === sub.cycleId && a.subjectId === sub.subjectId && a.raterId === sub.raterId
          ? { ...a, submitted: true, submittedAt: now }
          : a,
      );
      return { submissions: newSubs, assignments: newAssigns };
    });
    if (created && typeof window !== 'undefined') {
      const c = created as Review360Submission;
      void import('@/lib/api/review-360-sync').then((m) => m.syncSubmitReview(c));
    }
  },
}));

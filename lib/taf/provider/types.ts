/**
 * TAF Layer 2 · LLM Provider Abstraction
 *
 * 任何 LLM 必须通过此接口接入. 一行配置切换模型.
 *
 * 对应 MANIFESTO 第十六条 (LLM 可热插拔, TAF 不可妥协)
 * 对应 AGENT-FRAMEWORK Layer 2
 */

// ---------------------------------------------------------------------------
// Message format (OpenAI 兼容为主标准)
// ---------------------------------------------------------------------------

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: MessageRole;
  content: string | ContentPart[];
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
  /**
   * §B-003 Anthropic Prompt Caching · ephemeral 标记
   *
   * 当走 Claude (含 OpenRouter / Bedrock OpenAI-compat 代理) 时, 该消息内容会以
   *   [{type:'text', text:..., cache_control:{type:'ephemeral'}}]
   * 形式发出, Anthropic 会缓存该前缀, 后续命中时输入 token 计费 90%+ 折扣.
   *
   * 典型用法: 大型 system prompt (CompanyBrain 等) 上挂. 不影响其它 provider (它们直接忽略).
   */
  cacheControl?: 'ephemeral';
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; imageUrl: { url: string } };

// ---------------------------------------------------------------------------
// Tools (Function Calling - Hermes / OpenAI 兼容)
// ---------------------------------------------------------------------------

export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolSchema[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  temperature?: number;
  maxTokens?: number;
  /**
   * §B-004 OpenAI Structured Outputs 支持
   *   'text' (默认) · 'json' (json_object 旧式) · { type:'json_schema', schema, name?, strict? } 新式
   *
   * 'json_schema' 强制 LLM 输出严格匹配 schema, 消灭 JSON.parse 失败的 bug.
   * 不支持的 provider (DeepSeek 早期 / Qwen) 会忽略, 退化到普通 text 输出, 调用方需自己 fallback.
   */
  responseFormat?:
    | 'text'
    | 'json'
    | {
        type: 'json_schema';
        name: string;
        schema: Record<string, unknown>;
        strict?: boolean;
      };
  stream?: boolean;
  /** 用于路由器选择模型 */
  scenario?: ScenarioTag;
  /** 强制使用指定 provider (中央AI/个人AI 偏好), 若未注册则 fallback 到 scenario 规则 */
  forceProvider?: string;
  /** 用户/会话 ID, 用于审计日志 */
  metadata?: {
    userId?: string;
    sessionId?: string;
    decisionCardId?: string;
    /** §IM-7 (CHARTER-FOUR-PILLARS) · 调用方 trace id, 透传到 LlmUsageLog.requestId. 例: IM 消息 id, 议事 cardId, ⌘K session id */
    requestId?: string;
  };
}

export type ScenarioTag =
  | 'reasoning_complex'    // 议事室 / 3+1 决策
  | 'tool_use'             // RAG / 工具调用
  | 'high_frequency'       // Check-in 草稿 / 通知
  | 'long_context'         // 复盘 / 历史回溯
  | 'persona_dialogue'     // 拿捏老板对话
  | 'agentic';             // 多步 Agent 任务

export interface ChatResponse {
  id: string;
  message: ChatMessage;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** 实际使用的模型 (路由后) */
  model: string;
  /** 估算成本 (RMB) */
  estimatedCostRmb?: number;
}

export interface ChatChunk {
  delta: Partial<ChatMessage>;
  finishReason?: 'stop' | 'length' | 'tool_calls';
}

// ---------------------------------------------------------------------------
// Provider 接口 (实现此接口即可接入新 LLM)
// ---------------------------------------------------------------------------

export interface ProviderCapabilities {
  chat: boolean;
  functionCalling: boolean;
  streaming: boolean;
  jsonMode: boolean;
  vision: boolean;
  maxContextTokens: number;
  /** 输入 token 单价 (RMB / 1M tokens) */
  inputPriceRmbPerM?: number;
  /** 输出 token 单价 */
  outputPriceRmbPerM?: number;
}

export interface LLMProvider {
  /** Provider 名称 (如 'deepseek-v3', 'qwen-max') */
  readonly name: string;
  /** 实际配置的底层模型名 (如 'claude-opus-4-8') — 日志/审计真实归因用 */
  readonly model?: string;
  /** 供路由器决策的能力声明 */
  readonly capabilities: ProviderCapabilities;

  /** 阻塞调用 */
  chat(req: ChatRequest): Promise<ChatResponse>;

  /** 流式调用 */
  chatStream(req: ChatRequest): AsyncIterable<ChatChunk>;

  /** Token 计算 */
  countTokens(text: string): Promise<number>;

  /** 健康检查 */
  healthCheck(): Promise<{ healthy: boolean; latencyMs?: number; error?: string }>;
}

// ---------------------------------------------------------------------------
// Provider 配置
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  name: string;
  /** OpenAI 兼容接口的 base URL */
  baseUrl: string;
  /** 模型名 (如 'deepseek-chat', 'qwen-max-2025-01-25') */
  model: string;
  /** API key (从环境变量或 secret manager 注入) */
  apiKey: string;
  /** 自定义 headers */
  headers?: Record<string, string>;
  /** 默认 temperature */
  temperature?: number;
  /** 默认 max tokens */
  maxTokens?: number;
  capabilities: ProviderCapabilities;
}

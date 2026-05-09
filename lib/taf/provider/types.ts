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
  responseFormat?: 'text' | 'json';
  stream?: boolean;
  /** 用于路由器选择模型 */
  scenario?: ScenarioTag;
  /** 用户/会话 ID, 用于审计日志 */
  metadata?: {
    userId?: string;
    sessionId?: string;
    decisionCardId?: string;
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

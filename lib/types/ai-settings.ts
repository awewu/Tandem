/**
 * AiSettings · 系统级 AI 配置 (可通过 Admin UI 热更新, 无需重启服务)
 *
 * 优先级 (高 → 低):
 *   1. DB 中存储的配置 (本文件所描述的 AiSettings)
 *   2. .env / 环境变量 (兜底, 适合初次部署)
 *
 * 存储于 KvStore (collection = 'aiSettings', id = tenantId).
 */

export interface AiSettings {
  id: string;
  tenantId: string;

  /**
   * 中继站网关 (OpenAI 兼容直通) — 换模型/换中继站只改这几项即可, 无需重启/改码.
   * 配了 baseUrl + model 即启用, 启用后成为所有场景首选 (其余 provider 降级 fallback).
   * 优先级高于下方各家 provider; 留空则回退到 LLM_GATEWAY_* 环境变量, 再回退到分家配置.
   */
  gatewayEnabled?: boolean;
  gatewayBaseUrl?: string;
  gatewayModel?: string;
  gatewayApiKey?: string;
  /** false = 中继站不支持 function calling (带 tools 的请求自动绕开网关走 fallback) */
  gatewayTools?: boolean;

  /** DeepSeek Chat/R1 */
  deepseekApiKey?: string;
  deepseekBaseUrl?: string;
  deepseekModel?: string;
  deepseekR1Model?: string;

  /** Anthropic (Claude) */
  anthropicApiKey?: string;
  anthropicBaseUrl?: string;
  anthropicModel?: string;

  /** Qwen (通义千问) */
  qwenApiKey?: string;
  qwenBaseUrl?: string;
  qwenModel?: string;

  /** Doubao (豆包) */
  doubaoApiKey?: string;
  doubaoBaseUrl?: string;
  doubaoModel?: string;

  /** Kimi */
  kimiApiKey?: string;
  kimiBaseUrl?: string;
  kimiModel?: string;

  /** 本地 Hermes / Ollama */
  hermesBaseUrl?: string;
  hermesModel?: string;

  /** Embedding */
  embeddingProvider?: 'openai' | 'ollama' | 'none';
  embeddingModel?: string;
  embeddingApiUrl?: string;
  embeddingApiKey?: string;

  /** 语音转写 (STT) · 对标 Get笔记 语音转笔记. OpenAI Whisper 兼容协议 */
  sttProvider?: 'openai' | 'none';
  sttModel?: string;
  sttApiUrl?: string;
  sttApiKey?: string;

  /** Web 搜索 */
  tavilyApiKey?: string;
  braveSearchApiKey?: string;
  /** 联网回答开关 (preSearchLayer): 关闭时跳过所有 web_search 调用 */
  webSearchEnabled?: boolean;
  /** 主动爬取学习开关: 允许 AI 定时/按需抓取外部网页存入公司知识库 */
  webLearnEnabled?: boolean;

  /** SMTP 邮件 */
  smtpHost?: string;
  smtpPort?: string;
  imapPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  smtpSecure?: string;

  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AiSettingsPatch = Partial<
  Omit<AiSettings, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
>;

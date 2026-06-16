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

  /** Web 搜索 */
  tavilyApiKey?: string;
  braveSearchApiKey?: string;

  /** SMTP 邮件 */
  smtpHost?: string;
  smtpPort?: string;
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

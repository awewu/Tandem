/**
 * 增长中枢 · E3 GEO 引擎注册表（多引擎覆盖）。
 *
 * 对标好现/百原/思渡的「8–14 家 AI 引擎同步监测」，把国内外主流生成式引擎固化为规范枚举。
 * 真实在线探测需各平台凭证（环境变量），未配置 → not-configured（连接器架构，与 OpinionSource 同策略）；
 * 无凭证时仍可对「调用方传入的答案快照」离线分析，保证 source-contract 可运行、可测试。
 */

export interface GeoEngineDef {
  engine: string;
  label: string;
  region: 'cn' | 'global';
  credentialEnv: string;
}

export const GEO_ENGINES: GeoEngineDef[] = [
  { engine: 'doubao', label: '豆包', region: 'cn', credentialEnv: 'GROWTH_GEO_DOUBAO_KEY' },
  { engine: 'deepseek', label: 'DeepSeek', region: 'cn', credentialEnv: 'GROWTH_GEO_DEEPSEEK_KEY' },
  { engine: 'yuanbao', label: '腾讯元宝', region: 'cn', credentialEnv: 'GROWTH_GEO_YUANBAO_KEY' },
  { engine: 'kimi', label: 'Kimi', region: 'cn', credentialEnv: 'GROWTH_GEO_KIMI_KEY' },
  { engine: 'qwen', label: '通义千问', region: 'cn', credentialEnv: 'GROWTH_GEO_QWEN_KEY' },
  { engine: 'wenxin', label: '文心一言', region: 'cn', credentialEnv: 'GROWTH_GEO_WENXIN_KEY' },
  { engine: 'perplexity', label: 'Perplexity', region: 'global', credentialEnv: 'GROWTH_GEO_PERPLEXITY_KEY' },
  { engine: 'chatgpt', label: 'ChatGPT / SearchGPT', region: 'global', credentialEnv: 'GROWTH_GEO_OPENAI_KEY' },
  { engine: 'gemini', label: 'Gemini', region: 'global', credentialEnv: 'GROWTH_GEO_GEMINI_KEY' },
  { engine: 'grok', label: 'Grok', region: 'global', credentialEnv: 'GROWTH_GEO_GROK_KEY' },
  { engine: 'ai-overview', label: 'Google AI Overview', region: 'global', credentialEnv: 'GROWTH_GEO_AIO_KEY' },
];

export interface GeoEngineStatus extends GeoEngineDef {
  status: 'ready' | 'not-configured';
}

export function geoEngineStatuses(): GeoEngineStatus[] {
  return GEO_ENGINES.map((e) => ({
    ...e,
    status: process.env[e.credentialEnv] ? 'ready' : 'not-configured',
  }));
}

export function isKnownEngine(engine: string): boolean {
  return GEO_ENGINES.some((e) => e.engine === engine);
}

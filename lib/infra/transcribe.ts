/**
 * Speech-to-Text Service · 语音转写
 *
 * 对标 Get笔记 的"语音转笔记". OpenAI Whisper 兼容协议 (multipart/form-data)。
 *
 * 配置优先级 (高 → 低):
 *   1. DB AiSettings (Admin UI 热更新)
 *   2. 环境变量 STT_PROVIDER / STT_MODEL / STT_API_URL / STT_API_KEY
 *
 * 未配置时: isSttConfigured() → false, 调用方应提示用户"未配置语音转写"。
 * 永不抛裸错: transcribe 失败返回 { ok:false, error }。
 */

import { logger } from './logger';

async function resolveSttConfig(): Promise<{
  provider: string;
  model: string;
  url: string;
  apiKey: string | undefined;
}> {
  try {
    const { getAiSettings } = await import('@/lib/settings/ai-settings');
    const s = await getAiSettings();
    return {
      provider: s.sttProvider ?? process.env.STT_PROVIDER ?? 'none',
      model: s.sttModel ?? process.env.STT_MODEL ?? 'whisper-1',
      url: s.sttApiUrl ?? process.env.STT_API_URL ?? 'https://api.openai.com/v1/audio/transcriptions',
      apiKey: s.sttApiKey ?? process.env.STT_API_KEY ?? process.env.OPENAI_API_KEY,
    };
  } catch {
    return {
      provider: process.env.STT_PROVIDER ?? 'none',
      model: process.env.STT_MODEL ?? 'whisper-1',
      url: process.env.STT_API_URL ?? 'https://api.openai.com/v1/audio/transcriptions',
      apiKey: process.env.STT_API_KEY ?? process.env.OPENAI_API_KEY,
    };
  }
}

export async function isSttConfigured(): Promise<boolean> {
  const { provider, apiKey } = await resolveSttConfig();
  return provider !== 'none' && Boolean(apiKey);
}

export interface TranscribeResult {
  ok: boolean;
  text?: string;
  error?: string;
}

/**
 * 转写一段音频. audio 为二进制 (Blob/Buffer), filename 决定后端识别的格式.
 * language 可选 (如 'zh'), 提升中文识别准确率.
 */
export async function transcribe(
  audio: Blob,
  filename = 'audio.webm',
  language?: string,
): Promise<TranscribeResult> {
  const cfg = await resolveSttConfig();
  if (cfg.provider === 'none' || !cfg.apiKey) {
    return { ok: false, error: '未配置语音转写 (STT), 请在 AI 设置中配置' };
  }

  try {
    const form = new FormData();
    form.append('file', audio, filename);
    form.append('model', cfg.model);
    if (language) form.append('language', language);

    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.warn({ status: res.status }, '[transcribe] http error');
      return { ok: false, error: `转写服务返回 HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}` };
    }
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? '').trim();
    if (!text) return { ok: false, error: '转写结果为空' };
    return { ok: true, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ err: msg }, '[transcribe] failed');
    return { ok: false, error: `转写失败: ${msg}` };
  }
}

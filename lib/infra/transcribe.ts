/**
 * Speech-to-Text Service · 语音转写
 *
 * 对标 Get笔记 的"语音转笔记". 支持 OpenAI Whisper 兼容协议与 DashScope Qwen-ASR。
 *
 * 配置优先级 (高 → 低):
 *   1. DB AiSettings (Admin UI 热更新)
 *   2. 环境变量 STT_PROVIDER / STT_MODEL / STT_API_URL / STT_API_KEY
 *
 * 未配置时: isSttConfigured() → false, 调用方应提示用户"未配置语音转写"。
 * 永不抛裸错: transcribe 失败返回 { ok:false, error }。
 */

import { logger } from './logger';

type SttProvider = 'none' | 'openai' | 'dashscope';

async function resolveSttConfig(): Promise<{
  provider: SttProvider | string;
  model: string;
  url: string;
  apiKey: string | undefined;
}> {
  try {
    const { getAiSettings } = await import('@/lib/settings/ai-settings');
    const s = await getAiSettings();
    const provider = s.sttProvider ?? process.env.STT_PROVIDER ?? 'none';
    return {
      provider,
      model: s.sttModel ?? process.env.STT_MODEL ?? (provider === 'dashscope' ? 'qwen3-asr-flash' : 'whisper-1'),
      url:
        s.sttApiUrl ??
        process.env.STT_API_URL ??
        (provider === 'dashscope'
          ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
          : 'https://api.openai.com/v1/audio/transcriptions'),
      apiKey:
        s.sttApiKey ??
        process.env.STT_API_KEY ??
        process.env.DASHSCOPE_API_KEY ??
        process.env.QWEN_API_KEY ??
        process.env.OPENAI_API_KEY,
    };
  } catch {
    const provider = process.env.STT_PROVIDER ?? 'none';
    return {
      provider,
      model: process.env.STT_MODEL ?? (provider === 'dashscope' ? 'qwen3-asr-flash' : 'whisper-1'),
      url:
        process.env.STT_API_URL ??
        (provider === 'dashscope'
          ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
          : 'https://api.openai.com/v1/audio/transcriptions'),
      apiKey:
        process.env.STT_API_KEY ??
        process.env.DASHSCOPE_API_KEY ??
        process.env.QWEN_API_KEY ??
        process.env.OPENAI_API_KEY,
    };
  }
}

function isSupportedProvider(provider: string): provider is SttProvider {
  return provider === 'openai' || provider === 'dashscope';
}

export async function isSttConfigured(): Promise<boolean> {
  const { provider, apiKey } = await resolveSttConfig();
  return isSupportedProvider(provider) && Boolean(apiKey);
}

export async function getSttStatus(): Promise<{
  configured: boolean;
  provider: string;
  model: string;
  url: string;
  supportedProviders: SttProvider[];
}> {
  const cfg = await resolveSttConfig();
  return {
    configured: isSupportedProvider(cfg.provider) && Boolean(cfg.apiKey),
    provider: cfg.provider,
    model: cfg.model,
    url: cfg.url,
    supportedProviders: ['openai', 'dashscope'],
  };
}

export interface TranscribeResult {
  ok: boolean;
  text?: string;
  error?: string;
}

function buildDashScopeChatCompletionsUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
}

function buildDashScopeNativeGenerationUrl(originUrl: URL): string {
  return `${originUrl.origin}/api/v1/services/aigc/multimodal-generation/generation`;
}

function resolveDashScopeEndpoint(url: string): { url: string; mode: 'native' | 'compatible' } {
  const trimmed = url.trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(trimmed);
    const isOfficialDashScope = /(^|\.)dashscope(?:-intl)?\.aliyuncs\.com$/i.test(parsed.hostname);
    if (isOfficialDashScope) {
      return { url: buildDashScopeNativeGenerationUrl(parsed), mode: 'native' };
    }
    if (parsed.pathname.includes('/services/aigc/multimodal-generation/generation')) {
      return { url: trimmed, mode: 'native' };
    }
  } catch {
    // Fall back to the OpenAI-compatible shape for custom gateway URLs.
  }
  return { url: buildDashScopeChatCompletionsUrl(trimmed), mode: 'compatible' };
}

function inferAudioMimeType(audio: Blob, filename: string): string {
  const blobType = audio.type.split(';')[0]?.trim();
  if (blobType) return blobType;

  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const byExt: Record<string, string> = {
    aac: 'audio/aac',
    amr: 'audio/amr',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    mp4: 'audio/mp4',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    wav: 'audio/wav',
    webm: 'audio/webm',
  };
  return byExt[ext] ?? 'audio/webm';
}

function extractDashScopeText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const root = data as Record<string, unknown>;
  if (typeof root.text === 'string') return root.text.trim();

  const output = root.output;
  if (output && typeof output === 'object' && typeof (output as Record<string, unknown>).text === 'string') {
    return ((output as Record<string, unknown>).text as string).trim();
  }

  const outputChoices = output && typeof output === 'object'
    ? (output as Record<string, unknown>).choices
    : undefined;
  const choices = Array.isArray(outputChoices) ? outputChoices : root.choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';
  const first = choices[0] as Record<string, unknown>;
  const message = first.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const record = part as Record<string, unknown>;
      return typeof record.text === 'string' ? record.text : '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function buildDashScopeSystemPrompt(language: string | undefined): string {
  const languageHint = language === 'zh' ? '中文普通话' : '用户音频中的原始语言';
  return [
    `你是高准确率语音识别引擎，请逐字转写${languageHint}音频。`,
    '只输出音频里真实说出的文字，不要总结、不要润色、不要扩写。',
    '短句也要完整识别，不要因为音频短就输出“嗯”“啊”等占位语气词。',
  ].join('');
}

async function transcribeWithDashScope(
  audio: Blob,
  filename: string,
  language: string | undefined,
  cfg: { model: string; url: string; apiKey: string },
): Promise<TranscribeResult> {
  const mimeType = inferAudioMimeType(audio, filename);
  const base64 = Buffer.from(await audio.arrayBuffer()).toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const endpoint = resolveDashScopeEndpoint(cfg.url);
  const prompt = buildDashScopeSystemPrompt(language);
  const body = endpoint.mode === 'native'
    ? {
        model: cfg.model,
        input: {
          messages: [
            {
              role: 'system',
              content: [{ text: prompt }],
            },
            {
              role: 'user',
              content: [{ audio: dataUrl }],
            },
          ],
        },
        parameters: {
          asr_options: {
            ...(language ? { language } : { enable_lid: true }),
            enable_itn: false,
          },
        },
      }
    : {
        model: cfg.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content: prompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: {
                  data: dataUrl,
                },
              },
            ],
          },
        ],
        asr_options: {
          ...(language ? { language } : { enable_lid: true }),
          enable_itn: false,
        },
      };

  const res = await fetch(endpoint.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.warn({ status: res.status }, '[transcribe:dashscope] http error');
    return { ok: false, error: `转写服务返回 HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}` };
  }

  const data = (await res.json()) as unknown;
  const text = extractDashScopeText(data);
  if (!text) return { ok: false, error: '转写结果为空' };
  return { ok: true, text };
}

async function transcribeWithOpenAiMultipart(
  audio: Blob,
  filename: string,
  language: string | undefined,
  cfg: { model: string; url: string; apiKey: string },
): Promise<TranscribeResult> {
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
    logger.warn({ status: res.status }, '[transcribe:openai] http error');
    return { ok: false, error: `转写服务返回 HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}` };
  }
  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? '').trim();
  if (!text) return { ok: false, error: '转写结果为空' };
  return { ok: true, text };
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
  if (!isSupportedProvider(cfg.provider)) {
    return { ok: false, error: `不支持的语音转写 Provider: ${cfg.provider}` };
  }

  try {
    if (cfg.provider === 'dashscope') {
      return await transcribeWithDashScope(audio, filename, language, { ...cfg, apiKey: cfg.apiKey });
    }
    return await transcribeWithOpenAiMultipart(audio, filename, language, { ...cfg, apiKey: cfg.apiKey });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ err: msg }, '[transcribe] failed');
    return { ok: false, error: `转写失败: ${msg}` };
  }
}

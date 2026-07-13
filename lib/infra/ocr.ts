/**
 * Image OCR Service · 图片文字识别
 *
 * 对标 Get笔记 的"拍照记 / 智能拍书": 拍一张图 (课本/白板/文档/名片/纸质笔记),
 * 用多模态 (vision) 模型把图里的文字转成可编辑的 Markdown 文本。
 *
 * 走 OpenAI 兼容的 vision chat completions 协议 (messages 里带 image_url data URL)。
 *
 * 配置优先级 (高 → 低):
 *   1. DB AiSettings (Admin UI 热更新): ocrProvider / ocrModel / ocrApiUrl / ocrApiKey
 *   2. 环境变量 OCR_PROVIDER / OCR_MODEL / OCR_API_URL / OCR_API_KEY
 *
 * 未配置时: isOcrConfigured() → false, 调用方应提示"未配置图片识别"。
 * 永不抛裸错: ocrImage 失败返回 { ok:false, error }。
 */

import { logger } from './logger';

async function resolveOcrConfig(): Promise<{
  provider: string;
  model: string;
  url: string;
  apiKey: string | undefined;
}> {
  try {
    const { getAiSettings } = await import('@/lib/settings/ai-settings');
    const s = await getAiSettings();
    return {
      provider: s.ocrProvider ?? process.env.OCR_PROVIDER ?? 'none',
      model: s.ocrModel ?? process.env.OCR_MODEL ?? 'gpt-4o-mini',
      url: s.ocrApiUrl ?? process.env.OCR_API_URL ?? 'https://api.openai.com/v1/chat/completions',
      apiKey: s.ocrApiKey ?? process.env.OCR_API_KEY ?? process.env.OPENAI_API_KEY,
    };
  } catch {
    return {
      provider: process.env.OCR_PROVIDER ?? 'none',
      model: process.env.OCR_MODEL ?? 'gpt-4o-mini',
      url: process.env.OCR_API_URL ?? 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OCR_API_KEY ?? process.env.OPENAI_API_KEY,
    };
  }
}

export async function isOcrConfigured(): Promise<boolean> {
  const { provider, apiKey } = await resolveOcrConfig();
  return provider !== 'none' && Boolean(apiKey);
}

export interface OcrResult {
  ok: boolean;
  text?: string;
  error?: string;
}

const OCR_SYSTEM = [
  '你是图片文字识别 (OCR) 助手。用户会给你一张图片 (课本/白板/PPT/文档/名片/手写纸质笔记等)。',
  '请把图片里的**全部文字**准确提取出来，输出为整洁的 Markdown：',
  '- 忠实转录，不增删、不总结、不翻译、不点评。',
  '- 保留原有的标题层级、列表、表格结构 (表格用 Markdown 表格)。',
  '- 手写体尽力辨认；实在无法辨认的字用 [?] 占位。',
  '- 如果图片里没有任何文字，只回复：（图片中未识别到文字）。',
  '- 直接输出转录内容，不要任何解释性开场白。',
].join('\n');

/**
 * 识别一张图片里的文字. imageDataUrl 必须是 data URL (data:image/png;base64,....).
 * 返回 Markdown 文本. 失败返回 { ok:false, error }.
 */
export async function ocrImage(imageDataUrl: string): Promise<OcrResult> {
  const cfg = await resolveOcrConfig();
  if (cfg.provider === 'none' || !cfg.apiKey) {
    return { ok: false, error: '未配置图片识别 (OCR), 请在 AI 设置中配置 vision 模型' };
  }
  if (!/^data:image\//.test(imageDataUrl)) {
    return { ok: false, error: '图片格式无效 (需 data URL)' };
  }

  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: OCR_SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: '请提取这张图片里的全部文字：' },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.warn({ status: res.status }, '[ocr] http error');
      return { ok: false, error: `识别服务返回 HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}` };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = (data.choices?.[0]?.message?.content ?? '').trim();
    if (!text) return { ok: false, error: '识别结果为空' };
    return { ok: true, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ err: msg }, '[ocr] failed');
    return { ok: false, error: `识别失败: ${msg}` };
  }
}

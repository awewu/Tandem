/**
 * 搭字手抄 · 语音转笔记 (对标 Get笔记 核心场景)
 *
 *   POST /api/shouchao/transcribe   multipart/form-data
 *     file: 音频文件 (webm/mp3/m4a/wav...)
 *     polish?: 'true' | 'false'   是否让 AI 把口述稿润色成结构化笔记 (默认 false)
 *     language?: 'zh'             可选, 提升识别准确率
 *
 * 仅转写, 不自动落库 (前端拿到 text 后可编辑再保存, 体验更可控)。
 * 转写未配置 / 失败诚实返回错误。AI 润色失败时降级返回原始转写稿。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { transcribe, isSttConfigured } from '@/lib/infra/transcribe';

export const runtime = 'nodejs';
export const maxDuration = 120;

const POLISH_SYSTEM = [
  '你是口述笔记整理助手。用户会给你一段语音转写的原始文字（可能有口语化、重复、错别字）。',
  '请整理成一篇通顺的中文笔记：',
  '- 去掉口头语、重复、嗯啊等语气词；修正明显的同音错别字。',
  '- 保留全部信息点，不删减事实，不编造内容。',
  '- 用 Markdown 适度分段/列点，便于日后阅读。',
  '- 直接输出整理后的笔记正文，不要解释你做了什么。',
].join('\n');

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  if (!(await isSttConfigured())) {
    return NextResponse.json(
      { ok: false, error: '未配置语音转写 (STT)，请在 AI 设置中配置 Whisper 兼容服务' },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: '请用 multipart/form-data 上传音频' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: 'file 必填 (音频)' }, { status: 400 });
  }
  // 上限 25MB (Whisper 单文件限制)
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: '音频超过 25MB，请分段上传' }, { status: 413 });
  }

  const polish = String(form.get('polish') ?? '') === 'true';
  const language = (form.get('language') as string | null)?.trim() || undefined;
  const filename = file instanceof File && file.name ? file.name : 'audio.webm';

  const result = await transcribe(file, filename, language);
  if (!result.ok || !result.text) {
    return NextResponse.json({ ok: false, error: result.error ?? '转写失败' }, { status: 502 });
  }

  if (!polish) {
    return NextResponse.json({ ok: true, text: result.text, polished: false });
  }

  // AI 润色: 失败降级返回原始转写稿
  try {
    const { createDefaultRouter } = await import('@/lib/taf');
    const router = createDefaultRouter();
    const resp = await router.chat({
      messages: [
        { role: 'system', content: POLISH_SYSTEM },
        { role: 'user', content: result.text },
      ],
      scenario: 'high_frequency',
      temperature: 0.3,
      maxTokens: 1200,
      metadata: { userId: auth.userId, requestId: 'shouchao:transcribe-polish' },
    });
    const polished = typeof resp.message.content === 'string' ? resp.message.content.trim() : '';
    return NextResponse.json({
      ok: true,
      text: polished || result.text,
      raw: result.text,
      polished: Boolean(polished),
    });
  } catch {
    return NextResponse.json({ ok: true, text: result.text, polished: false });
  }
}

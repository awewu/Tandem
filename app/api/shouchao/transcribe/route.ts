/**
 * 搭字手抄 · 语音转笔记 (对标 Get笔记 核心场景)
 *
 *   POST /api/shouchao/transcribe   multipart/form-data
 *     file: 音频文件 (webm/mp3/m4a/wav...)
 *     polish?: 'true' | 'false'   是否让 AI 把口述稿润色成结构化笔记 (默认 false)
 *     meeting?: 'true' | 'false'  会议模式: 把转写稿整理成会议纪要 (要点/决策/待办)。
 *                                 与 polish 互斥, meeting 优先。
 *     language?: 'zh'             可选, 提升识别准确率
 *
 * 仅转写, 不自动落库 (前端拿到 text 后可编辑再保存, 体验更可控)。
 * 转写未配置 / 失败诚实返回错误。AI 加工失败时降级返回原始转写稿。
 *
 * 说明: 说话人分离 (diarization) 与音频留存回放需要底层 STT 支持 + 对象存储,
 * 本接口暂只做单流转写 + AI 纪要结构化 (见 backlog)。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { bootHotPath } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { transcribe, isSttConfigured, getSttStatus } from '@/lib/infra/transcribe';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { normalizeVoiceTranscriptionText } from '@/lib/shouchao/voice-note';

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

const MEETING_SYSTEM = [
  '你是会议纪要助手。用户会给你一段会议/讨论的语音转写原始文字（可能有口语化、重复、错别字，可能多人对话但未标注说话人）。',
  '请整理成一份结构清晰的中文会议纪要，用 Markdown 输出，包含以下小节（无内容的小节可省略）：',
  '## 一句话摘要',
  '## 关键讨论要点（列点）',
  '## 决策事项（列点，写清结论）',
  '## 待办事项（列点，尽量标注负责人与期限，若原文未提及则不编造）',
  '## 待议/悬而未决（列点）',
  '规则：忠于原文，不编造未提及的事实；修正明显错别字；去掉口水词。直接输出纪要，不要解释你做了什么。',
].join('\n');

async function POSTApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  bootHotPath();

  if (!(await isSttConfigured())) {
    return NextResponse.json(
      { ok: false, error: '未配置语音转写 (STT)，请在 AI 设置中配置 OpenAI Whisper 或 DashScope 千问 ASR' },
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

  const meeting = String(form.get('meeting') ?? '') === 'true';
  const polish = String(form.get('polish') ?? '') === 'true';
  const language = (form.get('language') as string | null)?.trim() || undefined;
  const filename = file instanceof File && file.name ? file.name : 'audio.webm';

  const result = await transcribe(file, filename, language);
  if (!result.ok || !result.text) {
    return NextResponse.json({ ok: false, error: result.error ?? '转写失败' }, { status: 502 });
  }

  // meeting 优先; 都没开则直接返回原始转写稿
  if (!meeting && !polish) {
    return NextResponse.json({ ok: true, text: normalizeVoiceTranscriptionText(result.text), mode: 'raw' });
  }

  const mode = meeting ? 'meeting' : 'polish';
  const system = meeting ? MEETING_SYSTEM : POLISH_SYSTEM;
  // AI 加工: 失败降级返回原始转写稿
  try {
    const { createDefaultRouter } = await import('@/lib/taf');
    const router = createDefaultRouter();
    const resp = await router.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: result.text },
      ],
      scenario: meeting ? 'long_context' : 'high_frequency',
      temperature: 0.3,
      maxTokens: meeting ? 1800 : 1200,
      metadata: { userId: auth.userId, requestId: `shouchao:transcribe-${mode}` },
    });
    const processed = typeof resp.message.content === 'string'
      ? normalizeVoiceTranscriptionText(resp.message.content)
      : '';
    return NextResponse.json({
      ok: true,
      text: processed || normalizeVoiceTranscriptionText(result.text),
      raw: result.text,
      mode: processed ? mode : 'raw',
      polished: Boolean(processed),
    });
  } catch {
    return NextResponse.json({ ok: true, text: result.text, mode: 'raw', polished: false });
  }
}

async function GETApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  bootHotPath();
  const status = await getSttStatus();

  return NextResponse.json({
    ok: true,
    configured: status.configured,
    provider: status.provider,
    model: status.model,
    url: status.url,
    supportedProviders: status.supportedProviders,
    required: [
      'STT_PROVIDER=dashscope',
      'STT_MODEL=qwen3-asr-flash',
      'STT_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1',
      'STT_API_KEY',
    ],
  });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/shouchao/transcribe' });
export const POST = withApiLog(POSTApiHandler, { route: '/api/shouchao/transcribe' });

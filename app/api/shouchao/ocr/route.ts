/**
 * 搭子手抄 · 图片拍照记 (对标 Get笔记 拍照记/智能拍书)
 *
 *   POST /api/shouchao/ocr   multipart/form-data
 *     file: 图片文件 (png/jpg/webp/heic...)
 *
 * 用多模态模型把图片里的文字识别成 Markdown 文本, 仅返回 text (不自动落库),
 * 前端拿到后可编辑再保存, 体验更可控。
 * OCR 未配置 / 失败诚实返回错误, 不伪造内容 (避免假闭环)。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { ocrImage, isOcrConfigured } from '@/lib/infra/ocr';

export const runtime = 'nodejs';
export const maxDuration = 60;

// 图片上限 10MB (data URL base64 会膨胀 ~33%, 控制请求体与模型成本)
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED = /^image\/(png|jpe?g|webp|gif|bmp|heic|heif)$/i;

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await boot();

  if (!(await isOcrConfigured())) {
    return NextResponse.json(
      { ok: false, error: '未配置图片识别 (OCR)，请在 AI 设置中配置 vision 模型' },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: '请用 multipart/form-data 上传图片' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'file 必填 (图片)' }, { status: 400 });
  }
  const mime = file.type || 'image/png';
  if (!ALLOWED.test(mime)) {
    return NextResponse.json({ ok: false, error: `不支持的图片类型：${mime}` }, { status: 415 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { ok: false, error: `图片超过 ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB，请压缩后再试` },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`;

  const result = await ocrImage(dataUrl);
  if (!result.ok || !result.text) {
    return NextResponse.json({ ok: false, error: result.error ?? '识别失败' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, text: result.text });
}

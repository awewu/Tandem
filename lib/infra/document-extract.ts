/**
 * 文档文本抽取 · 搭字手抄"上传文件转笔记" (对标 Get笔记/Notion 的文件导入)
 *
 * 服务端 (Node.js runtime) 把上传的文件抽成纯文本, 交给 import 路由的 LLM 提炼。
 *   - PDF  : pdfjs-dist legacy build, 无头逐页提取 textContent
 *   - Word : mammoth (.docx → 纯文本)
 *   - 纯文本/Markdown : 直接 UTF-8 解码
 *
 * 设计约束:
 *   - 永不抛裸错: 失败返回 { ok:false, error }, 由调用方诚实回传给用户。
 *   - 不依赖浏览器 worker: pdfjs 在 Node 下用 disableWorker 模式。
 *   - 体积/页数有上限, 防止超大文件拖垮服务端。
 */

export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_PDF_PAGES = 200;
const MAX_TEXT_CHARS = 200_000;

export type ExtractKind = 'pdf' | 'docx' | 'text';

export interface ExtractResult {
  ok: boolean;
  kind?: ExtractKind;
  title?: string;
  text?: string;
  error?: string;
}

/** 从文件名 + MIME 推断类型. 未知类型按纯文本兜底. */
export function detectKind(filename: string, mime?: string): ExtractKind | null {
  const name = (filename || '').toLowerCase();
  const m = (mime || '').toLowerCase();
  if (m.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  // 旧版 .doc 不支持, 显式拒绝 (注意: msword MIME 同时用于 .doc, 故先于 docx 判断)
  if (name.endsWith('.doc')) return null;
  if (
    m.includes('officedocument.wordprocessingml') ||
    name.endsWith('.docx')
  ) {
    return 'docx';
  }
  if (
    m.startsWith('text/') ||
    m.includes('markdown') ||
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.markdown')
  ) {
    return 'text';
  }
  // 没有明确 MIME 且无扩展名: 当作纯文本尝试
  if (!m && !/\.[a-z0-9]+$/.test(name)) return 'text';
  return null;
}

function clampText(s: string): string {
  const t = s.replace(/\u0000/g, '').replace(/[ \t\f\v]+/g, ' ').trim();
  return t.length > MAX_TEXT_CHARS ? t.slice(0, MAX_TEXT_CHARS) : t;
}

function baseTitle(filename: string): string {
  return (filename || '').replace(/\.[^.]+$/, '').trim().slice(0, 60) || '导入的文档';
}

async function extractPdf(bytes: Uint8Array, filename: string): Promise<ExtractResult> {
  // legacy build 在纯 Node 下可用; 关闭 worker 避免 DOM 依赖
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // @ts-expect-error legacy 类型与运行时入口存在差异
  const getDocument = pdfjs.getDocument ?? pdfjs.default?.getDocument;
  if (typeof getDocument !== 'function') {
    return { ok: false, error: 'PDF 解析器加载失败' };
  }
  // disableWorker 是运行时支持但未在 DocumentInitParameters 类型里声明的字段,
  // 在纯 Node 下关闭 worker 线程, 避免 DOM/Worker 依赖.
  const params = {
    data: bytes,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  } as Parameters<typeof getDocument>[0];
  const task = getDocument(params);
  const doc = await task.promise;
  try {
    const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
    const parts: string[] = [];
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const line = content.items
        .map((it: unknown) => (typeof (it as { str?: string }).str === 'string' ? (it as { str: string }).str : ''))
        .join(' ');
      if (line.trim()) parts.push(line);
      // 释放页面资源
      page.cleanup?.();
    }
    const text = clampText(parts.join('\n'));
    if (!text || text.length < 20) {
      return { ok: false, error: 'PDF 文本为空（可能是扫描件/图片型 PDF，暂不支持 OCR）' };
    }
    return { ok: true, kind: 'pdf', title: baseTitle(filename), text };
  } finally {
    await doc.destroy?.();
  }
}

async function extractDocx(bytes: Uint8Array, filename: string): Promise<ExtractResult> {
  const mammoth = await import('mammoth');
  const fn = mammoth.extractRawText ?? mammoth.default?.extractRawText;
  if (typeof fn !== 'function') {
    return { ok: false, error: 'Word 解析器加载失败' };
  }
  const buf = Buffer.from(bytes);
  const res = await fn({ buffer: buf });
  const text = clampText(typeof res?.value === 'string' ? res.value : '');
  if (!text || text.length < 20) {
    return { ok: false, error: 'Word 文档文本为空或过短' };
  }
  return { ok: true, kind: 'docx', title: baseTitle(filename), text };
}

function extractText(bytes: Uint8Array, filename: string): ExtractResult {
  const text = clampText(new TextDecoder('utf-8', { fatal: false }).decode(bytes));
  if (!text || text.length < 1) {
    return { ok: false, error: '文件内容为空' };
  }
  return { ok: true, kind: 'text', title: baseTitle(filename), text };
}

/**
 * 抽取上传文件的纯文本. 永不抛裸错.
 */
export async function extractDocument(
  bytes: Uint8Array,
  filename: string,
  mime?: string,
): Promise<ExtractResult> {
  if (!bytes || bytes.byteLength === 0) return { ok: false, error: '文件为空' };
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { ok: false, error: `文件过大（上限 ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB）` };
  }
  const kind = detectKind(filename, mime);
  if (kind === null) {
    return { ok: false, error: '不支持的文件类型（支持 PDF / .docx / 纯文本/Markdown）' };
  }
  try {
    if (kind === 'pdf') return await extractPdf(bytes, filename);
    if (kind === 'docx') return await extractDocx(bytes, filename);
    return extractText(bytes, filename);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '解析失败';
    return { ok: false, error: `文件解析失败：${msg}` };
  }
}

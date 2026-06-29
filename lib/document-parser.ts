/**
 * 统一文档解析器 — 把各种格式的文件读成纯文本字符串
 *
 * 支持：
 *  - .txt / .md / .markdown / .csv / .json / .log / .html / .xml / 其他纯文本   → 直接 readAsText
 *  - .docx (Word)                                                              → mammoth.extractRawText
 *  - .xlsx / .xls / .ods (Excel)                                              → xlsx.read → 每 sheet 转 CSV，拼接
 *  - .pptx (PowerPoint)                                                        → JSZip 解压 → 抽取 ppt/slides/*.xml 中所有 <a:t> 文本
 *  - .pdf                                                                      → pdfjs-dist 逐页 getTextContent
 *
 * 失败时 throw Error，调用方需要 try/catch 给出 toast 反馈。
 */

import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// pdfjs 必须在浏览器侧懒加载，且需要先指定 worker URL
async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist');
  // worker 文件由 postinstall 脚本拷贝到 public/，浏览器 + Tauri 都能取到
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
  return pdfjs;
}

export interface ParseResult {
  text: string;
  format: 'plain' | 'docx' | 'xlsx' | 'pptx' | 'pdf';
  bytes: number;
  pages?: number;
  sheets?: number;
}

const PLAIN_EXTS = new Set([
  'txt', 'md', 'markdown', 'csv', 'json', 'log',
  'html', 'htm', 'xml', 'yaml', 'yml', 'ini', 'conf',
  'js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'sql',
]);

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
    reader.readAsText(file);
  });
}

function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

async function parseDocx(file: File): Promise<ParseResult> {
  const buf = await readAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return { text: result.value.trim(), format: 'docx', bytes: file.size };
}

async function parseXlsx(file: File): Promise<ParseResult> {
  const buf = await readAsArrayBuffer(file);
  const wb = XLSX.read(buf, { type: 'array' });
  const sections: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) sections.push(`### Sheet: ${name}\n\n${csv}`);
  }
  return {
    text: sections.join('\n\n---\n\n').trim(),
    format: 'xlsx',
    bytes: file.size,
    sheets: wb.SheetNames.length,
  };
}

async function parsePptx(file: File): Promise<ParseResult> {
  const buf = await readAsArrayBuffer(file);
  const zip = await JSZip.loadAsync(buf);
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const ai = parseInt(a.match(/slide(\d+)/)?.[1] || '0', 10);
      const bi = parseInt(b.match(/slide(\d+)/)?.[1] || '0', 10);
      return ai - bi;
    });
  const sections: string[] = [];
  for (let i = 0; i < slidePaths.length; i++) {
    const xml = await zip.files[slidePaths[i]].async('string');
    // 抽取所有 <a:t>...</a:t> 节点文本（PPT XML 通用文字标签）
    const texts: string[] = [];
    const re = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const piece = m[1]
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      if (piece.trim()) texts.push(piece);
    }
    if (texts.length) sections.push(`### Slide ${i + 1}\n\n${texts.join('\n')}`);
  }
  return {
    text: sections.join('\n\n---\n\n').trim(),
    format: 'pptx',
    bytes: file.size,
    pages: slidePaths.length,
  };
}

async function parsePdf(file: File): Promise<ParseResult> {
  const pdfjs = await loadPdfJs();
  const buf = await readAsArrayBuffer(file);
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const sections: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it: any) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) sections.push(`### Page ${i}\n\n${text}`);
  }
  return {
    text: sections.join('\n\n---\n\n').trim(),
    format: 'pdf',
    bytes: file.size,
    pages: doc.numPages,
  };
}

/**
 * 清除 PostgreSQL text/jsonb 无法存储的 NUL 字节 (\u0000)。
 * PDF/旧 Office 文本抽取常产出 NUL，落库 (Postgres) 时会直接报错 → HTTP 500。
 * 本地 memory-store 不受影响，故必须在解析出口统一清洗 (对齐服务端 document-extract.ts)。
 */
function stripNul(text: string): string {
  return text.replace(/\u0000/g, '');
}

function sanitize(result: ParseResult): ParseResult {
  return { ...result, text: stripNul(result.text) };
}

/**
 * 解析单个文件为纯文本。失败 throw。
 * 自动根据扩展名分发到合适的 parser；未知扩展名按文本处理。
 */
export async function parseDocument(file: File): Promise<ParseResult> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'docx':
      return sanitize(await parseDocx(file));
    case 'xlsx':
    case 'xls':
    case 'ods':
      return sanitize(await parseXlsx(file));
    case 'pptx':
      return sanitize(await parsePptx(file));
    case 'pdf':
      return sanitize(await parsePdf(file));
    case 'doc':
      throw new Error('.doc（旧版 Word）不支持，请另存为 .docx 后再上传');
    case 'ppt':
      throw new Error('.ppt（旧版 PowerPoint）不支持，请另存为 .pptx 后再上传');
    default:
      if (PLAIN_EXTS.has(ext) || !ext) {
        const text = await readAsText(file);
        return { text: stripNul(text.trim()), format: 'plain', bytes: file.size };
      }
      // 未识别扩展名仍尝试当文本读
      const text = await readAsText(file);
      return { text: stripNul(text.trim()), format: 'plain', bytes: file.size };
  }
}

/** 用于 <input type="file" accept="..."> 的统一 accept 字符串 */
export const SUPPORTED_ACCEPT =
  '.txt,.md,.markdown,.csv,.json,.log,.html,.xml,.yaml,.yml,' +
  '.docx,.xlsx,.xls,.ods,.pptx,.pdf,' +
  'text/*';

export const SUPPORTED_LIST = 'TXT / MD / CSV / JSON / DOCX / XLSX / PPTX / PDF';

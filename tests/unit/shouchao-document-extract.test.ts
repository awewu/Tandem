import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { detectKind, extractDocument, MAX_FILE_BYTES } from '@/lib/infra/document-extract';

const ROOT = path.resolve(__dirname, '../..');

describe('detectKind', () => {
  it('识别 PDF（按 MIME 或扩展名）', () => {
    expect(detectKind('a.pdf', 'application/pdf')).toBe('pdf');
    expect(detectKind('a.PDF', '')).toBe('pdf');
  });
  it('识别 docx', () => {
    expect(
      detectKind('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe('docx');
    expect(detectKind('a.docx', '')).toBe('docx');
  });
  it('识别 pptx', () => {
    expect(
      detectKind('a.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'),
    ).toBe('pptx');
    expect(detectKind('a.pptx', '')).toBe('pptx');
  });
  it('识别 xlsx/xls', () => {
    expect(
      detectKind('a.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe('xlsx');
    expect(detectKind('a.xls', 'application/vnd.ms-excel')).toBe('xlsx');
  });
  it('识别纯文本/Markdown', () => {
    expect(detectKind('note.txt', 'text/plain')).toBe('text');
    expect(detectKind('note.md', '')).toBe('text');
  });
  it('旧版 .doc 与未知类型返回 null', () => {
    expect(detectKind('legacy.doc', 'application/msword')).toBeNull();
    expect(detectKind('image.png', 'image/png')).toBeNull();
  });
});

describe('extractDocument 守卫', () => {
  it('空文件诚实报错, 不抛裸错', async () => {
    const r = await extractDocument(new Uint8Array(0), 'x.txt', 'text/plain');
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('超大文件被拒绝', async () => {
    // 不真正分配 20MB+, 用一个 byteLength 撑大的视图代理即可触发体积校验
    const big = { byteLength: MAX_FILE_BYTES + 1 } as unknown as Uint8Array;
    const r = await extractDocument(big, 'big.txt', 'text/plain');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/过大/);
  });

  it('不支持的类型被拒绝', async () => {
    const r = await extractDocument(new Uint8Array([1, 2, 3, 4]), 'a.doc', 'application/msword');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/不支持/);
  });

  it('纯文本正常抽取', async () => {
    const text = '这是一段足够长的中文笔记内容，用于验证文本抽取路径可以正常工作。';
    const bytes = new TextEncoder().encode(text);
    const r = await extractDocument(bytes, 'note.txt', 'text/plain');
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('text');
    expect(r.text).toContain('中文笔记');
    expect(r.title).toBe('note');
  });

  it('PPTX 正常抽取 slide 文本', async () => {
    const zip = new JSZip();
    zip.file('ppt/slides/slide1.xml', '<p:sld><a:t>第一页标题</a:t><a:t>第一页要点&amp;数据</a:t></p:sld>');
    zip.file('ppt/slides/slide2.xml', '<p:sld><a:t>第二页行动计划</a:t></p:sld>');
    const bytes = new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));

    const r = await extractDocument(
      bytes,
      'strategy.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );

    expect(r.ok).toBe(true);
    expect(r.kind).toBe('pptx');
    expect(r.title).toBe('strategy');
    expect(r.text).toContain('### Slide 1');
    expect(r.text).toContain('第一页要点&数据');
    expect(r.text).toContain('### Slide 2');
  });

  it('Excel 正常抽取 sheet 文本', async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['姓名', '指标', '结果'],
      ['张三', '交付质量', '达标'],
      ['李四', '响应速度', '优秀'],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, '绩效');
    const bytes = new Uint8Array(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));

    const r = await extractDocument(
      bytes,
      'score.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    expect(r.ok).toBe(true);
    expect(r.kind).toBe('xlsx');
    expect(r.title).toBe('score');
    expect(r.text).toContain('### Sheet: 绩效');
    expect(r.text).toContain('张三,交付质量,达标');
  });
});

describe('extractDocument 真实文件', () => {
  const docx = path.join(ROOT, 'node_modules/mammoth/test/test-data/single-paragraph.docx');
  const pdf = path.join(ROOT, 'docs/PITCH-DECK.pdf');

  it.runIf(existsSync(docx))('解析真实 .docx (mammoth)', async () => {
    const bytes = new Uint8Array(readFileSync(docx));
    const r = await extractDocument(bytes, 'single-paragraph.docx');
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('docx');
    expect((r.text ?? '').length).toBeGreaterThan(0);
  });

  it.runIf(existsSync(pdf))('解析真实 PDF (pdfjs-dist)', async () => {
    const bytes = new Uint8Array(readFileSync(pdf));
    const r = await extractDocument(bytes, 'PITCH-DECK.pdf', 'application/pdf');
    expect(r.ok).toBe(true);
    expect(r.kind).toBe('pdf');
    expect((r.text ?? '').length).toBeGreaterThan(20);
  }, 30_000);
});

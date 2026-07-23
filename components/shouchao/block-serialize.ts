/**
 * 搭字手抄 · 块 ⇄ Markdown 纯序列化逻辑 (无 React 依赖, 可单测)
 *
 * 从 block-editor.tsx 抽出, 保证: 块编辑不破坏底层 content:string 模型,
 * parseMarkdown ⇄ serializeBlocks 往返幂等.
 */

export type BlockType =
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'ul'
  | 'ol'
  | 'todo'
  | 'quote'
  | 'code'
  | 'hr'
  | 'image'
  | 'table'
  | 'callout'
  | 'toggle';

/** callout 变体 (GitHub alert 语义) → 显示图标由编辑器映射 */
export type CalloutVariant = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  /** todo 专用 */
  checked?: boolean;
  /** image 专用: 图片 URL (serving URL 或外链) */
  src?: string;
  /** image 专用: 替代文字 (同时作为图注) */
  alt?: string;
  /** table 专用: 行 × 列 (第一行为表头) */
  rows?: string[][];
  /** callout 专用: 变体 (决定图标/配色) */
  calloutVariant?: CalloutVariant;
  /** toggle 专用: 展开状态; text = 摘要标题, 折叠体存 body */
  open?: boolean;
  /** toggle 专用: 折叠体正文 (可多行) */
  body?: string;
}

let _idCounter = 0;
export function newId(): string {
  _idCounter += 1;
  return `b${Date.now().toString(36)}_${_idCounter}`;
}

/** 计算某有序列表块在其连续 ol 段里的序号 (1-based). 遇到非 ol 块即重置. */
export function olOrdinal(blocks: Block[], idx: number): number {
  let n = 0;
  for (let i = 0; i <= idx; i++) {
    if (blocks[i].type === 'ol') n += 1;
    else n = 0;
  }
  return n;
}

/** GFM 表格行 → 单元格数组 (去掉首尾 | 后按 | 切分, 去空白). */
function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

/** 判断是否 GFM 表格分隔行, 如 | --- | :--: |. */
function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!t.includes('-')) return false;
  return /^\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?$/.test(t);
}

/** 把 Markdown 文本解析成 blocks. 容错: 不认识的行当段落. */
export function parseMarkdown(md: string): Block[] {
  const lines = (md ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    // 围栏代码块 (多行)
    if (/^```/.test(t)) {
      const codeBuf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeBuf.push(lines[i]);
        i++;
      }
      blocks.push({ id: newId(), type: 'code', text: codeBuf.join('\n') });
      continue;
    }

    // 折叠块 <details> (多行): <summary> 为标题, 其余为折叠体
    if (/^<details(\s|>)/.test(t)) {
      const open = /\bopen\b/.test(t);
      const inner: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '</details>') {
        inner.push(lines[i]);
        i++;
      }
      let title = '';
      const bodyLines: string[] = [];
      for (const raw of inner) {
        const m = raw.trim().match(/^<summary>(.*)<\/summary>$/);
        if (m && !title) title = m[1];
        else bodyLines.push(raw);
      }
      // 去掉折叠体首尾空行
      while (bodyLines.length && bodyLines[0].trim() === '') bodyLines.shift();
      while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();
      blocks.push({ id: newId(), type: 'toggle', text: title, body: bodyLines.join('\n'), open });
      continue;
    }

    // GFM 表格 (多行): 当前行含 | 且下一行是分隔行
    if (t.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const rows: string[][] = [splitTableRow(line)];
      i += 2; // 跳过表头 + 分隔行
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      i--; // 回退一格, for 循环会自增
      blocks.push({ id: newId(), type: 'table', text: '', rows });
      continue;
    }

    if (t === '') continue;

    const imgMatch = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    const calloutMatch = t.match(/^>\s*\[!(\w+)\]\s*(.*)$/);
    if (/^---+$/.test(t) || /^\*\*\*+$/.test(t)) {
      blocks.push({ id: newId(), type: 'hr', text: '' });
    } else if (imgMatch) {
      blocks.push({ id: newId(), type: 'image', text: '', alt: imgMatch[1], src: imgMatch[2] });
    } else if (calloutMatch) {
      const v = calloutMatch[1].toUpperCase();
      const variant: CalloutVariant =
        v === 'TIP' || v === 'IMPORTANT' || v === 'WARNING' || v === 'CAUTION' ? (v as CalloutVariant) : 'NOTE';
      blocks.push({ id: newId(), type: 'callout', text: calloutMatch[2], calloutVariant: variant });
    } else if (/^#\s+/.test(t)) {
      blocks.push({ id: newId(), type: 'h1', text: t.replace(/^#\s+/, '') });
    } else if (/^##\s+/.test(t)) {
      blocks.push({ id: newId(), type: 'h2', text: t.replace(/^##\s+/, '') });
    } else if (/^###\s+/.test(t)) {
      blocks.push({ id: newId(), type: 'h3', text: t.replace(/^###\s+/, '') });
    } else if (/^[-*]\s+\[([ xX])\]\s*/.test(t)) {
      const m = t.match(/^[-*]\s+\[([ xX])\]\s*(.*)$/);
      blocks.push({ id: newId(), type: 'todo', text: m?.[2] ?? '', checked: /[xX]/.test(m?.[1] ?? '') });
    } else if (/^[-*]\s+/.test(t)) {
      blocks.push({ id: newId(), type: 'ul', text: t.replace(/^[-*]\s+/, '') });
    } else if (/^\d+\.\s+/.test(t)) {
      blocks.push({ id: newId(), type: 'ol', text: t.replace(/^\d+\.\s+/, '') });
    } else if (/^>\s?/.test(t)) {
      blocks.push({ id: newId(), type: 'quote', text: t.replace(/^>\s?/, '') });
    } else {
      blocks.push({ id: newId(), type: 'p', text: line });
    }
  }
  if (blocks.length === 0) blocks.push({ id: newId(), type: 'p', text: '' });
  return blocks;
}

/** blocks → Markdown. 与 parseMarkdown 互逆 (幂等). */
export function serializeBlocks(blocks: Block[]): string {
  const out: string[] = [];
  let olCount = 0;
  for (const b of blocks) {
    if (b.type === 'ol') olCount += 1;
    else olCount = 0;
    switch (b.type) {
      case 'h1': out.push(`# ${b.text}`); break;
      case 'h2': out.push(`## ${b.text}`); break;
      case 'h3': out.push(`### ${b.text}`); break;
      case 'ul': out.push(`- ${b.text}`); break;
      case 'ol': out.push(`${olCount}. ${b.text}`); break;
      case 'todo': out.push(`- [${b.checked ? 'x' : ' '}] ${b.text}`); break;
      case 'quote': out.push(`> ${b.text}`); break;
      case 'code': out.push('```\n' + b.text + '\n```'); break;
      case 'hr': out.push('---'); break;
      case 'image': out.push(`![${b.alt ?? ''}](${b.src ?? ''})`); break;
      case 'callout': out.push(`> [!${b.calloutVariant ?? 'NOTE'}] ${b.text}`); break;
      case 'table': {
        const rows = b.rows ?? [];
        if (rows.length === 0) break;
        const header = rows[0];
        out.push(`| ${header.join(' | ')} |`);
        out.push(`| ${header.map(() => '---').join(' | ')} |`);
        for (const r of rows.slice(1)) out.push(`| ${r.join(' | ')} |`);
        break;
      }
      case 'toggle': {
        out.push(b.open ? '<details open>' : '<details>');
        out.push(`<summary>${b.text}</summary>`);
        out.push('');
        out.push(b.body ?? '');
        out.push('');
        out.push('</details>');
        break;
      }
      default: out.push(b.text);
    }
  }
  return out.join('\n');
}

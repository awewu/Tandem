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
  | 'hr';

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  /** todo 专用 */
  checked?: boolean;
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

/** 把 Markdown 文本解析成 blocks. 容错: 不认识的行当段落. */
export function parseMarkdown(md: string): Block[] {
  const lines = (md ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let inCode = false;
  let codeBuf: string[] = [];

  for (const raw of lines) {
    const line = raw;
    if (/^```/.test(line.trim())) {
      if (inCode) {
        blocks.push({ id: newId(), type: 'code', text: codeBuf.join('\n') });
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    const t = line.trim();
    if (t === '') continue;
    if (/^---+$/.test(t) || /^\*\*\*+$/.test(t)) {
      blocks.push({ id: newId(), type: 'hr', text: '' });
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
  if (inCode && codeBuf.length) {
    blocks.push({ id: newId(), type: 'code', text: codeBuf.join('\n') });
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
      default: out.push(b.text);
    }
  }
  return out.join('\n');
}

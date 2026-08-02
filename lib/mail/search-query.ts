/**
 * 邮件搜索语法解析 (Gmail 风格操作符)
 *
 * 支持:
 *   from:alice          发件人包含 alice
 *   to:bob              收件人
 *   cc:carol            抄送
 *   subject:报价         主题
 *   has:attachment      含附件
 *   is:unread / is:read 已读状态
 *   is:starred          星标 (等价 is:flagged)
 *   before:2026-01-31   此日期之前 (不含)
 *   after:2026-01-01    此日期之后 (含) — 亦可写 since:
 *   in:all / in:inbox / in:sent / in:drafts / in:trash / in:junk / in:archive
 *   folder:自定义文件夹
 *   其余无前缀词 → 自由文本 (主题/发件人/收件人/正文 任一命中)
 *
 * 纯函数, 无依赖, 供 API 与单测复用。
 */

export interface ParsedMailQuery {
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  /** 自由文本 (合并多个无前缀词) */
  text?: string;
  hasAttachment?: boolean;
  /** true=只看已读, false=只看未读 */
  seen?: boolean;
  /** 只看星标 */
  flagged?: boolean;
  /** 早于该日期 (ISO date, 不含当天) */
  before?: string;
  /** 晚于/等于该日期 (ISO date) */
  since?: string;
  /** 目标文件夹集合 (规范 key: inbox/sent/drafts/trash/junk/archive 或原样自定义); 'all' 表示跨文件夹 */
  folders?: string[];
  /** 是否跨全部文件夹 */
  allFolders?: boolean;
}

const KNOWN_FOLDER_KEYS = new Set(['inbox', 'sent', 'drafts', 'trash', 'junk', 'spam', 'archive', 'starred']);

/** 将 in:/folder: 的值规范化 */
function normalizeFolderToken(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === 'spam') return 'junk';
  return v;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** 去除首尾成对双引号 */
function stripQuotes(v: string): string {
  return v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v;
}

/** 按空格切词, 保留 key:"值 含空格" 与 "自由短语" 内的空格 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  // 依次匹配: key:"..." | "..." | 普通词
  const re = /\S+:"[^"]*"|"[^"]*"|\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

export function parseMailQuery(raw: string): ParsedMailQuery {
  const result: ParsedMailQuery = {};
  const freeText: string[] = [];
  const folders: string[] = [];

  for (const token of tokenize(raw.trim())) {
    const idx = token.indexOf(':');
    if (idx <= 0) {
      freeText.push(stripQuotes(token));
      continue;
    }
    const key = token.slice(0, idx).toLowerCase();
    const value = stripQuotes(token.slice(idx + 1));
    if (!value) {
      freeText.push(stripQuotes(token));
      continue;
    }
    switch (key) {
      case 'from': result.from = value; break;
      case 'to': result.to = value; break;
      case 'cc': result.cc = value; break;
      case 'subject': result.subject = value; break;
      case 'has':
        if (value.toLowerCase() === 'attachment' || value.toLowerCase() === 'attachments') result.hasAttachment = true;
        else freeText.push(token);
        break;
      case 'is': {
        const v = value.toLowerCase();
        if (v === 'unread') result.seen = false;
        else if (v === 'read') result.seen = true;
        else if (v === 'starred' || v === 'flagged') result.flagged = true;
        else freeText.push(token);
        break;
      }
      case 'before': if (isValidDate(value)) result.before = value; else freeText.push(token); break;
      case 'after':
      case 'since': if (isValidDate(value)) result.since = value; else freeText.push(token); break;
      case 'in':
      case 'folder': {
        const nf = normalizeFolderToken(value);
        if (nf === 'all') result.allFolders = true;
        else folders.push(nf);
        break;
      }
      default: freeText.push(token);
    }
  }

  if (freeText.length) result.text = freeText.join(' ');
  if (folders.length) result.folders = folders;
  return result;
}

/** 该查询是否含任何结构化条件 (决定是否走高级搜索路径) */
export function hasStructuredCriteria(q: ParsedMailQuery): boolean {
  return Boolean(
    q.from || q.to || q.cc || q.subject || q.hasAttachment ||
    q.seen !== undefined || q.flagged || q.before || q.since ||
    q.allFolders || (q.folders && q.folders.length),
  );
}

export { KNOWN_FOLDER_KEYS };

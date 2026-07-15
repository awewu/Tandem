import * as XLSX from 'xlsx';

export interface KnowledgeSpreadsheetSheet {
  name: string;
  rows: string[][];
}

export interface KnowledgeSpreadsheetContent {
  /** Upload metadata comment, kept outside the searchable worksheet body. */
  preamble: string;
  sheets: KnowledgeSpreadsheetSheet[];
}

const SHEET_MARKER = /^### Sheet:\s*(.+?)\s*$/gm;

export function isSpreadsheetFilename(name: string): boolean {
  return /\.(xlsx|xls|ods)$/i.test(name);
}

function normalizeRows(rows: unknown[][]): string[][] {
  return rows.map((row) => {
    const normalized = row.map((cell) => cell == null ? '' : String(cell));
    let last = normalized.length - 1;
    while (last >= 0 && normalized[last] === '') last--;
    return normalized.slice(0, last + 1);
  });
}

/**
 * Parses the searchable text emitted by document-parser back into worksheets.
 * Keeping this representation text-based means existing uploads work without a
 * migration and AI/full-text retrieval can still index every cell.
 */
export function parseSpreadsheetContent(content: string): KnowledgeSpreadsheetContent | null {
  const preambleMatch = content.match(/^\s*(<!--[\s\S]*?-->)\s*/);
  const preamble = preambleMatch?.[1] ?? '';
  const body = preambleMatch ? content.slice(preambleMatch[0].length) : content;
  const matches = Array.from(body.matchAll(SHEET_MARKER));
  if (matches.length === 0) return null;

  const sheets = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? body.length : body.length;
    const csv = body
      .slice(start, end)
      .replace(/^\s*\r?\n/, '')
      .replace(/\r?\n\s*---\s*$/, '')
      .trimEnd();

    if (!csv) return { name: match[1].trim(), rows: [] };

    // CSV is the searchable storage format. Keep every value verbatim so IDs,
    // leading zeroes and ISO dates are not silently coerced by SheetJS.
    const workbook = XLSX.read(csv, { type: 'string', raw: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = worksheet
      ? XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
          header: 1,
          defval: '',
          raw: true,
          blankrows: true,
        })
      : [];
    return { name: match[1].trim(), rows: normalizeRows(rows) };
  });

  return { preamble, sheets };
}

export function serializeSpreadsheetContent(workbook: KnowledgeSpreadsheetContent): string {
  const sections = workbook.sheets.map((sheet, index) => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    const csv = XLSX.utils.sheet_to_csv(worksheet, { blankrows: true }).trimEnd();
    const name = sheet.name.replace(/[\r\n]/g, ' ').trim() || `Sheet${index + 1}`;
    return `### Sheet: ${name}${csv ? `\n\n${csv}` : ''}`;
  });
  const body = sections.join('\n\n---\n\n');
  return workbook.preamble ? `${workbook.preamble}\n\n${body}` : body;
}

/** Creates a valid .xlsx download from the searchable worksheet representation. */
export function writeSpreadsheetFile(workbook: KnowledgeSpreadsheetContent): ArrayBuffer {
  const output = XLSX.utils.book_new();
  workbook.sheets.forEach((sheet, index) => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    const fallback = `Sheet${index + 1}`;
    const name = (sheet.name || fallback).slice(0, 31).replace(/[\\/?*\[\]:]/g, '_');
    XLSX.utils.book_append_sheet(output, worksheet, name || fallback);
  });
  return XLSX.write(output, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

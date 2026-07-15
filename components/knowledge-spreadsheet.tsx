'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Columns3, Plus, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  parseSpreadsheetContent,
  serializeSpreadsheetContent,
  type KnowledgeSpreadsheetContent,
} from '@/lib/knowledge/spreadsheet-content';

interface SpreadsheetEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const DEFAULT_COLUMNS = 8;

function columnLabel(index: number): string {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value--;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function cloneWorkbook(workbook: KnowledgeSpreadsheetContent): KnowledgeSpreadsheetContent {
  return {
    ...workbook,
    sheets: workbook.sheets.map((sheet) => ({
      ...sheet,
      rows: sheet.rows.map((row) => [...row]),
    })),
  };
}

export function KnowledgeSpreadsheetEditor({ value, onChange }: SpreadsheetEditorProps) {
  const [workbook, setWorkbook] = useState<KnowledgeSpreadsheetContent | null>(() =>
    parseSpreadsheetContent(value),
  );
  const [activeSheet, setActiveSheet] = useState(0);
  const lastEmittedValue = useRef(value);

  useEffect(() => {
    if (value === lastEmittedValue.current) return;
    setWorkbook(parseSpreadsheetContent(value));
    setActiveSheet(0);
    lastEmittedValue.current = value;
  }, [value]);

  const commit = (next: KnowledgeSpreadsheetContent) => {
    setWorkbook(next);
    const serialized = serializeSpreadsheetContent(next);
    lastEmittedValue.current = serialized;
    onChange(serialized);
  };

  if (!workbook || workbook.sheets.length === 0) return null;

  const safeActiveSheet = Math.min(activeSheet, workbook.sheets.length - 1);
  const sheet = workbook.sheets[safeActiveSheet];
  const columnCount = Math.max(
    DEFAULT_COLUMNS,
    ...sheet.rows.map((row) => row.length),
  );
  const displayRows = sheet.rows.length > 0 ? sheet.rows : [[]];

  const updateCell = (rowIndex: number, columnIndex: number, cellValue: string) => {
    const next = cloneWorkbook(workbook);
    const rows = next.sheets[safeActiveSheet].rows;
    while (rows.length <= rowIndex) rows.push([]);
    while (rows[rowIndex].length <= columnIndex) rows[rowIndex].push('');
    rows[rowIndex][columnIndex] = cellValue;
    commit(next);
  };

  const addRow = () => {
    const next = cloneWorkbook(workbook);
    next.sheets[safeActiveSheet].rows.push(Array(columnCount).fill(''));
    commit(next);
  };

  const addColumn = () => {
    const next = cloneWorkbook(workbook);
    const rows = next.sheets[safeActiveSheet].rows;
    if (rows.length === 0) rows.push([]);
    rows.forEach((row) => {
      while (row.length < columnCount) row.push('');
      row.push('');
    });
    commit(next);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-between border-b px-3 text-footnote text-muted-foreground">
        <span>{sheet.rows.length} 行 · {columnCount} 列</span>
        <span>{workbook.sheets.length} 个工作表</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse table-fixed text-caption" style={{ width: 44 + columnCount * 160 }}>
          <colgroup>
            <col style={{ width: 44 }} />
            {Array.from({ length: columnCount }, (_, index) => (
              <col key={index} style={{ width: 160 }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20 bg-muted">
            <tr>
              <th className="sticky left-0 z-30 h-7 border-b border-r bg-muted" />
              {Array.from({ length: columnCount }, (_, index) => (
                <th key={index} className="h-7 border-b border-r px-2 text-center font-medium text-muted-foreground">
                  {columnLabel(index)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th className="sticky left-0 z-10 h-8 border-b border-r bg-muted text-center font-normal text-muted-foreground">
                  {rowIndex + 1}
                </th>
                {Array.from({ length: columnCount }, (_, columnIndex) => (
                  <td key={columnIndex} className="h-8 border-b border-r p-0">
                    <input
                      aria-label={`${sheet.name} ${columnLabel(columnIndex)}${rowIndex + 1}`}
                      value={row[columnIndex] ?? ''}
                      onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                      className={`h-8 w-full min-w-0 border-0 bg-background px-2 outline-none focus:bg-primary/5 focus:ring-2 focus:ring-inset focus:ring-primary ${
                        rowIndex === 0 ? 'font-medium' : ''
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex h-10 shrink-0 items-center border-t bg-muted/30 px-2">
        <div className="flex min-w-0 flex-1 items-center self-stretch overflow-x-auto">
          {workbook.sheets.map((item, index) => (
            <button
              key={`${item.name}-${index}`}
              type="button"
              onClick={() => setActiveSheet(index)}
              className={`h-full shrink-0 border-r px-4 text-footnote transition-colors ${
                index === safeActiveSheet
                  ? 'border-t-2 border-t-primary bg-background font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="ml-2 flex shrink-0 gap-1 border-l pl-2">
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-footnote" onClick={addRow}>
            <Rows3 className="mr-1 h-3.5 w-3.5" /> 添加行
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-footnote" onClick={addColumn}>
            <Columns3 className="mr-1 h-3.5 w-3.5" /> 添加列
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SpreadsheetPreviewProps {
  value: string;
}

export function KnowledgeSpreadsheetPreview({ value }: SpreadsheetPreviewProps) {
  const workbook = useMemo(() => parseSpreadsheetContent(value), [value]);
  if (!workbook?.sheets.length) return null;
  const sheet = workbook.sheets[0];
  const rows = sheet.rows.slice(0, 8);
  const columnCount = Math.min(8, Math.max(1, ...rows.map((row) => row.length)));

  return (
    <div className="max-h-64 overflow-auto border bg-background">
      <table className="min-w-full border-collapse text-[10px]">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex === 0 ? 'bg-muted font-medium' : ''}>
              {Array.from({ length: columnCount }, (_, columnIndex) => (
                <td key={columnIndex} className="max-w-36 border-b border-r px-2 py-1.5 whitespace-nowrap">
                  <span className="block truncate">{row[columnIndex] ?? ''}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground">
        {sheet.name}{workbook.sheets.length > 1 ? ` · 另有 ${workbook.sheets.length - 1} 个工作表` : ''}
      </div>
    </div>
  );
}

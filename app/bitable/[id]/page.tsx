'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, ArrowLeft, Table as TableIcon, Columns3, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { BitableTable, BitableColumn } from '@/lib/types/bitable';
import { useDynamicStyle } from '@/lib/hooks/use-dynamic-style';

type ViewKind = 'grid' | 'kanban' | 'calendar';

const OPTION_COLOR: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  amber: 'bg-warning/15 text-warning border-warning/30',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  sky: 'bg-sky-100 text-sky-800 border-sky-200',
  rose: 'bg-rose-100 text-rose-800 border-rose-200',
  violet: 'bg-violet-100 text-violet-800 border-violet-200',
};
function optionColor(col: BitableColumn | undefined, value: unknown): string {
  const opt = col?.options?.find((o) => o.value === value);
  return OPTION_COLOR[opt?.color ?? 'slate'] ?? OPTION_COLOR.slate;
}

export default function BitableTablePage() {
  const { id } = useParams<{ id: string }>();
  const [table, setTable] = useState<BitableTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ row: string; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [view, setView] = useState<ViewKind>('grid');
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/bitable/tables/${id}`);
      if (r.ok) {
        const d = await r.json();
        setTable(d.table ?? null);
      } else {
        setTable(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const addRow = useCallback(
    async (data: Record<string, unknown> = {}) => {
      await fetch(`/api/bitable/tables/${id}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      await load();
    },
    [id, load],
  );

  const updateCell = useCallback(
    async (rowId: string, colId: string, value: unknown) => {
      await fetch(`/api/bitable/tables/${id}/rows`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId, data: { [colId]: value } }),
      });
      await load();
    },
    [id, load],
  );

  const selectCols = useMemo(
    () => (table?.columns ?? []).filter((c) => c.type === 'select' || c.type === 'multiselect'),
    [table],
  );
  const dateCols = useMemo(() => (table?.columns ?? []).filter((c) => c.type === 'date'), [table]);
  const labelCol = useMemo(
    () => (table?.columns ?? []).find((c) => c.type === 'text' || c.type === 'longtext') ?? table?.columns[0],
    [table],
  );

  if (loading) return <div className="p-8 text-slate-400">加载中…</div>;
  if (!table) return <div className="p-8 text-slate-400">表格不存在</div>;

  const VIEW_TABS: Array<{ kind: ViewKind; label: string; icon: typeof TableIcon; enabled: boolean }> = [
    { kind: 'grid', label: '表格', icon: TableIcon, enabled: true },
    { kind: 'kanban', label: '看板', icon: Columns3, enabled: selectCols.length > 0 },
    { kind: 'calendar', label: '日历', icon: CalendarDays, enabled: dateCols.length > 0 },
  ];
  const effectiveView: ViewKind =
    VIEW_TABS.find((t) => t.kind === view)?.enabled ? view : 'grid';

  return (
    <div className="max-w-7xl mx-auto p-6 md:px-8">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/bitable" className="text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-headline font-bold">{table.name}</h1>
        <span className="text-footnote text-slate-400">· {table.rows.length} 行</span>
        <div className="ml-auto inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {VIEW_TABS.map((t) => {
            const Icon = t.icon;
            const active = effectiveView === t.kind;
            return (
              <button
                key={t.kind}
                disabled={!t.enabled}
                onClick={() => setView(t.kind)}
                title={!t.enabled ? (t.kind === 'kanban' ? '需要一个单选列' : '需要一个日期列') : t.label}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-footnote transition ${
                  active ? 'bg-white shadow-soft-sm font-medium text-slate-900' : 'text-slate-500'
                } ${!t.enabled ? 'opacity-40 cursor-not-allowed' : 'hover:text-slate-900'}`}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {effectiveView === 'grid' && (
        <GridView
          table={table}
          editingCell={editingCell}
          editValue={editValue}
          setEditingCell={setEditingCell}
          setEditValue={setEditValue}
          updateCell={updateCell}
          addRow={addRow}
        />
      )}

      {effectiveView === 'kanban' && (
        <KanbanView table={table} groupCol={selectCols[0]} labelCol={labelCol} addRow={addRow} updateCell={updateCell} />
      )}

      {effectiveView === 'calendar' && (
        <CalendarView
          table={table}
          dateCol={dateCols[0]}
          labelCol={labelCol}
          selectCol={selectCols[0]}
          monthCursor={monthCursor}
          setMonthCursor={setMonthCursor}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 表格视图
// ---------------------------------------------------------------------------

function GridView({
  table,
  editingCell,
  editValue,
  setEditingCell,
  setEditValue,
  updateCell,
  addRow,
}: {
  table: BitableTable;
  editingCell: { row: string; col: string } | null;
  editValue: string;
  setEditingCell: (v: { row: string; col: string } | null) => void;
  setEditValue: (v: string) => void;
  updateCell: (rowId: string, colId: string, value: unknown) => Promise<void>;
  addRow: (data?: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
      <table className="w-full text-caption">
        <thead className="bg-slate-50 text-footnote text-slate-500 uppercase">
          <tr>
            {table.columns.map((col) => (
              <ColumnHeader key={col.id} col={col} />
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50">
              {table.columns.map((col) => {
                const value = row.data[col.id];
                // select: 下拉
                if (col.type === 'select') {
                  return (
                    <td key={col.id} className="px-3 py-2">
                      <select
                        aria-label={col.name}
                        className="bg-transparent text-caption outline-none cursor-pointer rounded"
                        value={value == null ? '' : String(value)}
                        onChange={(e) => void updateCell(row.id, col.id, e.target.value)}
                      >
                        <option value="">—</option>
                        {col.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.value}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                }
                // checkbox
                if (col.type === 'checkbox') {
                  return (
                    <td key={col.id} className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={col.name}
                        checked={value === true || value === 'true'}
                        onChange={(e) => void updateCell(row.id, col.id, e.target.checked)}
                      />
                    </td>
                  );
                }
                // date
                if (col.type === 'date') {
                  return (
                    <td key={col.id} className="px-3 py-2">
                      <input
                        type="date"
                        aria-label={col.name}
                        className="bg-transparent text-caption outline-none cursor-pointer"
                        value={value == null ? '' : String(value).slice(0, 10)}
                        onChange={(e) => void updateCell(row.id, col.id, e.target.value)}
                      />
                    </td>
                  );
                }
                // text / number / 其它: 点击编辑
                const isEditing = editingCell?.row === row.id && editingCell.col === col.id;
                return (
                  <td
                    key={col.id}
                    className="px-3 py-2 cursor-text"
                    onClick={() => {
                      if (!isEditing) {
                        setEditingCell({ row: row.id, col: col.id });
                        setEditValue(value == null ? '' : String(value));
                      }
                    }}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        aria-label={`编辑 ${col.name}`}
                        placeholder={col.name}
                        type={col.type === 'number' ? 'number' : 'text'}
                        className="w-full bg-warning/5 px-1 py-0.5 outline-none ring-1 ring-warning/30 rounded"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => {
                          void updateCell(row.id, col.id, col.type === 'number' ? Number(editValue) : editValue);
                          setEditingCell(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void updateCell(row.id, col.id, col.type === 'number' ? Number(editValue) : editValue);
                            setEditingCell(null);
                          } else if (e.key === 'Escape') {
                            setEditingCell(null);
                          }
                        }}
                      />
                    ) : value != null && String(value).length > 0 ? (
                      String(value)
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-slate-100">
        <button
          onClick={() => void addRow()}
          className="w-full px-3 py-2 text-caption text-slate-500 hover:bg-slate-50 flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> 新增一行
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 看板视图 (按单选列分组)
// ---------------------------------------------------------------------------

function KanbanView({
  table,
  groupCol,
  labelCol,
  addRow,
  updateCell,
}: {
  table: BitableTable;
  groupCol: BitableColumn;
  labelCol: BitableColumn | undefined;
  addRow: (data?: Record<string, unknown>) => Promise<void>;
  updateCell: (rowId: string, colId: string, value: unknown) => Promise<void>;
}) {
  const lanes = [...(groupCol.options ?? []).map((o) => o.value), '__none__'];
  const otherCols = table.columns.filter((c) => c.id !== groupCol.id && c.id !== labelCol?.id);
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {lanes.map((lane) => {
        const rows = table.rows.filter((r) => {
          const v = r.data[groupCol.id];
          return lane === '__none__' ? v == null || v === '' : v === lane;
        });
        return (
          <div key={lane} className="w-64 flex-shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-footnote ${
                  lane === '__none__' ? OPTION_COLOR.slate : optionColor(groupCol, lane)
                }`}
              >
                {lane === '__none__' ? '未分组' : lane}
              </span>
              <span className="text-footnote text-slate-400">{rows.length}</span>
            </div>
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft-sm">
                  <div className="font-medium text-caption">
                    {labelCol && r.data[labelCol.id] != null && String(r.data[labelCol.id]).length > 0
                      ? String(r.data[labelCol.id])
                      : <span className="text-slate-300">未命名</span>}
                  </div>
                  {otherCols.slice(0, 3).map((c) => {
                    const v = r.data[c.id];
                    if (v == null || String(v).length === 0) return null;
                    return (
                      <div key={c.id} className="mt-1 text-footnote text-slate-500">
                        <span className="text-slate-400">{c.name}: </span>
                        {String(v)}
                      </div>
                    );
                  })}
                  <select
                    aria-label="移动到"
                    className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-footnote outline-none cursor-pointer"
                    value={lane === '__none__' ? '' : lane}
                    onChange={(e) => void updateCell(r.id, groupCol.id, e.target.value)}
                  >
                    <option value="">未分组</option>
                    {groupCol.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <button
                onClick={() => void addRow(lane === '__none__' ? {} : { [groupCol.id]: lane })}
                className="w-full rounded-lg border border-dashed border-slate-200 px-2 py-1.5 text-footnote text-slate-400 hover:border-slate-300 hover:text-slate-600 flex items-center justify-center gap-1"
              >
                <Plus className="h-3 w-3" /> 添加
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 日历视图 (按日期列摆放)
// ---------------------------------------------------------------------------

function CalendarView({
  table,
  dateCol,
  labelCol,
  selectCol,
  monthCursor,
  setMonthCursor,
}: {
  table: BitableTable;
  dateCol: BitableColumn;
  labelCol: BitableColumn | undefined;
  selectCol: BitableColumn | undefined;
  monthCursor: { y: number; m: number };
  setMonthCursor: (v: { y: number; m: number }) => void;
}) {
  const { y, m } = monthCursor;
  const first = new Date(y, m, 1);
  const startWeekday = first.getDay(); // 0=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const byDay = new Map<string, typeof table.rows>();
  for (const r of table.rows) {
    const raw = r.data[dateCol.id];
    if (raw == null || String(raw).length === 0) continue;
    const key = String(raw).slice(0, 10);
    const arr = byDay.get(key) ?? [];
    arr.push(r);
    byDay.set(key, arr);
  }
  const cells: Array<{ day: number; key: string } | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, key });
  }
  const todayKey = new Date().toISOString().slice(0, 10);
  const prev = () => setMonthCursor(m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 });
  const next = () => setMonthCursor(m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold">
          {y} 年 {m + 1} 月
          <span className="ml-2 text-footnote font-normal text-slate-400">按「{dateCol.name}」</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="rounded p-1 hover:bg-slate-100" aria-label="上个月">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const d = new Date();
              setMonthCursor({ y: d.getFullYear(), m: d.getMonth() });
            }}
            className="rounded px-2 py-1 text-footnote hover:bg-slate-100"
          >
            今天
          </button>
          <button onClick={next} className="rounded p-1 hover:bg-slate-100" aria-label="下个月">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-footnote text-slate-400">
        {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-100">
        {cells.map((cell, i) => (
          <div key={i} className="min-h-[84px] bg-white p-1">
            {cell && (
              <>
                <div
                  className={`mb-1 text-footnote ${
                    cell.key === todayKey
                      ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white'
                      : 'text-slate-400'
                  }`}
                >
                  {cell.day}
                </div>
                <div className="space-y-1">
                  {(byDay.get(cell.key) ?? []).slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className={`truncate rounded border px-1 py-0.5 text-[10px] ${
                        selectCol ? optionColor(selectCol, r.data[selectCol.id]) : OPTION_COLOR.sky
                      }`}
                      title={labelCol ? String(r.data[labelCol.id] ?? '') : ''}
                    >
                      {labelCol && r.data[labelCol.id] != null
                        ? String(r.data[labelCol.id])
                        : '未命名'}
                    </div>
                  ))}
                  {(byDay.get(cell.key)?.length ?? 0) > 3 && (
                    <div className="text-[10px] text-slate-400">+{(byDay.get(cell.key)?.length ?? 0) - 3}</div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ColumnHeader({ col }: { col: BitableColumn }) {
  const ref = useDynamicStyle<HTMLTableCellElement>({ minWidth: `${col.width ?? 150}px` });
  return (
    <th ref={ref} className="text-left px-3 py-2 font-medium">
      {col.name}
      <span className="ml-1 text-slate-400 text-[10px]">{col.type}</span>
    </th>
  );
}

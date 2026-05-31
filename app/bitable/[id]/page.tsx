'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { BitableTable, BitableColumn } from '@/lib/types/bitable';
import { useDynamicStyle } from '@/lib/hooks/use-dynamic-style';

export default function BitableTablePage() {
  const { id } = useParams<{ id: string }>();
  const [table, setTable] = useState<BitableTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ row: string; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');

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

  async function addRow() {
    await fetch(`/api/bitable/tables/${id}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
    });
    await load();
  }

  async function updateCell(rowId: string, colId: string, value: unknown) {
    await fetch(`/api/bitable/tables/${id}/rows`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId, data: { [colId]: value } }),
    });
    await load();
  }

  if (loading) return <div className="p-8 text-slate-400">加载中…</div>;
  if (!table) return <div className="p-8 text-slate-400">表格不存在</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 md:px-8">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/bitable" className="text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-headline font-bold">{table.name}</h1>
        <span className="text-footnote text-slate-400">· {table.rows.length} 行</span>
      </div>

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
                  const isEditing = editingCell?.row === row.id && editingCell.col === col.id;
                  const value = row.data[col.id];
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
                          className="w-full bg-warning/5 px-1 py-0.5 outline-none ring-1 ring-warning/30 rounded"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => {
                            void updateCell(row.id, col.id, editValue);
                            setEditingCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void updateCell(row.id, col.id, editValue);
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
            onClick={addRow}
            className="w-full px-3 py-2 text-caption text-slate-500 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> 新增一行
          </button>
        </div>
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

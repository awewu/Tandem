'use client';

/**
 * 搭子手抄 · 单个数据库页 — 加载库定义 + 行, 渲染三视图, 变更即时落库.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { DatabaseView } from '@/components/shouchao/database-view';
import { DatabaseImport } from '@/components/shouchao/database-import';
import type {
  ShouchaoDatabase,
  ShouchaoRow,
  ShouchaoPropType,
  ShouchaoCellValue,
  ShouchaoProperty,
} from '@/lib/types/shouchao-db';

type Status = 'loading' | 'ok' | 'notfound' | 'error';

export default function ShouchaoDatabasePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const [status, setStatus] = useState<Status>('loading');
  const [database, setDatabase] = useState<ShouchaoDatabase | null>(null);
  const [rows, setRows] = useState<ShouchaoRow[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dbRes, rowsRes] = await Promise.all([
        fetch(`/api/shouchao/databases/${id}`, { credentials: 'include', cache: 'no-store' }),
        fetch(`/api/shouchao/databases/${id}/rows`, { credentials: 'include', cache: 'no-store' }),
      ]);
      if (dbRes.status === 404) {
        setStatus('notfound');
        return;
      }
      if (!dbRes.ok) {
        setStatus('error');
        return;
      }
      const dbData = await dbRes.json();
      const rowsData = rowsRes.ok ? await rowsRes.json() : { rows: [] };
      setDatabase(dbData.database);
      setRows(rowsData.rows ?? []);
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  const addRow = useCallback(async () => {
    const res = await fetch(`/api/shouchao/databases/${id}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cells: {} }),
    });
    if (res.ok) {
      const d = await res.json();
      setRows((prev) => [...prev, d.row]);
    }
  }, [id]);

  const updateCell = useCallback(
    async (rowId: string, propId: string, value: ShouchaoCellValue) => {
      // 乐观更新
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [propId]: value } } : r)));
      await fetch(`/api/shouchao/rows/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cells: { [propId]: value } }),
      }).catch(() => {});
    },
    [],
  );

  const deleteRow = useCallback(async (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    await fetch(`/api/shouchao/rows/${rowId}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
  }, []);

  const addProperty = useCallback(
    async (name: string, type: ShouchaoPropType) => {
      if (!database) return;
      const newProp: ShouchaoProperty = {
        id: `prop_${Date.now()}`,
        name,
        type,
        options: type === 'select' || type === 'multiSelect' ? [] : undefined,
      };
      const nextProps = [...database.properties, newProp];
      setDatabase({ ...database, properties: nextProps });
      const res = await fetch(`/api/shouchao/databases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ properties: nextProps }),
      });
      if (res.ok) {
        const d = await res.json();
        setDatabase(d.database);
      }
    },
    [database, id],
  );

  // A1: 批量落库确认后的草稿行 (逐行 POST, 承 C3 确认才写)
  const importRows = useCallback(
    async (draft: Array<{ cells: Record<string, ShouchaoCellValue> }>) => {
      const created: ShouchaoRow[] = [];
      for (const dr of draft) {
        const res = await fetch(`/api/shouchao/databases/${id}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cells: dr.cells }),
        });
        if (res.ok) created.push((await res.json()).row);
      }
      if (created.length) setRows((prev) => [...prev, ...created]);
    },
    [id],
  );

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-surface-1 to-surface-2/50">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-1/80 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-2">
          {database?.icon && <span className="text-headline">{database.icon}</span>}
          <h1 className="text-headline font-bold text-ink-primary">
            {database?.name ?? '数据库'}
          </h1>
        </div>
        <Link
          href="/shouchao"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-caption font-medium text-ink-secondary hover:bg-surface-2 hover:text-ink-primary surface-interactive"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 返回手抄
        </Link>
      </header>

      <main className="min-h-0 flex-1">
        {status === 'loading' && (
          <div className="flex h-full items-center justify-center text-ink-tertiary">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载中…
          </div>
        )}
        {status === 'notfound' && (
          <div className="flex h-full items-center justify-center text-ink-tertiary">数据库不存在或无权访问。</div>
        )}
        {status === 'error' && (
          <div className="flex h-full items-center justify-center text-ink-tertiary">加载失败，请稍后重试。</div>
        )}
        {status === 'ok' && database && (
          <DatabaseView
            database={database}
            rows={rows}
            onAddRow={addRow}
            onUpdateCell={updateCell}
            onDeleteRow={deleteRow}
            onAddProperty={addProperty}
            onImport={() => setImportOpen(true)}
          />
        )}
      </main>

      {importOpen && database && (
        <DatabaseImport
          databaseId={id}
          properties={database.properties}
          onClose={() => setImportOpen(false)}
          onConfirm={importRows}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Plus, Table as TableIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import type { BitableTable } from '@/lib/types/bitable';

export default function BitableHomePage() {
  const [tables, setTables] = useState<BitableTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [newName, setNewName] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/bitable/tables');
      const d = await r.json();
      setTables(d.tables ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function createTable() {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      await fetch('/api/bitable/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setNewName('');
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function seedTemplates() {
    if (seeding) return;
    setSeeding(true);
    try {
      await fetch('/api/bitable/seed-templates', { method: 'POST' });
      await load();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-title-3 font-bold flex items-center gap-2">
          <TableIcon className="h-6 w-6 text-emerald-600" /> 多维表格 (Bitable)
        </h1>
        <p className="text-caption text-slate-500 mt-1">轻量飞书 Bitable 替代 · 表格 / 看板 / 日历视图</p>
      </div>

      <div className="mb-6 flex gap-2">
        <Input
          placeholder="新建表格 (如: Q3 项目跟踪)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createTable()}
          className="max-w-sm"
        />
        <Button onClick={createTable} disabled={creating || !newName.trim()}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          新建
        </Button>
        <Button variant="outline" onClick={seedTemplates} disabled={seeding}>
          {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <TableIcon className="h-4 w-4" />}
          示例模板
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中…</div>
      ) : tables.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-caption space-y-3">
          <div>还没有表格。新建一个，或一键载入示例模板。</div>
          <Button variant="outline" onClick={seedTemplates} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <TableIcon className="h-4 w-4" />}
            载入示例模板 (项目跟踪 / 客户台账 / 招聘漏斗)
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tables.map((t) => (
            <Link
              key={t.id}
              href={`/bitable/${t.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-400 hover:shadow-soft transition"
            >
              <div className="font-semibold">{t.name}</div>
              {t.description && <div className="text-footnote text-slate-500 mt-1">{t.description}</div>}
              <div className="mt-3 flex items-center justify-between text-footnote text-slate-400">
                <span>{t.columns.length} 列 · {t.rows.length} 行</span>
                <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

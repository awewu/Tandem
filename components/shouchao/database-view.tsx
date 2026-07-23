'use client';

/**
 * 搭子手抄 · 数据库视图 (对标 Notion databases)
 *
 * 三视图: 表格 / 看板 (按 select 分组) / 画廊 (卡片).
 * 受控展示 — 数据与持久化由父页面通过回调处理.
 */

import { useMemo, useState } from 'react';
import { Plus, Table as TableIcon, Columns3, LayoutGrid, Trash2, Settings2, X, Sparkles } from 'lucide-react';
import type {
  ShouchaoDatabase,
  ShouchaoRow,
  ShouchaoProperty,
  ShouchaoPropType,
  ShouchaoCellValue,
  ShouchaoViewType,
} from '@/lib/types/shouchao-db';
import { computeView, groupRows } from '@/lib/shouchao/db-view';

const PROP_TYPE_LABEL: Record<ShouchaoPropType, string> = {
  text: '文本',
  number: '数字',
  select: '单选',
  multiSelect: '多选',
  date: '日期',
  checkbox: '勾选',
  url: '链接',
};

interface DatabaseViewProps {
  database: ShouchaoDatabase;
  rows: ShouchaoRow[];
  onAddRow: () => void;
  onUpdateCell: (rowId: string, propId: string, value: ShouchaoCellValue) => void;
  onDeleteRow: (rowId: string) => void;
  onAddProperty: (name: string, type: ShouchaoPropType) => void;
  /** A1: 打开"从笔记 AI 导入"弹层 (可选) */
  onImport?: () => void;
}

function CellEditor({
  prop,
  value,
  onChange,
}: {
  prop: ShouchaoProperty;
  value: ShouchaoCellValue;
  onChange: (v: ShouchaoCellValue) => void;
}) {
  const base =
    'w-full min-w-[6rem] bg-transparent px-2 py-1 text-caption text-ink-primary focus:bg-brand-50/40 focus:outline-none';
  switch (prop.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="ml-2 h-4 w-4 accent-brand-500"
        />
      );
    case 'number':
      return (
        <input
          type="number"
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className={base}
        />
      );
    case 'date':
      return (
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          className={base}
        />
      );
    case 'select':
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          className={base}
        >
          <option value="">—</option>
          {(prop.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case 'multiSelect':
      return (
        <input
          value={Array.isArray(value) ? value.join(', ') : ''}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          placeholder="逗号分隔"
          className={base}
        />
      );
    case 'url':
      return (
        <input
          type="url"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="https://"
          className={base}
        />
      );
    default:
      return (
        <input
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          className={base}
        />
      );
  }
}

export function DatabaseView({
  database,
  rows,
  onAddRow,
  onUpdateCell,
  onDeleteRow,
  onAddProperty,
  onImport,
}: DatabaseViewProps) {
  const [viewType, setViewType] = useState<ShouchaoViewType>(database.views[0]?.type ?? 'table');
  const [addPropOpen, setAddPropOpen] = useState(false);
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState<ShouchaoPropType>('text');

  const props = database.properties;
  const view = database.views[0];
  const visibleRows = useMemo(
    () => computeView(rows, props, { filters: view?.filters, sorts: view?.sorts }),
    [rows, props, view],
  );

  // 看板/画廊分组: 用视图指定的 groupBy, 否则第一个 select 属性
  const groupProp = useMemo(() => {
    const byView = props.find((p) => p.id === view?.groupByPropId);
    return byView ?? props.find((p) => p.type === 'select');
  }, [props, view]);

  const submitProp = () => {
    const name = newPropName.trim();
    if (!name) return;
    onAddProperty(name, newPropType);
    setNewPropName('');
    setNewPropType('text');
    setAddPropOpen(false);
  };

  const VIEW_TABS: Array<{ t: ShouchaoViewType; label: string; Icon: typeof TableIcon }> = [
    { t: 'table', label: '表格', Icon: TableIcon },
    { t: 'board', label: '看板', Icon: Columns3 },
    { t: 'gallery', label: '画廊', Icon: LayoutGrid },
  ];

  const titleProp = props[0];
  const rowTitle = (r: ShouchaoRow) => {
    const v = titleProp ? r.cells[titleProp.id] : '';
    return (typeof v === 'string' && v) || '未命名';
  };

  return (
    <div className="flex h-full flex-col">
      {/* 视图切换 + 操作条 */}
      <div className="flex items-center gap-2 border-b border-border px-1 py-2">
        {VIEW_TABS.map(({ t, label, Icon }) => (
          <button
            key={t}
            type="button"
            onClick={() => setViewType(t)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption surface-interactive ${
              viewType === t ? 'bg-brand-50 text-brand-700' : 'text-ink-tertiary hover:bg-surface-2'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAddPropOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption text-ink-tertiary hover:bg-surface-2 surface-interactive"
          >
            <Settings2 className="h-3.5 w-3.5" /> 属性
          </button>
          {onImport && (
            <button
              type="button"
              onClick={onImport}
              title="从我的笔记 AI 抽取成行"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption text-brand-600 hover:bg-brand-50 surface-interactive"
            >
              <Sparkles className="h-3.5 w-3.5" /> AI 导入
            </button>
          )}
          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-2.5 py-1 text-caption font-semibold text-white hover:bg-brand-600 surface-interactive"
          >
            <Plus className="h-3.5 w-3.5" /> 新建
          </button>
        </div>
      </div>

      {/* 加属性面板 */}
      {addPropOpen && (
        <div className="flex items-center gap-2 border-b border-border bg-surface-2/40 px-2 py-2">
          <input
            value={newPropName}
            onChange={(e) => setNewPropName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitProp()}
            placeholder="属性名称"
            className="rounded-md border border-border bg-surface-1 px-2 py-1 text-caption focus:border-brand-400 focus:outline-none"
          />
          <select
            value={newPropType}
            onChange={(e) => setNewPropType(e.target.value as ShouchaoPropType)}
            className="rounded-md border border-border bg-surface-1 px-2 py-1 text-caption focus:outline-none"
          >
            {(Object.keys(PROP_TYPE_LABEL) as ShouchaoPropType[]).map((t) => (
              <option key={t} value={t}>
                {PROP_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <button type="button" onClick={submitProp} className="rounded-md bg-brand-500 px-2 py-1 text-caption font-medium text-white hover:bg-brand-600">
            添加
          </button>
          <button type="button" onClick={() => setAddPropOpen(false)} className="rounded-md p-1 text-ink-tertiary hover:bg-surface-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {/* ── 表格视图 ── */}
        {viewType === 'table' && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {props.map((p) => (
                  <th key={p.id} className="border border-border bg-surface-2/50 px-2 py-1 text-left text-footnote font-semibold text-ink-secondary">
                    {p.name}
                    <span className="ml-1 text-ink-tertiary">· {PROP_TYPE_LABEL[p.type]}</span>
                  </th>
                ))}
                <th className="border border-border bg-surface-2/50 px-2 py-1 text-footnote text-ink-tertiary">操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/30">
                  {props.map((p) => (
                    <td key={p.id} className="border border-border p-0">
                      <CellEditor prop={p} value={r.cells[p.id] ?? null} onChange={(v) => onUpdateCell(r.id, p.id, v)} />
                    </td>
                  ))}
                  <td className="border border-border px-1 text-center">
                    <button type="button" onClick={() => onDeleteRow(r.id)} title="删除行" className="text-ink-tertiary hover:text-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={props.length + 1} className="border border-border px-3 py-6 text-center text-caption text-ink-tertiary">
                    还没有数据，点右上角「新建」。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* ── 看板视图 (按 select 分组) ── */}
        {viewType === 'board' &&
          (groupProp ? (
            <div className="flex gap-3 overflow-x-auto">
              {groupRows(visibleRows, groupProp.id, groupProp.options).map((g) => (
                <div key={g.key} className="w-64 shrink-0 rounded-lg bg-surface-2/40 p-2">
                  <div className="mb-2 px-1 text-caption font-semibold text-ink-secondary">
                    {g.key === '__none__' ? '未分组' : g.key}
                    <span className="ml-1 text-ink-tertiary">{g.rows.length}</span>
                  </div>
                  <div className="space-y-2">
                    {g.rows.map((r) => (
                      <div key={r.id} className="rounded-md border border-border bg-surface-1 p-2 shadow-soft-sm">
                        <div className="text-caption font-medium text-ink-primary">{rowTitle(r)}</div>
                        {props.slice(1, 4).map((p) => {
                          const v = r.cells[p.id];
                          if (v == null || v === '') return null;
                          return (
                            <div key={p.id} className="mt-1 text-footnote text-ink-tertiary">
                              {p.name}: {Array.isArray(v) ? v.join(', ') : String(v)}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-3 py-6 text-center text-caption text-ink-tertiary">看板视图需要一个「单选」属性用于分组。</p>
          ))}

        {/* ── 画廊视图 ── */}
        {viewType === 'gallery' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visibleRows.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-surface-1 p-3 shadow-soft-sm">
                <div className="mb-1 text-caption font-semibold text-ink-primary">{rowTitle(r)}</div>
                {props.slice(1).map((p) => {
                  const v = r.cells[p.id];
                  if (v == null || v === '') return null;
                  return (
                    <div key={p.id} className="mt-1 text-footnote text-ink-tertiary">
                      <span className="text-ink-secondary">{p.name}:</span> {Array.isArray(v) ? v.join(', ') : String(v)}
                    </div>
                  );
                })}
                <button type="button" onClick={() => onDeleteRow(r.id)} className="mt-2 text-footnote text-ink-tertiary hover:text-danger">
                  删除
                </button>
              </div>
            ))}
            {visibleRows.length === 0 && (
              <p className="col-span-full px-3 py-6 text-center text-caption text-ink-tertiary">还没有数据。</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

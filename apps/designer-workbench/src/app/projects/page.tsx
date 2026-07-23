'use client';

import { useEffect, useState } from 'react';
import { design, quotation } from '../../lib/api';

interface DesignProject {
  id: string;
  name: string;
  status: string;
  customerId?: string | null;
  opportunityId?: string | null;
  meta?: {
    area?: number;
    city?: string;
    systems?: string[];
    painPoints?: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

const sysLabel: Record<string, string> = {
  hotWater: '热水', water: '净水', heating: '采暖', airConditioning: '制冷',
  freshAir: '新风', humidity: '恒湿', control: '控制',
  hot_water: '中央热水', air: '空调',
};

const fmtDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

function ProjectCard({ p }: { p: DesignProject }) {
  const [quoteState, setQuoteState] = useState<{ loading: boolean; msg?: string; id?: string; no?: string }>({ loading: false });

  const generateQuote = async () => {
    if (!p.customerId || !p.opportunityId) {
      setQuoteState({ loading: false, msg: '缺少 customerId/opportunityId' });
      return;
    }
    setQuoteState({ loading: true });
    try {
      const summary = await quotation.generate({
        design: { area: p.meta?.area, city: p.meta?.city, systems: p.meta?.systems },
        devices: [{ name: '系统套餐', price: (p.meta?.area || 100) * 800, quantity: 1 }],
        services: ['安装', '调试'],
      });
      const total = summary?.summary?.total ?? (p.meta?.area || 100) * 950;
      const persisted = await quotation.persist({
        customerId: p.customerId,
        opportunityId: p.opportunityId,
        project: { designProjectId: p.id, area: p.meta?.area, city: p.meta?.city, systems: p.meta?.systems },
        items: [
          { name: '设备套餐', sku: 'SYS-001', unitPrice: Math.round(total / 1.13), quantity: 1, price: Math.round(total / 1.13) },
          { name: '安装服务', sku: 'LABOR-001', unitPrice: Math.round((p.meta?.area || 100) * 150), quantity: 1, price: Math.round((p.meta?.area || 100) * 150) },
        ],
        costBreakdown: { subtotal: Math.round(total / 1.13), tax: Math.round(total - total / 1.13), total, currency: 'CNY' },
        systemFamilies: p.meta?.systems ?? [],
        status: 'draft',
      });
      setQuoteState({ loading: false, id: persisted.id, no: persisted.quotationNo, msg: `报价已生成：${persisted.quotationNo}` });
    } catch (e: any) {
      setQuoteState({ loading: false, msg: `失败：${e?.message ?? '未知错误'}` });
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-gray-900">{p.name}</div>
          <div className="text-xs text-gray-500 mt-1">
            ID: {p.id.slice(0, 8)}… · 更新于 {fmtDate(p.updatedAt)}
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100 capitalize">
          {p.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-700">
        {p.meta?.area ? <span>{p.meta.area}㎡</span> : null}
        {p.meta?.city ? <span>{p.meta.city}</span> : null}
      </div>

      {p.meta?.systems && p.meta.systems.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {p.meta.systems.map((s) => (
            <span key={s} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
              {sysLabel[s] || s}
            </span>
          ))}
        </div>
      )}

      {p.meta?.painPoints && p.meta.painPoints.length > 0 && (
        <div className="mt-3 text-xs text-gray-600">
          痛点：{p.meta.painPoints.join(' · ')}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <a
          href={`/floor-plan?projectId=${encodeURIComponent(p.id)}`}
          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          打开平面
        </a>
        <a
          href={`/calc?projectId=${encodeURIComponent(p.id)}`}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100"
        >
          精算
        </a>
        <button
          onClick={generateQuote}
          disabled={quoteState.loading}
          className="text-sm px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60"
        >
          {quoteState.loading ? '生成中…' : '生成报价'}
        </button>
        {quoteState.msg && (
          <span className={`text-xs ${quoteState.id ? 'text-green-700' : 'text-red-600'}`}>
            {quoteState.msg}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const [items, setItems] = useState<DesignProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    design.listProjects()
      .then((res: { items?: DesignProject[] }) => {
        setItems(res?.items || []);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message || '加载失败');
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">设计项目</h1>
          <a href="/" className="text-sm text-blue-600 hover:text-blue-800 underline">
            返回工作台
          </a>
        </div>

        {loading && <div className="text-sm text-gray-500">加载中…</div>}
        {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}

        {!loading && items.length === 0 && (
          <div className="text-sm text-gray-500 bg-white p-6 rounded-lg border">
            暂无设计项目。请在经销商工作台 CRM 中点击「创建设计项目」。
          </div>
        )}

        <div className="grid gap-4">
          {items.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      </div>
    </main>
  );
}

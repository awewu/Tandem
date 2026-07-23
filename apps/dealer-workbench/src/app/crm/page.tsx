'use client';
import { useEffect, useState, lazy, Suspense } from 'react';
import { loadPipeline, calcAnalytics, type PipelineOpp, type StageKey } from '../../lib/crm-data';
import { PageHeader } from '@rhautt/ui';

const CrmAnalytics = lazy(() => import('../../components/CrmAnalytics'));
const CrmBoard     = lazy(() => import('../../components/CrmBoard'));
const CrmDrawer    = lazy(() => import('../../components/CrmDrawer'));

export default function CrmPage() {
  const [opps, setOpps]       = useState<PipelineOpp[]>([]);
  const [demo, setDemo]       = useState(false);
  const [selected, setSelected] = useState<PipelineOpp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPipeline().then(({ opps, demo }) => {
      setOpps(opps);
      setDemo(demo);
      setLoading(false);
    });
  }, []);

  function handleStageChange(_id: string, _stage: StageKey, updated: PipelineOpp[]) {
    setOpps(updated);
    if (selected) setSelected(updated.find(o => o.id === selected.id) ?? null);
  }

  function handleUpdate(updated: PipelineOpp) {
    setOpps(prev => prev.map(o => o.id === updated.id ? updated : o));
    setSelected(updated);
  }

  const analytics = calcAnalytics(opps);

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container">
        <PageHeader title="CRM 客户漏斗" subtitle="销售漏斗 · 经营分析 · 客户详情" />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--t-secondary)' }}>加载中…</div>
        ) : (
          <Suspense fallback={null}>
            <CrmAnalytics a={analytics} />
            <CrmBoard
              opps={opps}
              demo={demo}
              onSelect={setSelected}
              onStageChange={handleStageChange}
            />
          </Suspense>
        )}

        {selected && (
          <Suspense fallback={null}>
            <CrmDrawer
              opp={selected}
              onClose={() => setSelected(null)}
              onUpdate={handleUpdate}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

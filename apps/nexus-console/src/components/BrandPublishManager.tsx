'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadProductWorkspace, requestJson, type ProductRecord } from '../lib/product-operations';

export default function BrandPublishManager() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [log, setLog] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const workspace = await loadProductWorkspace();
      setProducts(workspace.products);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '发布数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener('nexus-session-changed', reload);
    return () => window.removeEventListener('nexus-session-changed', reload);
  }, [load]);

  const stats = useMemo(() => ({
    active: products.filter((product) => product.status === 'active').length,
    inactive: products.filter((product) => product.status !== 'active').length,
    withAssets: products.filter((product) => (product.assetRefs || []).length > 0).length,
    brands: new Set(products.map((product) => product.brand).filter(Boolean)).size,
  }), [products]);

  async function publish() {
    if (!window.confirm('确认从 Nexus 产品库与 DAM 重新生成 Everhot 品牌站点数据？')) return;
    setPublishing(true);
    setError('');
    setLog('');
    try {
      const result = await requestJson('/api/brand-publish', { method: 'POST', body: '{}' });
      setLog(result.log || '发布完成');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '发布失败');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="operations-workspace">
      <div className="release-toolbar">
        <div>
          <strong>Everhot 品牌站点</strong>
          <span>从产品目录与 DAM 同步生成站点数据</span>
        </div>
        <button className="btn" type="button" disabled={publishing || loading} onClick={() => void publish()}>{publishing ? '发布中...' : '发布到站点'}</button>
      </div>
      {error && <div className="manager-alert" role="alert">{error}</div>}
      <div className="cards release-metrics">
        <div className="card"><p className="t">在架产品</p><div className="kpi">{loading ? '—' : stats.active}</div><p className="d">进入站点公开供给</p></div>
        <div className="card"><p className="t">下架产品</p><div className="kpi">{loading ? '—' : stats.inactive}</div><p className="d">不进入本次站点生成</p></div>
        <div className="card"><p className="t">素材完整</p><div className="kpi">{loading ? '—' : stats.withAssets}</div><p className="d">至少挂载一项 DAM 素材</p></div>
        <div className="card"><p className="t">覆盖品牌</p><div className="kpi">{loading ? '—' : stats.brands}</div><p className="d">当前目录中的品牌数量</p></div>
      </div>
      <div className="release-panel">
        <div className="release-panel-head"><strong>发布记录</strong><button className="btn ghost" type="button" onClick={() => void load()} disabled={loading}>刷新数据</button></div>
        {log ? <pre className="release-log">{log}</pre> : <div className="empty-panel">本次会话暂无发布记录。</div>}
      </div>
    </div>
  );
}

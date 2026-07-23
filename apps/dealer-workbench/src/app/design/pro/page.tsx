'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { emptyPlan, sampleApartment, type FloorPlan } from '../../../lib/floorplan';
import { design } from '../../../lib/api';

// Konva/react-konva 依赖浏览器环境（require('canvas')），禁用 SSR 仅在客户端加载
const Editor2D = dynamic(() => import('../../../components/Editor2D'), {
  ssr: false,
  loading: () => <div style={{ padding: 80, textAlign: 'center', color: 'var(--t-tertiary)' }}>加载 CAD 引擎…</div>,
});

type Project = { id: string; name: string; status?: string; updatedAt?: string };

// 把后端 floor_plans 行（jsonb 列）重建为编辑器 FloorPlan
function rowToPlan(row: any, fallbackName: string): FloorPlan {
  const arr = (v: any) => (Array.isArray(v) ? v : []);
  return {
    walls: arr(row?.walls),
    equipment: arr(row?.equipment),
    rooms: arr(row?.rooms),
    doors: Array.isArray(row?.doors) ? row.doors : undefined,
    windows: Array.isArray(row?.windows) ? row.windows : undefined,
    furniture: Array.isArray(row?.furniture) ? row.furniture : undefined,
    meta: row?.meta && typeof row.meta === 'object' ? row.meta : { name: fallbackName, scale: 0.25 },
  };
}

export default function DesignProPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [name, setName] = useState<string>('未命名方案');
  const [plan, setPlan] = useState<FloorPlan>(() => emptyPlan());
  const [loadKey, setLoadKey] = useState(0); // 变更即重挂 Editor2D，重置内部状态
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const current = useRef<FloorPlan>(plan);

  const onChange = useCallback((p: FloorPlan) => { current.current = p; }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const res = await design.listProjects();
      const items: Project[] = res?.items ?? res ?? [];
      setProjects(items);
    } catch (e: any) { setErr(e.message || '项目列表加载失败'); }
  }, []);

  useEffect(() => { refreshProjects(); }, [refreshProjects]);

  function loadPlanIntoEditor(p: FloorPlan, nm: string) {
    setPlan(p); current.current = p; setName(nm);
    setLoadKey((k) => k + 1);
  }

  async function openProject(id: string) {
    if (!id) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const proj = projects.find((x) => x.id === id);
      const row = await design.getLatestPlan(id);
      setProjectId(id);
      loadPlanIntoEditor(row ? rowToPlan(row, proj?.name || '未命名方案') : emptyPlan(), proj?.name || '未命名方案');
      setMsg(row ? '已载入最近户型' : '该项目暂无户型，已开新图');
    } catch (e: any) { setErr(e.message || '载入失败'); }
    finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setErr(''); setMsg('');
    try {
      const p = current.current;
      const res = await design.saveFloorPlan({
        projectId: projectId || undefined,
        name,
        walls: p.walls, equipment: p.equipment, rooms: p.rooms,
        doors: p.doors ?? null, windows: p.windows ?? null, furniture: p.furniture ?? null,
        meta: { ...p.meta, name },
      });
      if (res?.projectId) setProjectId(res.projectId);
      setMsg('已保存到 design 项目（M12 真相源锚点）');
      await refreshProjects();
    } catch (e: any) { setErr(e.message || '保存失败（请确认已登录）'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, flexWrap: 'wrap' }}>
        <span className="t-headline">专业 CAD 编辑器</span>
        <span style={{ fontSize: 11, color: 'var(--t-tertiary)', background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 4 }}>Konva · 专业版</span>

        <select value={projectId} onChange={(e) => openProject(e.target.value)}
          style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', maxWidth: 220 }}>
          <option value="">— 选择已有项目载入 —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="方案名称"
          style={{ fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', width: 150 }} />

        <button onClick={save} disabled={busy}
          style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 6, border: 'none', background: 'var(--brand, #4E9A3D)', color: '#fff', cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1 }}>
          {busy ? '处理中…' : '💾 保存'}
        </button>
        <button onClick={() => { setProjectId(''); loadPlanIntoEditor(emptyPlan(), '未命名方案'); setMsg('已开新图'); }}
          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
          ＋ 新图
        </button>
        <button onClick={() => { setProjectId(''); loadPlanIntoEditor(sampleApartment(), '示例三室两卫户型'); setMsg('已载入示例户型'); }}
          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
          示例户型
        </button>

        {msg && <span style={{ fontSize: 12, color: 'var(--success, #16a34a)' }}>{msg}</span>}
        {err && <span style={{ fontSize: 12, color: 'var(--danger, #dc2626)' }}>{err}</span>}

        <div style={{ flex: 1 }} />
        <Link href="/design" style={{ fontSize: 13, color: 'var(--t-secondary)' }}>← 简易设计</Link>
        <Link href="/design/visualize" style={{ fontSize: 13, color: 'var(--t-secondary)' }}>可视化 →</Link>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Editor2D key={loadKey} initialPlan={plan} onChange={onChange} />
      </div>
    </div>
  );
}

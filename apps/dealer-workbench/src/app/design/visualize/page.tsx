'use client';
import { useState, useEffect, lazy, Suspense } from 'react';
import { design } from '../../../lib/api';
import { sampleApartment } from '../../../lib/floorplan';
import { PageHeader } from '@rhautt/ui';

const SolutionViewer  = lazy(() => import('../../../components/SolutionViewer'));
const FloorPlanPro    = lazy(() => import('../../../components/FloorPlanPro'));
const FloorHeatViz    = lazy(() => import('../../../components/FloorHeatViz'));
const PipeNetworkViz  = lazy(() => import('../../../components/PipeNetworkViz'));
const AirflowSim      = lazy(() => import('../../../components/AirflowSim'));

type Room   = { id:string; label:string; x:number; y:number; w:number; h:number };
type Device = { id:string; type:string; label:string; icon:string; color:string; x:number; y:number; w:number; h:number };
type Door   = { id:string; x:number; y:number; width:number; angle:number; swing:1|-1 };
type Win    = { id:string; x:number; y:number; width:number; angle:number };

const SAMPLE_ROOMS: Room[] = [
  { id:'r0', label:'客厅', x:40, y:40,  w:240, h:200 },
  { id:'r1', label:'主卧', x:280,y:40,  w:160, h:160 },
  { id:'r2', label:'厨房', x:40, y:240, w:120, h:120 },
];
const SAMPLE_DEVICES: Device[] = [
  { id:'d0', type:'heat_pump',  label:'热泵主机', icon:'🔄', color:'var(--brand)',   x:40,  y:40,  w:2, h:2 },
  { id:'d1', type:'fresh_air',  label:'新风机',   icon:'💨', color:'var(--info)',    x:160, y:40,  w:2, h:1 },
  { id:'d2', type:'floor_heat', label:'分集水器', icon:'🌡️', color:'var(--success)', x:40,  y:160, w:1, h:2 },
];

const TABS = [
  { key: '3d',       label: '3D 方案',    desc: 'Three.js 交互渲染' },
  { key: 'blueprint',label: '施工蓝图',   desc: '标准制图风格' },
  { key: 'floorheat',label: '地暖热力图', desc: '温度分布 + 盘管路径' },
  { key: 'pipe',     label: '管路系统',   desc: '四系统液压计算' },
  { key: 'airflow',  label: '气流模拟',   desc: '3D CFD 仿真' },
] as const;

type TabKey = typeof TABS[number]['key'];

const Loading = () => (
  <div style={{ padding: 80, textAlign: 'center', color: 'var(--t-tertiary)' }}>
    <div className="skeleton" style={{ width: 200, height: 20, margin: '0 auto 8px' }} />
    初始化引擎…
  </div>
);

export default function VisualizePage() {
  const [tab,      setTab]      = useState<TabKey>('3d');
  const [projects, setProjects] = useState<{id:string;name:string;updatedAt:string}[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [rooms,    setRooms]    = useState<Room[]>(SAMPLE_ROOMS);
  const [devices,  setDevices]  = useState<Device[]>(SAMPLE_DEVICES);
  const [doors,    setDoors]    = useState<Door[]>([]);
  const [windows,  setWindows]  = useState<Win[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [usingDemo,setUsingDemo]= useState(true);

  useEffect(() => {
    design.listProjects()
      .then((r:any) => setProjects(r?.data?.items ?? r?.items ?? []))
      .catch(() => {});
  }, []);

  const loadProject = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await design.getLatestPlan(id);
      const raw = (res as any)?.data?.meta ?? (res as any)?.meta;
      if (raw?.rawRooms?.length) {
        setRooms(raw.rawRooms);
        setDevices(raw.rawDevices ?? []);
        setDoors(raw.rawDoors ?? []);
        setWindows(raw.rawWindows ?? []);
        setUsingDemo(false);
      }
    } catch {}
    setLoading(false);
  };

  const firstRoom = rooms[0];
  const roomW = firstRoom ? firstRoom.w * 25 : 5000; // px→mm (1px=25mm)
  const roomD = firstRoom ? firstRoom.h * 25 : 4000;

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container">
        <PageHeader
          title="方案可视化"
          subtitle="施工蓝图 · 地暖热力图 · 管路系统 · 气流仿真"
          actions={<a href="/design" style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 500 }}>← 返回设计</a>}
        />

        {/* 方案选择 */}
        <div className="card-elevated" style={{ padding: '12px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-primary)', flexShrink: 0 }}>加载已保存方案：</span>
          <select value={selected} onChange={e => { setSelected(e.target.value); loadProject(e.target.value); }}
            style={{ flex: 1, padding: '7px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border-2)', fontSize: 13, background: 'var(--surface-1)', color: 'var(--t-primary)', outline: 'none' }}>
            <option value="">— 使用演示数据 —</option>
            {projects.map((p:any) => (
              <option key={p.id} value={p.id}>{p.name || '未命名方案'} · {p.updatedAt?.slice(0,10)}</option>
            ))}
          </select>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 600, flexShrink: 0,
            background: usingDemo ? 'var(--brand-tint)' : '#f0fdf4',
            color:      usingDemo ? 'var(--brand-700)' : 'var(--success)' }}>
            {usingDemo ? '演示数据' : '真实方案'}
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 0, gap: 0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
                background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                borderBottom: `2px solid ${tab === t.key ? 'var(--brand)' : 'transparent'}`,
                color: tab === t.key ? 'var(--brand)' : 'var(--t-secondary)',
                marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card-elevated" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none', padding: 0, overflow: 'hidden' }}>
          {loading ? <Loading /> : (
            <Suspense fallback={<Loading />}>
              {tab === '3d'        && <div style={{ padding: 20 }}><SolutionViewer rooms={rooms} devices={devices} doors={doors} windows={windows} /></div>}
              {tab === 'blueprint' && <div style={{ padding: 20 }}><FloorPlanPro plan={sampleApartment()} title={usingDemo ? '演示方案蓝图' : '已保存方案蓝图'} /></div>}
              {tab === 'floorheat' && <div style={{ padding: 20 }}><FloorHeatViz roomW={roomW} roomD={roomD} title="地暖热力分布" /></div>}
              {tab === 'pipe'      && <div style={{ padding: 20 }}><PipeNetworkViz rooms={rooms as any} devices={devices as any} /></div>}
              {tab === 'airflow'   && <AirflowSim rooms={rooms as any} devices={devices as any} />}
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

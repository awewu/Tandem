'use client';
import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { PROJ_STAGES, PROJ_STAGE_KEYS, DEMO_PROJECTS, calcProjStats, loadProjects, type Project, type ProjStage } from '../../lib/projects-data';
import { bim } from '../../lib/api';
import { PageHeader } from '@rhautt/ui';

const fmt = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `¥${v.toLocaleString()}`;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

function Card({ p }: { p: Project }) {
  const done = p.milestones.filter(m => m.done).length;
  const prog = done / p.milestones.length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = p.expectedAt < today && p.stage !== 'acceptance';
  return (
    <div className="card-elevated" style={{ padding: '10px 12px', marginBottom: 8,
      borderLeft: `3px solid ${overdue ? 'var(--danger)' : 'var(--border)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{p.customer}</span>
        <span style={{ fontSize: 11, color: 'var(--brand)', fontWeight: 600 }}>{fmt(p.contractValue)}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--t-secondary)', marginBottom: 6 }}>{p.city} · {p.system}</div>
      <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${prog * 100}%`, background: 'var(--brand)', borderRadius: 3 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t-tertiary)' }}>
        <span>{done}/{p.milestones.length} 里程碑</span>
        <span style={{ color: overdue ? 'var(--danger)' : 'var(--t-tertiary)' }}>
          {overdue ? `逾期` : `预计 ${p.expectedAt.slice(5)}`}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--t-tertiary)', marginTop: 3 }}>🔧 {p.installer} · 回款 {pct(p.paidValue / p.contractValue)}</div>
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(DEMO_PROJECTS);
  const [demo, setDemo] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    loadProjects().then(({ projects, demo }) => { setProjects(projects); setDemo(demo); });
  }, []);

  const stats = calcProjStats(projects);

  function onDragEnd(r: DropResult) {
    if (!r.destination) return;
    const stage = r.destination.droppableId as ProjStage;
    if (!PROJ_STAGE_KEYS.includes(stage)) return;
    const proj = projects.find(p => p.id === r.draggableId);
    setProjects(ps => ps.map(p => p.id === r.draggableId ? { ...p, stage } : p));
    // Sync to backend: advance if moving forward in stage order
    if (!demo && proj) {
      const from = PROJ_STAGE_KEYS.indexOf(proj.stage);
      const to   = PROJ_STAGE_KEYS.indexOf(stage);
      if (to > from) bim.advance(r.draggableId).catch(() => {});
    }
  }

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container">
        <PageHeader title="项目交付管理" subtitle="跟踪在建项目进度与回款状态" />

        {/* KPI */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { label: '在建项目', value: String(stats.active) },
            { label: '合同总额', value: fmt(stats.totalContract) },
            { label: '已回款', value: fmt(stats.totalPaid) },
            { label: '回款率', value: pct(stats.collectRate) },
            { label: '逾期项目', value: String(stats.overdue), danger: stats.overdue > 0 },
          ].map(k => (
            <div key={k.label} className="card-elevated" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'danger' in k && k.danger ? 'var(--danger)' : 'var(--t-strong)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Kanban */}
        {mounted && (
          <DragDropContext onDragEnd={onDragEnd}>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12, alignItems: 'flex-start' }}>
              {PROJ_STAGES.map(s => {
                const items = projects.filter(p => p.stage === s.key);
                const sum = items.reduce((a, p) => a + p.contractValue, 0);
                return (
                  <div key={s.key} style={{ width: 220, flexShrink: 0 }}>
                    <div style={{ borderRadius: '8px 8px 0 0', padding: '8px 12px', background: s.color, color: '#fff', marginBottom: 4 }}>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{s.label}</div>
                      <div style={{ fontSize: 11, opacity: .85 }}>{items.length}个 · {fmt(sum)}</div>
                    </div>
                    <Droppable droppableId={s.key}>
                      {(prov, snap) => (
                        <div ref={prov.innerRef} {...prov.droppableProps}
                          style={{ minHeight: 100, padding: 4, borderRadius: '0 0 8px 8px',
                            background: snap.isDraggingOver ? 'var(--success-bg)' : 'var(--surface-2)' }}>
                          {items.map((p, i) => (
                            <Draggable key={p.id} draggableId={p.id} index={i}>
                              {(p2) => (
                                <div ref={p2.innerRef} {...p2.draggableProps} {...p2.dragHandleProps}>
                                  <Card p={p} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {prov.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}

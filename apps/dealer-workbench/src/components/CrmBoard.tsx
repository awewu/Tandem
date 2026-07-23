'use client';
import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { STAGES, STAGE_KEYS, WON_STAGES, type PipelineOpp, type StageKey } from '../lib/crm-data';
import { crm } from '../lib/api';

const fmt = (v: number) => v >= 10000 ? `${(v/10000).toFixed(0)}万` : `¥${v.toLocaleString()}`;
const daysDiff = (iso?: string | null) => iso ? Math.round((new Date(iso).getTime()-Date.now())/86400000) : null;

function Card({ opp, onClick }: { opp: PipelineOpp; onClick: () => void }) {
  const due = daysDiff(opp.nextActionAt);
  const overdue = due !== null && due < 0;
  const area = (opp.customer?.profile?.area as number) || 0;
  const tags = (opp.customer?.tags || []) as string[];
  const aiReport = tags.some(t => t === 'aiReport') || tags.some(t => t.includes('aiReport'));
  return (
    <div onClick={onClick} style={{
      background:'#fff', borderRadius:8, padding:'10px 12px', marginBottom:8, cursor:'pointer',
      borderLeft:`3px solid ${WON_STAGES.includes(opp.stage)?'#16a34a':'var(--border-2)'}`,
      boxShadow:'0 1px 3px rgba(0,0,0,0.07)',
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
        <span style={{fontWeight:700,fontSize:13}}>{opp.customer?.name||'—'}</span>
        {aiReport && <span style={{fontSize:10,background:'#ede9fe',color:'#7c3aed',padding:'1px 6px',borderRadius:999}}>AI诊断</span>}
      </div>
      <div style={{fontSize:11,color:'#697386',marginBottom:4}}>
        {opp.customer?.city} {area ? `· ${area}㎡` : ''}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontWeight:700,fontSize:13,color:'var(--brand)'}}>{fmt(opp.estimatedValue)}</span>
        {due !== null && (
          <span style={{fontSize:10,padding:'1px 6px',borderRadius:4,
            background:overdue?'#fef2f2':'#f0fdf4',
            color:overdue?'#dc2626':'#16a34a'}}>
            {overdue?`逾期${Math.abs(due)}天`:`${due}天后`}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({ stage, opps, onCardClick }: { stage: typeof STAGES[number]; opps: PipelineOpp[]; onCardClick: (o:PipelineOpp)=>void }) {
  const total = opps.reduce((a, o) => a + o.estimatedValue, 0);
  return (
    <div style={{width:200,flexShrink:0,display:'flex',flexDirection:'column'}}>
      <div style={{
        borderRadius:'8px 8px 0 0', padding:'8px 12px',
        background: stage.color, color:'#fff', marginBottom:4,
      }}>
        <div style={{fontWeight:700,fontSize:12}}>{stage.label}</div>
        <div style={{fontSize:11,opacity:.85}}>{opps.length}个 · {fmt(total)}</div>
      </div>
      <Droppable droppableId={stage.key}>
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.droppableProps}
            style={{flex:1,minHeight:80,padding:4,borderRadius:'0 0 8px 8px',
              background:snapshot.isDraggingOver?'#f0fdf4':'#f7f9fc',
              transition:'background .15s'}}>
            {opps.map((o, i) => (
              <Draggable key={o.id} draggableId={o.id} index={i}>
                {(p2) => (
                  <div ref={p2.innerRef} {...p2.draggableProps} {...p2.dragHandleProps}>
                    <Card opp={o} onClick={() => onCardClick(o)} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default function CrmBoard({
  opps, demo, onSelect, onStageChange,
}: {
  opps: PipelineOpp[];
  demo: boolean;
  onSelect: (o: PipelineOpp) => void;
  onStageChange: (id: string, stage: StageKey, newOpps: PipelineOpp[]) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const byStage = (key: StageKey) => opps.filter(o => o.stage === key);

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const newStage = result.destination.droppableId as StageKey;
    const id = result.draggableId;
    if (!STAGE_KEYS.includes(newStage)) return;
    const updated = opps.map(o => o.id === id ? { ...o, stage: newStage } : o);
    onStageChange(id, newStage, updated);
    crm.updateStage(id, newStage).catch(() => {});
  }

  if (!mounted) return null;

  return (
    <div>
      {demo && (
        <div style={{marginBottom:10,padding:'6px 14px',background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:6,fontSize:12,color:'#92400e'}}>
          演示数据 — API 后端未连接或暂无数据，显示样例漏斗
        </div>
      )}
      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:12,alignItems:'flex-start'}}>
          {STAGES.map(s => (
            <Column key={s.key} stage={s} opps={byStage(s.key)} onCardClick={onSelect} />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

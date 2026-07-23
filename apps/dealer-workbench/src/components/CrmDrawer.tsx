'use client';
import { useState, useEffect } from 'react';
import { STAGES, STAGE_MAP, type PipelineOpp, type StageKey } from '../lib/crm-data';
import { crm, design, quotation } from '../lib/api';

interface Interaction { id: string; type: string; content?: string | null; createdAt?: string; nextAction?: string | null }
interface Quote { id: string; quotationNo: string; status: string; costBreakdown?: { total?: number } | null }
const TYPE_LABEL: Record<string, string> = { note: '📝 跟进', call: '📞 电话', visit: '🏠 上门', quote: '📄 报价', sign: '✍️ 签约', stage: '🔄 阶段' };
const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

// 演示跟进记录（API 无数据时回退，按商机 id 派生稳定时间线）
function demoTimeline(opp: PipelineOpp): Interaction[] {
  const d = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const stageIdx = STAGES.findIndex(s => s.key === opp.stage);
  const base: Interaction[] = [
    { id: 't0', type: 'note', content: `瑞诺瓦 AI 问诊完成，识别痛点并推荐方案`, createdAt: d(stageIdx * 3 + 8) },
  ];
  if (stageIdx >= 1) base.push({ id: 't1', type: 'call', content: '72h 内首次电话确认，客户表达明确意向', createdAt: d(stageIdx * 3 + 5) });
  if (stageIdx >= 2) base.push({ id: 't2', type: 'visit', content: '上门勘测完成，记录房屋尺寸与管线条件', createdAt: d(stageIdx * 3 + 3) });
  if (stageIdx >= 4) base.push({ id: 't3', type: 'quote', content: `报价已发送，预估 ${(opp.estimatedValue / 10000).toFixed(0)}万`, createdAt: d(2) });
  if (stageIdx >= 5) base.push({ id: 't4', type: 'sign', content: '合同签订，进入交付流程', createdAt: d(1) });
  return base.reverse();
}

const fmt = (v: number) => v >= 10000 ? `${(v/10000).toFixed(1)}万` : `¥${v.toLocaleString()}`;

export default function CrmDrawer({
  opp, onClose, onUpdate,
}: {
  opp: PipelineOpp;
  onClose: () => void;
  onUpdate: (o: PipelineOpp) => void;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editVal, setEditVal] = useState(String(opp.estimatedValue));
  const [timeline, setTimeline] = useState<Interaction[]>([]);
  const [tlLoading, setTlLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signMsg, setSignMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectMsg, setProjectMsg] = useState<{ ok: boolean; text: string; id?: string } | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [locking, setLocking] = useState(false);
  const c = opp.customer;
  const systems: string[] = (c?.profile?.systems as string[]) || [];
  const painPoints: string[] = (c?.profile?.painPoints as string[]) || [];
  const area = (c?.profile?.area as number) || 0;
  const houseType = (c?.profile?.houseType as string) || '';
  const floors = (c?.profile?.floors as number) || 0;
  const familyMembers = (c?.profile?.familyMembers as number) || 0;
  const hasBasement = (c?.profile?.hasBasement as boolean) ?? false;
  const hasAiReport = (c?.tags as string[])?.includes('aiReport');
  const stage = STAGE_MAP[opp.stage];

  // 真实拉取客户 360 的跟进记录，失败/空则回退演示时间线
  useEffect(() => {
    let alive = true;
    setTlLoading(true);
    crm.customer360(opp.customerId)
      .then((r: { interactions?: Interaction[] }) => {
        if (!alive) return;
        const list = r.interactions || [];
        setTimeline(list.length ? list : demoTimeline(opp));
      })
      .catch(() => { if (alive) setTimeline(demoTimeline(opp)); })
      .finally(() => { if (alive) setTlLoading(false); });
    return () => { alive = false; };
  }, [opp.customerId]);

  // 拉取该商机的报价单
  useEffect(() => {
    let alive = true;
    setQuotesLoading(true);
    quotation.list({ opportunityId: opp.id })
      .then((r: any) => {
        if (!alive) return;
        const list = (Array.isArray(r) ? r : r?.items) || [];
        setQuotes(list);
        if (list.length && !selectedQuoteId) setSelectedQuoteId(list[0].id);
      })
      .catch(() => { if (alive) setQuotes([]); })
      .finally(() => { if (alive) setQuotesLoading(false); });
    return () => { alive = false; };
  }, [opp.id]);

  async function moveStage(s: StageKey) {
    const updated = { ...opp, stage: s };
    onUpdate(updated);
    setTimeline(t => [{ id: `tl_${Date.now()}`, type: 'stage', content: `阶段推进至「${STAGE_MAP[s].label}」`, createdAt: new Date().toISOString() }, ...t]);
    crm.updateStage(opp.id, s).catch(() => {});
  }

  async function handleSign() {
    if (!selectedQuoteId.trim()) return;
    setSigning(true); setSignMsg(null);
    try {
      const res: any = await crm.sign(opp.id, selectedQuoteId.trim());
      onUpdate({ ...opp, stage: 'signed' as any });
      setSignMsg({ ok: true, text: `已签单，BIM项目已创建` });
      setTimeline(t => [{ id: `tl_sign`, type: 'sign', content: `签单成功，BIM项目已承接`, createdAt: new Date().toISOString() }, ...t]);
      if (res?.bimProject?.id) setTimeout(() => window.location.href = `/bim/${res.bimProject.id}`, 1200);
    } catch (e: unknown) {
      setSignMsg({ ok: false, text: (e as Error).message });
    }
    setSigning(false);
  }

  async function saveNote() {
    if (!note.trim()) return;
    setSaving(true);
    const content = note;
    // 乐观插入时间线顶部
    setTimeline(t => [{ id: `tl_${Date.now()}`, type: 'note', content, createdAt: new Date().toISOString() }, ...t]);
    setNote('');
    try {
      await crm.addInteraction({ customerId: opp.customerId, opportunityId: opp.id, type: 'note', content });
    } catch {}
    setSaving(false);
  }

  async function saveValue() {
    const v = Number(editVal);
    if (!v || v === opp.estimatedValue) return;
    const updated = { ...opp, estimatedValue: v };
    onUpdate(updated);
    crm.updateOpportunity(opp.id, { estimatedValue: v }).catch(() => {});
  }

  const sysLabel: Record<string, string> = {
    hot_water:'中央热水', heating:'采暖系统', fresh_air:'新风系统',
    air:'空调系统', smart_control:'Econet智控', water_treatment:'净水系统', floor_heat:'地暖分集水器',
  };

  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:380, background:'#fff', zIndex:50,
      boxShadow:'-6px 0 24px rgba(0,0,0,0.12)', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-2)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:16 }}>{c?.name || '—'}</div>
          <div style={{ fontSize:12, color:'#697386' }}>{c?.city}{area ? ` · ${area}㎡` : ''} · {stage.label}</div>
        </div>
        <button onClick={onClose} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:'#697386' }}>×</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>

        {/* 商机信息 */}
        <div style={{ background:'#f7f9fc', borderRadius:8, padding:12, marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:12, color:'#697386' }}>预估金额</span>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <input value={editVal} onChange={e=>setEditVal(e.target.value)}
                onBlur={saveValue}
                style={{ width:90, border:'1px solid var(--border-2)', borderRadius:4, padding:'3px 8px', fontSize:13, fontWeight:700, color:'var(--brand)' }} />
            </div>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, background:`${stage.color}22`, color:stage.color, padding:'2px 8px', borderRadius:999 }}>
              {stage.label}
            </span>
            {hasAiReport && (
              <span style={{ fontSize:11, background:'#ede9fe', color:'#7c3aed', padding:'2px 8px', borderRadius:999 }}>
                🤖 AI诊断
              </span>
            )}
            <span style={{ fontSize:11, background:'#f0fdf4', color:'#16a34a', padding:'2px 8px', borderRadius:999 }}>
              {c?.source || '未知来源'}
            </span>
          </div>
        </div>

        {/* AI 诊断系统 */}
        {systems.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, color:'#697386', marginBottom:6 }}>推荐系统</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {systems.map(s => (
                <span key={s} style={{ fontSize:11, background:'var(--brand-50)', color:'var(--brand-700)', border:'1px solid var(--brand-100)', padding:'2px 8px', borderRadius:4 }}>
                  {sysLabel[s] || s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 户型概要 */}
        {(area || houseType || floors || familyMembers) && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, color:'#697386', marginBottom:6 }}>户型概要</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, fontSize:12, color:'#374151' }}>
              {houseType && <span>{houseType}</span>}
              {area ? <span>{area}㎡</span> : null}
              {floors ? <span>{floors}层</span> : null}
              {familyMembers ? <span>{familyMembers}人</span> : null}
              {hasBasement && <span>含地下室</span>}
            </div>
          </div>
        )}

        {/* 痛点 */}
        {painPoints.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, color:'#697386', marginBottom:4 }}>客户痛点</div>
            <div style={{ fontSize:12, color:'#374151' }}>{painPoints.join(' · ')}</div>
          </div>
        )}

        {/* 快速换阶段 */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, color:'#697386', marginBottom:8 }}>推进阶段</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {STAGES.map(s => (
              <button key={s.key} onClick={() => moveStage(s.key)}
                style={{ fontSize:11, padding:'4px 10px', borderRadius:999, cursor:'pointer', border:'none',
                  background: opp.stage === s.key ? s.color : '#e5e7eb',
                  color: opp.stage === s.key ? '#fff' : '#374151',
                  fontWeight: opp.stage === s.key ? 700 : 400 }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 创建设计项目 */}
        {(opp.stage as string) !== 'signed' && (opp.stage as string) !== 'lost' && !projectMsg?.id && (
          <div style={{ marginBottom:16, padding:12, background:'#eff6ff', borderRadius:8, border:'1px solid #bfdbfe' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#2563eb', marginBottom:8 }}>📐 创建设计项目</div>
            <div style={{ fontSize:11, color:'#697386', marginBottom:8 }}>基于问诊档案生成设计师可编辑的方案项目</div>
            <button
              onClick={async () => {
                setCreatingProject(true); setProjectMsg(null);
                try {
                  const res: any = await design.createFromOpportunity({
                    opportunityId: opp.id,
                    customerId: opp.customerId,
                    name: `${c?.name || '客户'} · ${c?.city || ''} 方案`,
                    area, city: c?.city || '', systems, painPoints,
                  });
                  const projectId = res?.id || res?.data?.id;
                  await crm.updateStage(opp.id, 'design');
                  onUpdate({ ...opp, stage: 'design' as any });
                  setProjectMsg({ ok: true, text: '设计项目已创建', id: projectId });
                  setTimeline(t => [{ id: `tl_${Date.now()}`, type: 'stage', content: '阶段推进至「方案设计」并创建设计项目', createdAt: new Date().toISOString() }, ...t]);
                } catch (e: unknown) {
                  setProjectMsg({ ok: false, text: (e as Error).message });
                }
                setCreatingProject(false);
              }}
              disabled={creatingProject}
              style={{ background:'#2563eb', color:'#fff', border:'none', borderRadius:5, padding:'6px 14px', fontSize:12, cursor:'pointer', opacity:creatingProject?0.6:1 }}>
              {creatingProject ? '创建中…' : '创建设计项目'}
            </button>
            {projectMsg && (
              <div style={{ fontSize:11, marginTop:8, color: projectMsg.ok ? '#16a34a' : '#dc2626' }}>
                {projectMsg.text}
                {projectMsg.id && (
                  <a href={`http://localhost:5000/floor-plan?projectId=${encodeURIComponent(projectMsg.id)}`} target="_blank" rel="noreferrer"
                    style={{ marginLeft:8, color:'#2563eb', textDecoration:'underline' }}>打开设计</a>
                )}
              </div>
            )}
          </div>
        )}

        {/* 报价单 */}
        {(opp.stage as string) !== 'signed' && (opp.stage as string) !== 'lost' && (
          <div style={{ marginBottom:16, padding:12, background:'#fffbeb', borderRadius:8, border:'1px solid #fde68a' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#d97706', marginBottom:8 }}>📄 报价单</div>
            {quotesLoading ? (
              <div style={{ fontSize:12, color:'#697386' }}>加载报价单…</div>
            ) : quotes.length === 0 ? (
              <div style={{ fontSize:12, color:'#697386' }}>暂无报价单。请在设计师工作台生成报价。</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {quotes.map(q => (
                  <label key={q.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, cursor:'pointer' }}>
                    <input type="radio" name="quote" value={q.id} checked={selectedQuoteId === q.id} onChange={e => setSelectedQuoteId(e.target.value)} />
                    <span>{q.quotationNo} · {q.status}</span>
                    {q.costBreakdown?.total ? (
                      <span style={{ marginLeft:'auto', fontWeight:700, color:'var(--brand)' }}>¥{(q.costBreakdown.total / 10000).toFixed(1)}万</span>
                    ) : null}
                  </label>
                ))}
                <button
                  onClick={async () => {
                    if (!selectedQuoteId) return;
                    setLocking(true);
                    try { await quotation.lock(selectedQuoteId); setQuotes(qs => qs.map(q => q.id === selectedQuoteId ? { ...q, status: 'locked' } : q)); }
                    catch (e: any) { alert(`锁价失败：${e?.message ?? '未知错误'}`); }
                    setLocking(false);
                  }}
                  disabled={locking || !selectedQuoteId}
                  style={{ marginTop:4, alignSelf:'flex-start', background:'#d97706', color:'#fff', border:'none', borderRadius:5, padding:'4px 12px', fontSize:12, cursor:'pointer', opacity: locking ? 0.6 : 1 }}>
                  {locking ? '锁定中…' : '锁定报价'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 签单 → 触发 BIM 承接 */}
        {(opp.stage as string) !== 'signed' && (opp.stage as string) !== 'lost' && (
          <div style={{ marginBottom:16, padding:12, background:'#f0fdf4', borderRadius:8, border:'1px solid #bbf7d0' }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#16a34a', marginBottom:8 }}>✍️ 确认签单</div>
            <div style={{ display:'flex', gap:6 }}>
              <input value={selectedQuoteId} onChange={e => setSelectedQuoteId(e.target.value)}
                placeholder="选择或输入报价单 ID"
                style={{ flex:1, border:'1px solid var(--border-2)', borderRadius:5, padding:'6px 10px', fontSize:12, outline:'none' }} />
              <button onClick={handleSign} disabled={signing || !selectedQuoteId.trim()}
                style={{ background:'#16a34a', color:'#fff', border:'none', borderRadius:5,
                  padding:'6px 14px', fontSize:12, cursor:'pointer', whiteSpace:'nowrap',
                  opacity: signing ? 0.6 : 1 }}>
                {signing ? '处理中…' : '签单 →'}
              </button>
            </div>
            {signMsg && (
              <div style={{ fontSize:11, marginTop:5, color: signMsg.ok ? '#16a34a' : '#dc2626' }}>{signMsg.text}</div>
            )}
          </div>
        )}

        {/* 添加跟进记录 */}
        <div>
          <div style={{ fontSize:12, color:'#697386', marginBottom:6 }}>添加跟进记录</div>
          <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}
            placeholder="记录本次跟进情况、客户反馈、下一步行动…"
            style={{ width:'100%', border:'1px solid var(--border-2)', borderRadius:6, padding:'8px 10px',
              fontSize:12, resize:'none', outline:'none', fontFamily:'inherit' }} />
          <button onClick={saveNote} disabled={saving || !note.trim()}
            style={{ marginTop:6, background:'#1a1f36', color:'#fff', border:'none', borderRadius:6,
              padding:'7px 18px', fontSize:12, cursor:'pointer', opacity:saving?0.6:1 }}>
            {saving ? '保存中…' : '保存记录'}
          </button>
        </div>

        {/* 跟进时间线（真实拉取 customer360） */}
        <div style={{ marginTop:18 }}>
          <div style={{ fontSize:12, color:'#697386', marginBottom:10 }}>跟进时间线</div>
          {tlLoading ? (
            <div style={{ fontSize:12, color:'#9ca3af' }}>加载中…</div>
          ) : timeline.length === 0 ? (
            <div style={{ fontSize:12, color:'#9ca3af' }}>暂无跟进记录</div>
          ) : (
            <div style={{ position:'relative', paddingLeft:18 }}>
              <div style={{ position:'absolute', left:5, top:4, bottom:4, width:2, background:'var(--border-2)' }} />
              {timeline.map(it => (
                <div key={it.id} style={{ position:'relative', marginBottom:14 }}>
                  <div style={{ position:'absolute', left:-16, top:3, width:10, height:10, borderRadius:'50%',
                    background:'#fff', border:'2px solid var(--brand)' }} />
                  <div style={{ fontSize:11, color:'#1a1f36', fontWeight:600 }}>
                    {TYPE_LABEL[it.type] || it.type}
                    <span style={{ fontWeight:400, color:'#9ca3af', marginLeft:8 }}>{fmtDate(it.createdAt)}</span>
                  </div>
                  {it.content && <div style={{ fontSize:12, color:'#4b5563', marginTop:2, lineHeight:1.5 }}>{it.content}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PMS · 工程项目 360 视图
 * 项目信息 + 阶段流转 + 管道加权 + 决策链健康 + 规格指定矩阵 + 招投标 + 提交物.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, ArrowLeft, Users, Target, Gavel, FileText, TrendingUp, Sparkles, AlertTriangle } from 'lucide-react';

interface Detail {
  project: any;
  stakeholders: any[];
  specPositions: any[];
  opportunities: any[];
  pipeline: { opportunityCount: number; totalValue: number; weightedValue: number; wonValue: number };
  decisionChain: { totalStakeholders: number; presentRoles: string[]; missingCriticalRoles: string[]; hasChampion: boolean; hasEconomicBuyer: boolean; completeness: number };
  specCoverage: { totalPositions: number; wonValue: number; atRiskValue: number; lostValue: number; totalValue: number; specWinRate: number; atRiskCount: number };
}

const STAGE_LABELS: Record<string, string> = { lead: '立项', design: '设计选型', tender: '招投标', awarded: '中标', delivery: '交付', warranty: '质保', closed: '结案', lost: '丢标' };
const STAGE_NEXT: Record<string, string[]> = {
  lead: ['design', 'tender', 'lost'], design: ['tender', 'lost'], tender: ['awarded', 'lost'],
  awarded: ['delivery', 'lost'], delivery: ['warranty', 'closed'], warranty: ['closed'], closed: [], lost: [],
};
const ROLE_LABELS: Record<string, string> = { owner: '甲方', architect: '设计院', design_engineer: '设计工程师', general_contractor: '总包', installer: '安装商', distributor: '经销商', consultant: '顾问', other: '其他' };
const SPEC_STATUS_LABELS: Record<string, string> = { not_specified: '未指定', basis_of_design: '设计基准', specified: '已指定', alternate: '备选', substituted: '被替换', lost: '丢失' };
const SPEC_STATUS_COLOR: Record<string, string> = {
  basis_of_design: 'bg-success/15 text-success', specified: 'bg-success/15 text-success',
  alternate: 'bg-warning/15 text-warning', not_specified: 'bg-surface-2 text-ink-tertiary',
  substituted: 'bg-danger/10 text-danger', lost: 'bg-danger/10 text-danger',
};
const TENDER_STATUS_LABELS: Record<string, string> = { preparing: '编制中', submitted: '已投标', opened: '已开标', won: '中标', lost: '未中标' };
const TENDER_NEXT: Record<string, string[]> = { preparing: ['submitted', 'lost'], submitted: ['opened', 'lost'], opened: ['won', 'lost'], won: [], lost: [] };
const SUBMITTAL_TYPE_LABELS: Record<string, string> = { drawing: '图纸', spec: '规格书', technical_proposal: '技术方案', commercial_bid: '商务标', qualification: '资质', other: '其他' };
const SUBMITTAL_STATUS_LABELS: Record<string, string> = { draft: '草稿', submitted: '已提交', approved: '通过', rejected: '驳回', revision_required: '需修订' };

const inputCls = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-caption placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [data, setData] = useState<Detail | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // inline add forms
  const [shForm, setShForm] = useState({ open: false, role: 'design_engineer', name: '', company: '', influence: 'medium', isChampion: false, isEconomicBuyer: false });
  const [specForm, setSpecForm] = useState({ open: false, equipmentFamily: '', ourBrandStatus: 'not_specified', competitorBrand: '', estimatedValue: '', specStage: 'design' });

  const load = useCallback(async () => {
    try {
      setStatus('loading');
      const res = await fetch(`/api/pms/projects/${id}`, { credentials: 'include', cache: 'no-store' });
      if (res.status === 404) { setStatus('notfound'); return; }
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      setData(await res.json());
      setStatus('ok');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '加载失败');
      setStatus('error');
    }
  }, [id]);

  useEffect(() => { if (id) load(); }, [id, load]);

  async function post(body: Record<string, unknown>, path = '') {
    setBusy(true);
    try {
      const res = await fetch(`/api/pms/projects/${id}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || '操作失败');
      await load();
      return true;
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败');
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading') {
    return <div className="flex items-center justify-center py-24"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" /></div>;
  }
  if (status === 'notfound') {
    return <div className="container mx-auto max-w-3xl p-6"><Card><CardContent className="p-12 text-center text-ink-secondary">项目不存在</CardContent></Card></div>;
  }
  if (status === 'error' || !data) {
    return <div className="container mx-auto max-w-3xl p-6"><Card className="border-danger/30"><CardContent className="p-6 text-danger">{err}</CardContent></Card></div>;
  }

  const { project: p, stakeholders, specPositions, opportunities, pipeline, decisionChain: dc, specCoverage: sc } = data;

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-4xl">
      <button onClick={() => router.push('/pms/projects')} className="text-caption text-ink-secondary hover:text-ink-primary flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> 返回项目列表
      </button>

      {/* 头部 + 阶段流转 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Building2 className="w-6 h-6 text-brand-500" />
          <h1 className="text-title-lg font-bold text-ink-primary">{p.projectName}</h1>
          <span className="text-caption font-medium rounded px-2 py-0.5 bg-brand-500/10 text-brand-500">{STAGE_LABELS[p.stage] || p.stage}</span>
        </div>
        <p className="text-caption text-ink-tertiary mt-1">
          {p.projectCode}{p.region ? ` · ${p.region}` : ''}{p.designInstitute ? ` · 设计院 ${p.designInstitute}` : ''}{p.customerName ? ` · ${p.customerName}` : ''}
        </p>
        {STAGE_NEXT[p.stage]?.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-caption text-ink-tertiary">推进到:</span>
            {STAGE_NEXT[p.stage].map((s) => (
              <Button key={s} size="sm" variant={s === 'lost' ? 'outline' : 'default'} disabled={busy}
                className={s === 'lost' ? 'border-danger/30 text-danger' : 'bg-brand-500 hover:bg-brand-600'}
                onClick={() => post({ action: 'transition_stage', toStage: s })}>
                {STAGE_LABELS[s]}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* 管道 + 规格战况 概览 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card><CardContent className="p-4">
          <p className="text-caption text-ink-tertiary flex items-center gap-1"><TrendingUp className="w-3 h-3" /> 加权管道</p>
          <p className="text-title-lg font-bold text-brand-500 mt-1">¥{pipeline.weightedValue.toLocaleString('zh-CN')}</p>
          <p className="text-caption text-ink-tertiary mt-1">{pipeline.opportunityCount} 商机 · 总额 ¥{pipeline.totalValue.toLocaleString('zh-CN')}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-caption text-ink-tertiary flex items-center gap-1"><Target className="w-3 h-3" /> 规格指定率</p>
          <p className="text-title-lg font-bold text-success mt-1">{sc.specWinRate}%</p>
          <p className="text-caption text-ink-tertiary mt-1">已拿 ¥{sc.wonValue.toLocaleString('zh-CN')} · 风险 {sc.atRiskCount} 项</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-caption text-ink-tertiary flex items-center gap-1"><Users className="w-3 h-3" /> 决策链完整度</p>
          <p className="text-title-lg font-bold text-ink-primary mt-1">{dc.completeness}%</p>
          <p className="text-caption text-ink-tertiary mt-1">{dc.hasChampion ? '有内线' : '无内线'} · {dc.hasEconomicBuyer ? '有决策人' : '缺决策人'}</p>
        </CardContent></Card>
      </div>

      {/* AI 洞察 (Phase 3) */}
      <AiInsightsSection projectId={id} />

      {/* 决策链 */}
      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-headline flex items-center gap-2"><Users className="w-4 h-4 text-brand-500" /> 决策链</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShForm((f) => ({ ...f, open: !f.open }))}>+ 干系人</Button>
        </CardHeader>
        <CardContent className="pt-0">
          {dc.missingCriticalRoles.length > 0 && (
            <p className="text-caption text-warning mb-3">缺失关键角色: {dc.missingCriticalRoles.map((r) => ROLE_LABELS[r]).join('、')}</p>
          )}
          {shForm.open && (
            <div className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-md bg-surface-2">
              <select value={shForm.role} onChange={(e) => setShForm((f) => ({ ...f, role: e.target.value }))} className={inputCls}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input value={shForm.name} onChange={(e) => setShForm((f) => ({ ...f, name: e.target.value }))} placeholder="姓名" className={inputCls} />
              <input value={shForm.company} onChange={(e) => setShForm((f) => ({ ...f, company: e.target.value }))} placeholder="单位" className={inputCls} />
              <select value={shForm.influence} onChange={(e) => setShForm((f) => ({ ...f, influence: e.target.value }))} className={inputCls}>
                <option value="high">影响力高</option><option value="medium">影响力中</option><option value="low">影响力低</option>
              </select>
              <label className="text-caption text-ink-secondary flex items-center gap-1"><input type="checkbox" checked={shForm.isChampion} onChange={(e) => setShForm((f) => ({ ...f, isChampion: e.target.checked }))} /> 内线</label>
              <label className="text-caption text-ink-secondary flex items-center gap-1"><input type="checkbox" checked={shForm.isEconomicBuyer} onChange={(e) => setShForm((f) => ({ ...f, isEconomicBuyer: e.target.checked }))} /> 经济决策人</label>
              <div className="col-span-2 flex justify-end">
                <Button size="sm" disabled={busy || !shForm.name.trim()} className="bg-brand-500 hover:bg-brand-600"
                  onClick={async () => { if (await post({ action: 'add_stakeholder', ...shForm })) setShForm({ open: false, role: 'design_engineer', name: '', company: '', influence: 'medium', isChampion: false, isEconomicBuyer: false }); }}>添加</Button>
              </div>
            </div>
          )}
          {stakeholders.length === 0 ? <p className="text-caption text-ink-tertiary">暂无干系人</p> : (
            <div className="grid gap-2">
              {stakeholders.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-caption">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded px-1.5 py-0.5 bg-surface-2 text-ink-secondary">{ROLE_LABELS[s.role] || s.role}</span>
                    <span className="text-ink-primary font-medium">{s.name}</span>
                    {s.company && <span className="text-ink-tertiary">{s.company}</span>}
                    {s.isChampion && <span className="text-success">内线</span>}
                    {s.isEconomicBuyer && <span className="text-brand-500">决策人</span>}
                  </div>
                  <button className="text-ink-tertiary hover:text-danger" disabled={busy} onClick={() => post({ action: 'remove_stakeholder', stakeholderId: s.id })}>移除</button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 规格指定矩阵 */}
      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-headline flex items-center gap-2"><Target className="w-4 h-4 text-brand-500" /> 规格指定矩阵</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setSpecForm((f) => ({ ...f, open: !f.open }))}>+ 设备族</Button>
        </CardHeader>
        <CardContent className="pt-0">
          {specForm.open && (
            <div className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-md bg-surface-2">
              <input value={specForm.equipmentFamily} onChange={(e) => setSpecForm((f) => ({ ...f, equipmentFamily: e.target.value }))} placeholder="设备族 如 冷水机组" className={inputCls} />
              <select value={specForm.ourBrandStatus} onChange={(e) => setSpecForm((f) => ({ ...f, ourBrandStatus: e.target.value }))} className={inputCls}>
                {Object.entries(SPEC_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input value={specForm.competitorBrand} onChange={(e) => setSpecForm((f) => ({ ...f, competitorBrand: e.target.value }))} placeholder="竞品 如 大金" className={inputCls} />
              <input type="number" value={specForm.estimatedValue} onChange={(e) => setSpecForm((f) => ({ ...f, estimatedValue: e.target.value }))} placeholder="预算" className={inputCls} />
              <select value={specForm.specStage} onChange={(e) => setSpecForm((f) => ({ ...f, specStage: e.target.value }))} className={inputCls}>
                <option value="design">设计阶段</option><option value="tender">投标阶段</option><option value="awarded">中标阶段</option>
              </select>
              <div className="flex justify-end">
                <Button size="sm" disabled={busy || !specForm.equipmentFamily.trim()} className="bg-brand-500 hover:bg-brand-600"
                  onClick={async () => {
                    const body: any = { action: 'add_spec', equipmentFamily: specForm.equipmentFamily, ourBrandStatus: specForm.ourBrandStatus, specStage: specForm.specStage };
                    if (specForm.competitorBrand.trim()) body.competitorBrand = specForm.competitorBrand.trim();
                    if (specForm.estimatedValue.trim()) body.estimatedValue = Number(specForm.estimatedValue);
                    if (await post(body)) setSpecForm({ open: false, equipmentFamily: '', ourBrandStatus: 'not_specified', competitorBrand: '', estimatedValue: '', specStage: 'design' });
                  }}>添加</Button>
              </div>
            </div>
          )}
          {specPositions.length === 0 ? <p className="text-caption text-ink-tertiary">暂无规格位</p> : (
            <div className="grid gap-2">
              {specPositions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-caption">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-primary font-medium">{s.equipmentFamily}</span>
                    <span className={`rounded px-1.5 py-0.5 ${SPEC_STATUS_COLOR[s.ourBrandStatus] || 'bg-surface-2 text-ink-secondary'}`}>{SPEC_STATUS_LABELS[s.ourBrandStatus] || s.ourBrandStatus}</span>
                    {s.competitorBrand && <span className="text-danger">竞品 {s.competitorBrand}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {s.estimatedValue != null && <span className="text-ink-tertiary">¥{s.estimatedValue.toLocaleString('zh-CN')}</span>}
                    <button className="text-ink-tertiary hover:text-danger" disabled={busy} onClick={() => post({ action: 'remove_spec', specId: s.id })}>移除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 招投标 */}
      <TenderSection projectId={id} />

      {/* 提交物 */}
      <SubmittalSection projectId={id} />

      {/* 归属商机 (项目统领: 关联散落线索 / 项目下新建 / 移出) */}
      <OpportunitiesSection projectId={id} project={p} opportunities={opportunities} onChange={load} />
    </div>
  );

}

const OPP_STAGE_LABELS: Record<string, string> = {
  initial_contact: '初次接触', reported: '已报备', following: '跟进中', visit: '拜访', proposal: '方案',
  bidding: '招标', quote: '报价', quoted: '已报价', quotation: '报价', negotiation: '谈判',
  contract: '签约', contracted: '已签约', delivery: '交付', delivered: '已交付', won: '赢单', closed: '结案', lost: '丢单',
};

function OpportunitiesSection({ projectId, project, opportunities, onChange }: { projectId: string; project: any; opportunities: any[]; onChange: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'none' | 'create' | 'link'>('none');
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [form, setForm] = useState({ customerName: '', estimatedAmount: '', stage: 'proposal' });

  async function cpost(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/pms/projects/${projectId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || '操作失败');
      return json;
    } catch (e) { alert(e instanceof Error ? e.message : '操作失败'); return null; } finally { setBusy(false); }
  }

  async function openLink() {
    if (mode === 'link') { setMode('none'); return; }
    setMode('link');
    const json = await cpost({ action: 'list_unassigned_opportunities' });
    if (json) setUnassigned(json.opportunities || []);
  }

  return (
    <Card className="mb-4">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-headline flex items-center gap-2"><FileText className="w-4 h-4 text-brand-500" /> 归属商机 ({opportunities.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setMode((m) => (m === 'create' ? 'none' : 'create'))}>+ 新建商机</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={openLink}>关联线索</Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {mode === 'create' && (
          <div className="grid grid-cols-3 gap-2 mb-3 p-3 rounded-md bg-surface-2">
            <input value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} placeholder="客户名称" className={inputCls} />
            <input type="number" value={form.estimatedAmount} onChange={(e) => setForm((f) => ({ ...f, estimatedAmount: e.target.value }))} placeholder="预估额" className={inputCls} />
            <select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value }))} className={inputCls}>
              {['proposal', 'bidding', 'quote', 'negotiation', 'contract'].map((s) => <option key={s} value={s}>{OPP_STAGE_LABELS[s]}</option>)}
            </select>
            <div className="col-span-3 flex justify-end">
              <Button size="sm" disabled={busy || !form.customerName.trim()} className="bg-brand-500 hover:bg-brand-600"
                onClick={async () => {
                  const body: any = { action: 'create_opportunity', customerName: form.customerName.trim(), stage: form.stage };
                  if (form.estimatedAmount.trim()) body.estimatedAmount = Number(form.estimatedAmount);
                  if (await cpost(body)) { setForm({ customerName: '', estimatedAmount: '', stage: 'proposal' }); setMode('none'); await onChange(); }
                }}>创建并归入本项目</Button>
            </div>
          </div>
        )}
        {mode === 'link' && (
          <div className="mb-3 p-3 rounded-md bg-surface-2">
            {unassigned.length === 0 ? <p className="text-caption text-ink-tertiary">暂无未归属的商机线索</p> : (
              <div className="grid gap-2">
                {unassigned.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 text-caption">
                    <span className="text-ink-primary truncate">{o.customerName} · {o.projectName}</span>
                    <Button size="sm" variant="outline" className="h-7" disabled={busy}
                      onClick={async () => { if (await cpost({ action: 'link_opportunity', opportunityId: o.id })) { setUnassigned((prev) => prev.filter((x) => x.id !== o.id)); await onChange(); } }}>关联</Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {opportunities.length === 0 ? <p className="text-caption text-ink-tertiary">暂无归属商机 — 可「关联线索」或「新建商机」</p> : (
          <div className="grid gap-2">
            {opportunities.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-caption">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-ink-primary truncate">{o.customerName} · {o.projectName}</span>
                  <span className="rounded px-1.5 py-0.5 bg-surface-2 text-ink-secondary">{OPP_STAGE_LABELS[o.stage] || o.stage}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-ink-tertiary">¥{(o.estimatedAmount || 0).toLocaleString('zh-CN')}</span>
                  <button className="text-ink-tertiary hover:text-danger" disabled={busy}
                    onClick={async () => { if (await cpost({ action: 'unlink_opportunity', opportunityId: o.id })) await onChange(); }}>移出</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TenderSection({ projectId }: { projectId: string }) {
    const [tenders, setTenders] = useState<any[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [tenderForm, setTenderForm] = useState({ open: false, tenderName: '', bidAmount: '', budgetAmount: '' });
    const reload = useCallback(async () => {
      const res = await fetch(`/api/pms/projects/${projectId}/tenders`, { credentials: 'include', cache: 'no-store' });
      if (res.ok) setTenders((await res.json()).tenders || []);
      setLoaded(true);
    }, [projectId]);
    useEffect(() => { reload(); }, [reload]);

    async function tpost(body: Record<string, unknown>) {
      setBusy(true);
      try {
        const res = await fetch(`/api/pms/projects/${projectId}/tenders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
        if (!res.ok) throw new Error((await res.json()).error || '操作失败');
        await reload();
        return true;
      } catch (e) { alert(e instanceof Error ? e.message : '操作失败'); return false; } finally { setBusy(false); }
    }

    return (
      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-headline flex items-center gap-2"><Gavel className="w-4 h-4 text-brand-500" /> 招投标</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setTenderForm((f) => ({ ...f, open: !f.open }))}>+ 标段</Button>
        </CardHeader>
        <CardContent className="pt-0">
          {tenderForm.open && (
            <div className="grid grid-cols-3 gap-2 mb-3 p-3 rounded-md bg-surface-2">
              <input value={tenderForm.tenderName} onChange={(e) => setTenderForm((f) => ({ ...f, tenderName: e.target.value }))} placeholder="标段名称" className={inputCls} />
              <input type="number" value={tenderForm.budgetAmount} onChange={(e) => setTenderForm((f) => ({ ...f, budgetAmount: e.target.value }))} placeholder="控制价" className={inputCls} />
              <input type="number" value={tenderForm.bidAmount} onChange={(e) => setTenderForm((f) => ({ ...f, bidAmount: e.target.value }))} placeholder="我方报价" className={inputCls} />
              <div className="col-span-3 flex justify-end">
                <Button size="sm" disabled={busy || !tenderForm.tenderName.trim()} className="bg-brand-500 hover:bg-brand-600"
                  onClick={async () => {
                    const body: any = { action: 'create', tenderName: tenderForm.tenderName };
                    if (tenderForm.budgetAmount.trim()) body.budgetAmount = Number(tenderForm.budgetAmount);
                    if (tenderForm.bidAmount.trim()) body.bidAmount = Number(tenderForm.bidAmount);
                    if (await tpost(body)) setTenderForm({ open: false, tenderName: '', bidAmount: '', budgetAmount: '' });
                  }}>创建</Button>
              </div>
            </div>
          )}
          {!loaded ? <p className="text-caption text-ink-tertiary">加载中...</p> : tenders.length === 0 ? <p className="text-caption text-ink-tertiary">暂无标段</p> : (
            <div className="grid gap-2">
              {tenders.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-caption flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-primary font-medium">{t.tenderName}</span>
                    <span className="rounded px-1.5 py-0.5 bg-surface-2 text-ink-secondary">{TENDER_STATUS_LABELS[t.status] || t.status}</span>
                    {t.bidAmount != null && <span className="text-ink-tertiary">报价 ¥{t.bidAmount.toLocaleString('zh-CN')}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {(TENDER_NEXT[t.status] || []).map((s) => (
                      <Button key={s} size="sm" variant="outline" disabled={busy} className={s === 'lost' ? 'border-danger/30 text-danger h-7' : 'h-7'}
                        onClick={() => tpost({ action: 'transition', tenderId: t.id, toStatus: s, ...(s === 'won' ? { ourRank: 1 } : {}) })}>{TENDER_STATUS_LABELS[s]}</Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

const RISK_LEVEL_LABELS: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '极高' };
const RISK_LEVEL_COLOR: Record<string, string> = {
  low: 'bg-success/15 text-success', medium: 'bg-warning/15 text-warning',
  high: 'bg-danger/10 text-danger', critical: 'bg-danger/20 text-danger',
};

function AiInsightsSection({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [risk, setRisk] = useState<any>(null);
  const [chain, setChain] = useState<any>(null);
  const [tenderText, setTenderText] = useState('');
  const [tender, setTender] = useState<any>(null);
  const [tenderOpen, setTenderOpen] = useState(false);

  async function run(action: string, setter: (v: any) => void, extra: Record<string, unknown> = {}) {
    setBusy(action);
    try {
      const res = await fetch(`/api/pms/projects/${projectId}/ai`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '分析失败');
      setter(json);
    } catch (e) { alert(e instanceof Error ? e.message : '分析失败'); } finally { setBusy(null); }
  }

  return (
    <Card className="mb-4 border-brand-500/30">
      <CardHeader>
        <CardTitle className="text-headline flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand-500" /> AI 洞察</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 grid gap-4">
        {/* spec-in 风险预测 */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption font-medium text-ink-secondary flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> spec-in 被替换风险</span>
            <Button size="sm" variant="outline" disabled={busy === 'spec_risk'} onClick={() => run('spec_risk', setRisk)}>{busy === 'spec_risk' ? '分析中...' : '预测'}</Button>
          </div>
          {risk?.assessment && (
            <div className="mt-2 p-3 rounded-md bg-surface-2 text-caption grid gap-1">
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 ${RISK_LEVEL_COLOR[risk.assessment.riskLevel] || 'bg-surface-2'}`}>风险 {RISK_LEVEL_LABELS[risk.assessment.riskLevel]} · {risk.assessment.riskScore}/100</span>
                <span className="text-ink-tertiary">{risk.assessment.source === 'ai' ? 'AI 分析' : '规则基线'}</span>
              </div>
              <p className="text-ink-secondary">{risk.assessment.summary}</p>
              {risk.assessment.keyRisks?.length > 0 && <ul className="list-disc pl-4 text-ink-tertiary">{risk.assessment.keyRisks.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>}
              {risk.assessment.recommendedActions?.length > 0 && <div className="text-brand-500">建议: {risk.assessment.recommendedActions.join('；')}</div>}
            </div>
          )}
        </div>

        {/* 决策链智能诊断 */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption font-medium text-ink-secondary flex items-center gap-1"><Users className="w-3 h-3" /> 决策链智能诊断</span>
            <Button size="sm" variant="outline" disabled={busy === 'decision_chain'} onClick={() => run('decision_chain', setChain)}>{busy === 'decision_chain' ? '分析中...' : '诊断'}</Button>
          </div>
          {chain?.insight && (
            <div className="mt-2 p-3 rounded-md bg-surface-2 text-caption grid gap-1">
              <div className="flex items-center gap-2">
                <span className="text-ink-primary font-medium">完整度 {chain.insight.completeness}%</span>
                <span className="text-ink-tertiary">{chain.insight.source === 'ai' ? 'AI 分析' : '规则基线'}</span>
              </div>
              <p className="text-ink-secondary">{chain.insight.summary}</p>
              {chain.insight.gaps?.length > 0 && <div className="text-warning">缺口: {chain.insight.gaps.join('；')}</div>}
              {chain.insight.nextBestActions?.length > 0 && <div className="text-brand-500">下一步: {chain.insight.nextBestActions.join('；')}</div>}
            </div>
          )}
        </div>

        {/* 招投标文档解析 */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption font-medium text-ink-secondary flex items-center gap-1"><Gavel className="w-3 h-3" /> 招投标文档解析</span>
            <Button size="sm" variant="outline" onClick={() => setTenderOpen((v) => !v)}>{tenderOpen ? '收起' : '粘贴文本'}</Button>
          </div>
          {tenderOpen && (
            <div className="mt-2 grid gap-2">
              <textarea value={tenderText} onChange={(e) => setTenderText(e.target.value)} placeholder="粘贴招标 / 技术要求文本..." rows={5}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-caption placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <div className="flex justify-end">
                <Button size="sm" disabled={busy === 'tender_analysis' || !tenderText.trim()} className="bg-brand-500 hover:bg-brand-600"
                  onClick={() => run('tender_analysis', setTender, { text: tenderText })}>{busy === 'tender_analysis' ? '解析中...' : '解析'}</Button>
              </div>
            </div>
          )}
          {tender?.analysis && (
            <div className="mt-2 p-3 rounded-md bg-surface-2 text-caption grid gap-1.5">
              <p className="text-ink-secondary">{tender.analysis.summary}</p>
              {tender.analysis.keyRequirements?.length > 0 && <div><span className="text-ink-tertiary">关键要求: </span>{tender.analysis.keyRequirements.join('；')}</div>}
              {tender.analysis.deadlines?.length > 0 && <div><span className="text-ink-tertiary">时间节点: </span>{tender.analysis.deadlines.map((d: any) => `${d.label}${d.date ? '(' + d.date + ')' : ''}`).join('、')}</div>}
              {tender.analysis.qualificationRequirements?.length > 0 && <div><span className="text-ink-tertiary">资质要求: </span>{tender.analysis.qualificationRequirements.join('；')}</div>}
              {tender.analysis.scoringCriteria?.length > 0 && <div><span className="text-ink-tertiary">评分办法: </span>{tender.analysis.scoringCriteria.join('；')}</div>}
              {tender.analysis.riskFlags?.length > 0 && <div className="text-danger">风险点: {tender.analysis.riskFlags.join('；')}</div>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SubmittalSection({ projectId }: { projectId: string }) {
    const [subs, setSubs] = useState<any[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [subForm, setSubForm] = useState({ open: false, title: '', docType: 'technical_proposal' });
    const reload = useCallback(async () => {
      const res = await fetch(`/api/pms/projects/${projectId}/submittals`, { credentials: 'include', cache: 'no-store' });
      if (res.ok) setSubs((await res.json()).submittals || []);
      setLoaded(true);
    }, [projectId]);
    useEffect(() => { reload(); }, [reload]);

    async function spost(body: Record<string, unknown>) {
      setBusy(true);
      try {
        const res = await fetch(`/api/pms/projects/${projectId}/submittals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
        if (!res.ok) throw new Error((await res.json()).error || '操作失败');
        await reload();
        return true;
      } catch (e) { alert(e instanceof Error ? e.message : '操作失败'); return false; } finally { setBusy(false); }
    }

    return (
      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-headline flex items-center gap-2"><FileText className="w-4 h-4 text-brand-500" /> 提交物</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setSubForm((f) => ({ ...f, open: !f.open }))}>+ 文档</Button>
        </CardHeader>
        <CardContent className="pt-0">
          {subForm.open && (
            <div className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-md bg-surface-2">
              <input value={subForm.title} onChange={(e) => setSubForm((f) => ({ ...f, title: e.target.value }))} placeholder="文档标题" className={inputCls} />
              <select value={subForm.docType} onChange={(e) => setSubForm((f) => ({ ...f, docType: e.target.value }))} className={inputCls}>
                {Object.entries(SUBMITTAL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="col-span-2 flex justify-end">
                <Button size="sm" disabled={busy || !subForm.title.trim()} className="bg-brand-500 hover:bg-brand-600"
                  onClick={async () => { if (await spost({ action: 'create', title: subForm.title, docType: subForm.docType })) setSubForm({ open: false, title: '', docType: 'technical_proposal' }); }}>创建</Button>
              </div>
            </div>
          )}
          {!loaded ? <p className="text-caption text-ink-tertiary">加载中...</p> : subs.length === 0 ? <p className="text-caption text-ink-tertiary">暂无提交物</p> : (
            <div className="grid gap-2">
              {subs.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-caption flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded px-1.5 py-0.5 bg-surface-2 text-ink-secondary">{SUBMITTAL_TYPE_LABELS[s.docType] || s.docType}</span>
                    <span className="text-ink-primary font-medium">{s.title}</span>
                    <span className="text-ink-tertiary">v{s.version}</span>
                    <span className="text-ink-tertiary">{SUBMITTAL_STATUS_LABELS[s.status] || s.status}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {s.status === 'draft' && <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => spost({ action: 'review', submittalId: s.id, status: 'submitted' })}>提交</Button>}
                    {(s.status === 'submitted') && <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => spost({ action: 'review', submittalId: s.id, status: 'approved' })}>通过</Button>}
                    <Button size="sm" variant="outline" className="h-7" disabled={busy} onClick={() => spost({ action: 'revise', submittalId: s.id })}>新版本</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

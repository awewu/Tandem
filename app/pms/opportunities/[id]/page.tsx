/**
 * PMS · 商机详情
 */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Edit, Trash2, MessageSquare, Save, X, ArrowRight, FileText } from 'lucide-react';

const OPPORTUNITY_STAGES = [
  { value: 'initial_contact', label: '初步接触' },
  { value: 'following', label: '跟进中' },
  { value: 'quoted', label: '已报价' },
  { value: 'contracted', label: '已签约' },
  { value: 'delivered', label: '已交付' },
  { value: 'closed', label: '已结案' },
  { value: 'lost', label: '丢单' },
];

const OPPORTUNITY_STATUSES = [
  { value: 'active', label: '活跃' },
  { value: 'won', label: '赢单' },
  { value: 'lost', label: '输单' },
  { value: 'duplicate', label: '撞单' },
  { value: 'cancelled', label: '取消' },
  { value: 'archived', label: '归档' },
];

const NEXT_STAGE: Record<string, string[]> = {
  initial_contact: ['following', 'quoted', 'lost'],
  reported: ['following', 'lost'],
  following: ['quoted', 'lost'],
  quoted: ['contracted', 'lost'],
  contracted: ['delivered', 'lost'],
  delivered: ['closed'],
  closed: [],
  lost: [],
};

const stageLabel = (stage: string) => OPPORTUNITY_STAGES.find((s) => s.value === stage)?.label ?? stage;
const statusLabel = (status: string) => OPPORTUNITY_STATUSES.find((s) => s.value === status)?.label ?? status;

function statusForStage(stage: string): string {
  if (stage === 'lost') return 'lost';
  if (stage === 'closed') return 'won';
  return 'active';
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function opportunityToForm(opportunity: any) {
  return {
    customerName: opportunity.customerName ?? '',
    customerIndustry: opportunity.customerIndustry ?? '',
    contactName: opportunity.contactName ?? '',
    contactTitle: opportunity.contactTitle ?? '',
    customerPhone: opportunity.customerPhone ?? '',
    customerAddress: opportunity.customerAddress ?? '',
    projectName: opportunity.projectName ?? '',
    estimatedAmount: opportunity.estimatedAmount == null ? '' : String(opportunity.estimatedAmount),
    estimatedClosingDate: opportunity.estimatedClosingDate ?? '',
    productLine: opportunity.productLine ?? '',
    region: opportunity.region ?? '',
    channel: opportunity.channel ?? '',
    leadSource: opportunity.leadSource ?? '',
    competitors: Array.isArray(opportunity.competitors) ? opportunity.competitors.join('，') : '',
    stage: opportunity.stage ?? 'initial_contact',
    status: opportunity.status ?? 'active',
  };
}

function InfoField({
  label,
  value,
  className = '',
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`min-w-0 space-y-1 ${className}`}>
      <Label className="text-caption text-ink-tertiary">{label}</Label>
      <div className={highlight ? 'text-title-3 font-semibold text-brand-500' : 'break-words text-body text-ink-primary'}>
        {value}
      </div>
    </div>
  );
}

export default function OpportunityDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [opportunity, setOpportunity] = useState<any>(null);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(() => opportunityToForm({}));
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpContent, setFollowUpContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadOpportunity();
    loadFollowUps();
  }, [id]);

  async function loadOpportunity() {
    try {
      const res = await fetch(`/api/pms/opportunities/${id}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      
      if (res.status === 404) {
        setError('商机不存在');
        return;
      }
      
      if (!res.ok) throw new Error('加载失败');
      
      const data = await res.json();
      setOpportunity(data.opportunity);
      setFormData(opportunityToForm(data.opportunity));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function patchOpportunity(patch: Record<string, unknown>) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/pms/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      setOpportunity(data.opportunity);
      setFormData(opportunityToForm(data.opportunity));
      return data.opportunity;
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败';
      setSaveError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    const customerName = formData.customerName.trim();
    const projectName = formData.projectName.trim();
    if (!customerName || !projectName) {
      setSaveError('客户名称和项目名称必填');
      return;
    }
    const competitors = formData.competitors
      .split(/[,，、]/)
      .map((s: string) => s.trim())
      .filter(Boolean);

    try {
      await patchOpportunity({
        customerName,
        projectName,
        customerIndustry: optionalText(formData.customerIndustry),
        contactName: optionalText(formData.contactName),
        contactTitle: optionalText(formData.contactTitle),
        customerPhone: optionalText(formData.customerPhone),
        customerAddress: optionalText(formData.customerAddress),
        estimatedAmount: formData.estimatedAmount ? Number(formData.estimatedAmount) : null,
        estimatedClosingDate: optionalText(formData.estimatedClosingDate),
        productLine: optionalText(formData.productLine),
        region: optionalText(formData.region),
        channel: optionalText(formData.channel),
        leadSource: optionalText(formData.leadSource),
        competitors: competitors.length > 0 ? competitors : null,
      });
      setEditing(false);
    } catch {
      /* message shown inline */
    }
  }

  async function handleSaveStatus(nextStage = formData.stage, nextStatus = formData.status) {
    try {
      await patchOpportunity({ stage: nextStage, status: nextStatus });
    } catch {
      /* message shown inline */
    }
  }

  async function handleAdvanceStage(stage: string) {
    await handleSaveStatus(stage, statusForStage(stage));
  }

  async function loadFollowUps() {
    try {
      const res = await fetch(`/api/pms/follow-ups?opportunityId=${id}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      
      if (!res.ok) return;
      
      const data = await res.json();
      setFollowUps(data.followUps || []);
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
    }
  }

  async function handleAddFollowUp() {
    if (!followUpContent.trim()) return;
    
    try {
      setSubmitting(true);
      const res = await fetch('/api/pms/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          opportunityId: id,
          stage: opportunity.stage,
          content: followUpContent,
        }),
      });
      
      if (!res.ok) throw new Error('添加失败');
      
      setFollowUpContent('');
      setShowFollowUpForm(false);
      loadFollowUps();
      loadOpportunity(); // 刷新商机（更新 lastFollowUpAt）
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive() {
    if (!confirm('确定要归档此商机吗？')) return;
    
    try {
      const res = await fetch(`/api/pms/opportunities/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('归档失败');
      
      router.push('/pms');
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500 mx-auto mb-4"></div>
          <p className="text-ink-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-danger">加载失败</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-ink-secondary">{error || '商机不存在'}</p>
            <Button onClick={() => router.push('/pms')} className="mt-4">
              返回列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-5 md:px-6">
      <div className="mb-5">
        <Button
          variant="ghost"
          onClick={() => router.push('/pms')}
          className="mb-3"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回列表
        </Button>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-title-lg font-bold text-ink-primary">
              {opportunity.customerName}
            </h1>
            <p className="text-body text-ink-secondary mt-1">
              {opportunity.projectName}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(
                  `/pms/quotes?opp=${encodeURIComponent(opportunity.id)}&customer=${encodeURIComponent(opportunity.customerName)}`,
                )
              }
            >
              <FileText className="w-4 h-4 mr-2" />
              官方报价
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFormData(opportunityToForm(opportunity));
                setSaveError(null);
                setEditing(true);
              }}
            >
              <Edit className="w-4 h-4 mr-2" />
              重新编辑
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchive}
              className="text-danger hover:text-danger"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              归档
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-5">
          <Card className="rounded-md">
            <CardHeader className="p-5 pb-3">
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {editing ? (
                <form onSubmit={handleSaveDetails} className="space-y-4">
                  {saveError && (
                    <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-caption text-danger">
                      {saveError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-customer-name">客户名称 *</Label>
                      <Input id="edit-customer-name" value={formData.customerName} onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} required />
                    </div>
                    <div>
                      <Label htmlFor="edit-customer-industry">客户行业</Label>
                      <Input id="edit-customer-industry" value={formData.customerIndustry} onChange={(e) => setFormData({ ...formData, customerIndustry: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="edit-contact-name">联系人</Label>
                      <Input id="edit-contact-name" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="edit-contact-title">职务</Label>
                      <Input id="edit-contact-title" value={formData.contactTitle} onChange={(e) => setFormData({ ...formData, contactTitle: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="edit-customer-phone">联系电话</Label>
                      <Input id="edit-customer-phone" value={formData.customerPhone} onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit-customer-address">项目地址</Label>
                    <Input id="edit-customer-address" value={formData.customerAddress} onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="edit-project-name">项目名称 *</Label>
                    <Input id="edit-project-name" value={formData.projectName} onChange={(e) => setFormData({ ...formData, projectName: e.target.value })} required />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-estimated-amount">预估金额</Label>
                      <Input id="edit-estimated-amount" type="number" value={formData.estimatedAmount} onChange={(e) => setFormData({ ...formData, estimatedAmount: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="edit-estimated-date">预计成交日期</Label>
                      <Input id="edit-estimated-date" type="date" value={formData.estimatedClosingDate} onChange={(e) => setFormData({ ...formData, estimatedClosingDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="edit-product-line">产品线</Label>
                      <Input id="edit-product-line" value={formData.productLine} onChange={(e) => setFormData({ ...formData, productLine: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="edit-region">区域</Label>
                      <Input id="edit-region" value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="edit-channel">渠道</Label>
                      <Input id="edit-channel" value={formData.channel} onChange={(e) => setFormData({ ...formData, channel: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-lead-source">线索来源</Label>
                      <Input id="edit-lead-source" value={formData.leadSource} onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })} />
                    </div>
                    <div>
                      <Label htmlFor="edit-competitors">竞争对手</Label>
                      <Input id="edit-competitors" value={formData.competitors} onChange={(e) => setFormData({ ...formData, competitors: e.target.value })} placeholder="逗号分隔" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFormData(opportunityToForm(opportunity));
                        setSaveError(null);
                        setEditing(false);
                      }}
                      disabled={saving}
                    >
                      <X className="w-4 h-4 mr-2" />
                      取消
                    </Button>
                    <Button type="submit" disabled={saving} className="bg-brand-500 hover:bg-brand-600">
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? '保存中...' : '保存修改'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoField label="客户名称" value={opportunity.customerName} />
                  <InfoField label="客户行业" value={opportunity.customerIndustry || '-'} />
                  <InfoField label="联系人" value={opportunity.contactName || '-'} />
                  <InfoField label="职务" value={opportunity.contactTitle || '-'} />
                  <InfoField label="联系电话" value={opportunity.customerPhone || '-'} />
                  <InfoField label="项目名称" value={opportunity.projectName} />
                  <InfoField label="项目地址" value={opportunity.customerAddress || '-'} className="sm:col-span-2" />
                  <InfoField
                    label="预估金额"
                    value={`¥${opportunity.estimatedAmount?.toLocaleString() || '-'}`}
                    highlight
                  />
                  <InfoField label="预计成交日期" value={opportunity.estimatedClosingDate || '-'} />
                  <InfoField label="产品线" value={opportunity.productLine || '-'} />
                  <InfoField label="区域" value={opportunity.region || '-'} />
                  <InfoField label="渠道" value={opportunity.channel || '-'} />
                  <InfoField label="线索来源" value={opportunity.leadSource || '-'} />
                  <div className="min-w-0 space-y-1 sm:col-span-2">
                    <Label className="text-caption text-ink-tertiary">竞争对手</Label>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {opportunity.competitors && opportunity.competitors.length > 0
                          ? opportunity.competitors.map((c: string) => (
                              <span key={c} className="text-caption text-ink-secondary bg-surface-2 border border-border rounded px-2 py-0.5">{c}</span>
                            ))
                          : <span className="text-ink-primary">-</span>}
                      </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-md">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>跟进记录</CardTitle>
                <Button
                  size="sm"
                  onClick={() => setShowFollowUpForm(!showFollowUpForm)}
                  className="bg-brand-500 hover:bg-brand-600"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  添加跟进
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {showFollowUpForm && (
                <div className="mb-4 p-4 border border-border rounded-lg">
                  <Textarea
                    value={followUpContent}
                    onChange={(e) => setFollowUpContent(e.target.value)}
                    placeholder="记录本次跟进内容..."
                    rows={3}
                    className="mb-2"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowFollowUpForm(false);
                        setFollowUpContent('');
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddFollowUp}
                      disabled={submitting || !followUpContent.trim()}
                      className="bg-brand-500 hover:bg-brand-600"
                    >
                      {submitting ? '提交中...' : '提交'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {followUps.length === 0 ? (
                  <p className="text-center text-ink-tertiary py-8">暂无跟进记录</p>
                ) : (
                  followUps.map((followUp) => (
                    <div
                      key={followUp.id}
                      className="p-3 border border-border rounded-lg"
                    >
                      <p className="text-ink-primary">{followUp.content}</p>
                      <p className="text-caption text-ink-tertiary mt-2">
                        {new Date(followUp.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-md lg:sticky lg:top-4">
            <CardHeader className="p-5 pb-3">
              <CardTitle>状态信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              {saveError && !editing && (
                <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-caption text-danger">
                  {saveError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-caption text-ink-tertiary">当前阶段</Label>
                  <span className="inline-flex max-w-full items-center rounded-full bg-brand-100 px-2.5 py-1 text-caption text-brand-700">
                    <span className="truncate">{stageLabel(opportunity.stage)}</span>
                  </span>
                </div>
                <div className="space-y-1">
                  <Label className="text-caption text-ink-tertiary">状态</Label>
                  <span className="inline-flex max-w-full items-center rounded-full bg-success/10 px-2.5 py-1 text-caption text-success">
                    <span className="truncate">{statusLabel(opportunity.status)}</span>
                  </span>
                </div>
              </div>
              <div className="space-y-2 rounded-md border border-border bg-surface-1 p-3">
                <Label className="text-caption text-ink-tertiary">手动调整</Label>
                <select
                  value={formData.stage}
                  onChange={(e) => {
                    const stage = e.target.value;
                    setFormData({ ...formData, stage, status: statusForStage(stage) });
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-caption text-ink-primary"
                >
                  {OPPORTUNITY_STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                  ))}
                </select>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-caption text-ink-primary"
                >
                  {OPPORTUNITY_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => void handleSaveStatus()}
                  disabled={saving || (formData.stage === opportunity.stage && formData.status === opportunity.status)}
                  className="h-9 w-full bg-brand-500 hover:bg-brand-600"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? '保存中...' : '保存状态'}
                </Button>
              </div>
              {(NEXT_STAGE[opportunity.stage] ?? []).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-caption text-ink-tertiary">阶段推进</Label>
                  <div className="flex flex-col gap-2">
                    {(NEXT_STAGE[opportunity.stage] ?? []).map((stage) => (
                      <Button
                        key={stage}
                        variant={stage === 'lost' ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => void handleAdvanceStage(stage)}
                        disabled={saving}
                        className={stage === 'lost' ? 'h-9 border-danger/30 text-danger' : 'h-9 bg-brand-500 hover:bg-brand-600'}
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        进入{stageLabel(stage)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2 border-t border-border pt-3 text-caption">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink-tertiary">最后跟进</span>
                  <span className="text-right text-ink-primary">
                    {opportunity.lastFollowUpAt
                      ? new Date(opportunity.lastFollowUpAt).toLocaleString('zh-CN')
                      : '未跟进'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-ink-tertiary">创建时间</span>
                  <span className="text-right text-ink-primary">
                    {new Date(opportunity.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

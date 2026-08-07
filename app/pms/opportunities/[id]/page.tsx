/**
 * PMS · 商机详情
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Edit, Trash2, MessageSquare, Save, X, Waves, FileText, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';

// L2C 商机阶段漏斗 (有序 — 支持推进到后续节点)
const STAGES: Array<{ value: string; label: string }> = [
  { value: 'initial_contact', label: '初次接触' },
  { value: 'reported', label: '已报备' },
  { value: 'following', label: '跟进中' },
  { value: 'proposal', label: '方案' },
  { value: 'bidding', label: '招标' },
  { value: 'quoted', label: '已报价' },
  { value: 'negotiation', label: '谈判' },
  { value: 'contract', label: '签约' },
  { value: 'won', label: '赢单' },
  { value: 'lost', label: '丢单' },
];
const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGES.map((s) => [s.value, s.label]));

const STATUSES: Array<{ value: string; label: string }> = [
  { value: 'active', label: '进行中' },
  { value: 'won', label: '赢单' },
  { value: 'lost', label: '丢单' },
  { value: 'paused', label: '暂停' },
];
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

const REVIEW_META: Record<string, { label: string; cls: string }> = {
  pending_review: { label: '待审核', cls: 'bg-warning/10 text-warning' },
  approved: { label: '已通过', cls: 'bg-success/10 text-success' },
  rejected: { label: '已驳回', cls: 'bg-danger/10 text-danger' },
};

const selectCls =
  'mt-1 w-full px-3 py-2 border border-border rounded-2xl bg-surface-1 text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50';

interface EditForm {
  contactName: string;
  contactTitle: string;
  customerPhone: string;
  customerAddress: string;
  customerIndustry: string;
  leadSource: string;
  competitors: string;
  estimatedAmount: string;
  estimatedClosingDate: string;
  region: string;
  channel: string;
}

export default function OpportunityDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [opportunity, setOpportunity] = useState<any>(null);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpContent, setFollowUpContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingField, setSavingField] = useState<'stage' | 'status' | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [duplicateReviewDecision, setDuplicateReviewDecision] = useState<'duplicate' | 'not_duplicate'>('duplicate');
  const [duplicateReviewNote, setDuplicateReviewNote] = useState('');
  const [submittingDuplicateReview, setSubmittingDuplicateReview] = useState(false);

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

  function startEdit() {
    setActionError(null);
    setEditForm({
      contactName: opportunity.contactName || '',
      contactTitle: opportunity.contactTitle || '',
      customerPhone: opportunity.customerPhone || '',
      customerAddress: opportunity.customerAddress || '',
      customerIndustry: opportunity.customerIndustry || '',
      leadSource: opportunity.leadSource || '',
      competitors: Array.isArray(opportunity.competitors) ? opportunity.competitors.join('、') : '',
      estimatedAmount: opportunity.estimatedAmount != null ? String(opportunity.estimatedAmount) : '',
      estimatedClosingDate: opportunity.estimatedClosingDate || '',
      region: opportunity.region || '',
      channel: opportunity.channel || '',
    });
    setEditing(true);
  }

  async function patchOpportunity(patch: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/pms/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || '保存失败');
    }
    return true;
  }

  async function handleSaveEdit() {
    if (!editForm) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      await patchOpportunity({
        contactName: editForm.contactName.trim() || undefined,
        contactTitle: editForm.contactTitle.trim() || undefined,
        customerPhone: editForm.customerPhone.trim() || undefined,
        customerAddress: editForm.customerAddress.trim() || undefined,
        customerIndustry: editForm.customerIndustry.trim() || undefined,
        leadSource: editForm.leadSource.trim() || undefined,
        competitors: editForm.competitors.trim()
          ? editForm.competitors.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
          : [],
        estimatedAmount: editForm.estimatedAmount.trim() ? Number(editForm.estimatedAmount) : undefined,
        estimatedClosingDate: editForm.estimatedClosingDate.trim() || undefined,
        region: editForm.region.trim() || undefined,
        channel: editForm.channel.trim() || undefined,
      });
      setEditing(false);
      await loadOpportunity();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleChangeStage(stage: string) {
    if (stage === opportunity.stage) return;
    setSavingField('stage');
    setActionError(null);
    try {
      await patchOpportunity({ stage });
      await loadOpportunity();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSavingField(null);
    }
  }

  async function handleChangeStatus(status: string) {
    if (status === opportunity.status) return;
    setSavingField('status');
    setActionError(null);
    try {
      await patchOpportunity({ status });
      await loadOpportunity();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSavingField(null);
    }
  }

  async function handleReleaseToPool() {
    if (!confirm('确定要将此商机释放到公海池吗？释放后其他人可认领。')) return;
    setReleasing(true);
    setActionError(null);
    try {
      const res = await fetch('/api/pms/public-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'release', opportunityId: id, releasedReason: 'manual_release' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '释放失败');
      }
      await loadOpportunity();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setReleasing(false);
    }
  }

  async function handleSubmitDuplicateReview(decision: 'duplicate' | 'not_duplicate') {
    setSubmittingDuplicateReview(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/pms/opportunities/${id}/duplicate-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          decision,
          note: duplicateReviewNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || '上传核验结果失败');
      }
      setDuplicateReviewOpen(false);
      setDuplicateReviewNote('');
      await loadOpportunity();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingDuplicateReview(false);
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
    <div className="container mx-auto md:max-w-4xl p-6 max-w-5xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/pms')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回列表
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-title-lg font-bold text-ink-primary">
              {opportunity.customerName}
            </h1>
            <p className="text-body text-ink-secondary mt-1">
              {opportunity.projectName}
            </p>
            {opportunity.isDuplicateNow && opportunity.duplicateStatus !== 'resolved' && (
              <span className="inline-flex items-center gap-1 mt-2 rounded-full border border-danger/20 bg-danger/10 px-2.5 py-1 text-caption text-danger">
                <AlertTriangle className="h-3.5 w-3.5" />
                疑似重复，待人工核验
              </span>
            )}
            {opportunity.duplicateStatus === 'resolved' && (
              <span className="inline-flex items-center gap-1 mt-2 rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-caption text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                已上传核验结果
              </span>
            )}
            {opportunity.reviewStatus && REVIEW_META[opportunity.reviewStatus] && (
              <span className={`inline-flex items-center mt-2 px-2.5 py-0.5 rounded-full text-caption ${REVIEW_META[opportunity.reviewStatus].cls}`}>
                报备{REVIEW_META[opportunity.reviewStatus].label}
                {opportunity.reviewStatus === 'pending_review' && ' — 待信息管理岗审核后计入漏斗'}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="bg-brand-500 hover:bg-brand-600"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savingEdit ? '保存中...' : '保存'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={savingEdit}>
                  <X className="w-4 h-4 mr-2" />
                  取消
                </Button>
              </>
            ) : (
              <>
                {opportunity.isDuplicateNow && opportunity.duplicateStatus !== 'resolved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDuplicateReviewOpen(true)}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    上传核验结果
                  </Button>
                )}
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
                <Button variant="outline" size="sm" onClick={startEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  编辑
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
              </>
            )}
          </div>
        </div>
        {actionError && (
          <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/5 p-3 text-caption text-danger">
            {actionError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing && editForm ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-ink-tertiary">客户名称</Label>
                      <p className="text-ink-primary mt-1">{opportunity.customerName}<span className="text-caption text-ink-tertiary ml-1">(不可改)</span></p>
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">客户行业</Label>
                      <Input className="mt-1" value={editForm.customerIndustry} onChange={(e) => setEditForm({ ...editForm, customerIndustry: e.target.value })} placeholder="医院 / 学校 / 酒店…" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-ink-tertiary">联系人</Label>
                      <Input className="mt-1" value={editForm.contactName} onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">职务</Label>
                      <Input className="mt-1" value={editForm.contactTitle} onChange={(e) => setEditForm({ ...editForm, contactTitle: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">联系电话</Label>
                      <Input className="mt-1" value={editForm.customerPhone} onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-ink-tertiary">项目地址</Label>
                    <Input className="mt-1" value={editForm.customerAddress} onChange={(e) => setEditForm({ ...editForm, customerAddress: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-ink-tertiary">项目名称</Label>
                    <p className="text-ink-primary mt-1">{opportunity.projectName}<span className="text-caption text-ink-tertiary ml-1">(不可改)</span></p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-ink-tertiary">预估金额（元）</Label>
                      <Input className="mt-1" type="number" value={editForm.estimatedAmount} onChange={(e) => setEditForm({ ...editForm, estimatedAmount: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">预计成交日期</Label>
                      <Input className="mt-1" type="date" value={editForm.estimatedClosingDate} onChange={(e) => setEditForm({ ...editForm, estimatedClosingDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-ink-tertiary">区域</Label>
                      <Input className="mt-1" value={editForm.region} onChange={(e) => setEditForm({ ...editForm, region: e.target.value })} placeholder="华北 / 华东…" />
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">渠道</Label>
                      <Input className="mt-1" value={editForm.channel} onChange={(e) => setEditForm({ ...editForm, channel: e.target.value })} placeholder="直销 / 经销…" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-ink-tertiary">线索来源</Label>
                      <Input className="mt-1" value={editForm.leadSource} onChange={(e) => setEditForm({ ...editForm, leadSource: e.target.value })} placeholder="设计院 / 招标网…" />
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">竞争对手</Label>
                      <Input className="mt-1" value={editForm.competitors} onChange={(e) => setEditForm({ ...editForm, competitors: e.target.value })} placeholder="开利、麦克维尔 (顿号/逗号分隔)" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-ink-tertiary">客户名称</Label>
                      <p className="text-ink-primary mt-1">{opportunity.customerName}</p>
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">客户行业</Label>
                      <p className="text-ink-primary mt-1">{opportunity.customerIndustry || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-ink-tertiary">联系人</Label>
                      <p className="text-ink-primary mt-1">{opportunity.contactName || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">职务</Label>
                      <p className="text-ink-primary mt-1">{opportunity.contactTitle || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">联系电话</Label>
                      <p className="text-ink-primary mt-1">{opportunity.customerPhone || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-ink-tertiary">项目地址</Label>
                    <p className="text-ink-primary mt-1">{opportunity.customerAddress || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-ink-tertiary">项目名称</Label>
                    <p className="text-ink-primary mt-1">{opportunity.projectName}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-ink-tertiary">预估金额</Label>
                      <p className="text-ink-primary mt-1 text-headline font-semibold text-brand-500">
                        ¥{opportunity.estimatedAmount?.toLocaleString() || '-'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">预计成交日期</Label>
                      <p className="text-ink-primary mt-1">
                        {opportunity.estimatedClosingDate || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-ink-tertiary">产品线</Label>
                      <p className="text-ink-primary mt-1">{opportunity.productLine || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">区域</Label>
                      <p className="text-ink-primary mt-1">{opportunity.region || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">渠道</Label>
                      <p className="text-ink-primary mt-1">{opportunity.channel || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-ink-tertiary">线索来源</Label>
                      <p className="text-ink-primary mt-1">{opportunity.leadSource || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-ink-tertiary">竞争对手</Label>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {opportunity.competitors && opportunity.competitors.length > 0
                          ? opportunity.competitors.map((c: string) => (
                              <span key={c} className="text-caption text-ink-secondary bg-surface-2 border border-border rounded px-2 py-0.5">{c}</span>
                            ))
                          : <span className="text-ink-primary">-</span>}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
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
            <CardContent>
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
          <Card>
            <CardHeader>
              <CardTitle>状态信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-ink-tertiary">当前阶段 — 可推进到后续节点</Label>
                <select
                  className={selectCls}
                  value={STAGE_LABEL[opportunity.stage] ? opportunity.stage : ''}
                  disabled={savingField === 'stage' || opportunity.status === 'released'}
                  onChange={(e) => handleChangeStage(e.target.value)}
                >
                  {!STAGE_LABEL[opportunity.stage] && (
                    <option value="">{opportunity.stage || '未知阶段'}</option>
                  )}
                  {STAGES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {savingField === 'stage' && <p className="text-caption text-ink-tertiary mt-1">保存中…</p>}
              </div>
              <div>
                <Label className="text-ink-tertiary">状态</Label>
                <select
                  className={selectCls}
                  value={STATUS_LABEL[opportunity.status] ? opportunity.status : ''}
                  disabled={savingField === 'status' || opportunity.status === 'released'}
                  onChange={(e) => handleChangeStatus(e.target.value)}
                >
                  {!STATUS_LABEL[opportunity.status] && (
                    <option value="">{opportunity.status || '未知状态'}</option>
                  )}
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {savingField === 'status' && <p className="text-caption text-ink-tertiary mt-1">保存中…</p>}
              </div>
              <div>
                <Label className="text-ink-tertiary">最后跟进时间</Label>
                <p className="text-ink-primary mt-1">
                  {opportunity.lastFollowUpAt
                    ? new Date(opportunity.lastFollowUpAt).toLocaleString('zh-CN')
                    : '未跟进'}
                </p>
              </div>
              <div>
                <Label className="text-ink-tertiary">创建时间</Label>
                <p className="text-ink-primary mt-1">
                  {new Date(opportunity.createdAt).toLocaleString('zh-CN')}
                </p>
              </div>
              <div className="pt-2 border-t border-border">
                {opportunity.status === 'released' ? (
                  <p className="text-caption text-warning flex items-center gap-1">
                    <Waves className="w-4 h-4" /> 已释放到公海池，等待认领
                  </p>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-brand-600 hover:text-brand-700"
                    disabled={releasing}
                    onClick={handleReleaseToPool}
                  >
                    <Waves className="w-4 h-4 mr-2" />
                    {releasing ? '释放中...' : '释放到公海池'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={duplicateReviewOpen} onOpenChange={setDuplicateReviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>上传疑似重复核验结果</DialogTitle>
            <DialogDescription>
              请选择人工核验结果。提交后会写入重复核验记录，并将当前商机标记为已核验。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Textarea
              value={duplicateReviewNote}
              onChange={(e) => setDuplicateReviewNote(e.target.value)}
              placeholder="填写核验说明，例如：与 XX 项目确认非重复，或已确认与现有商机重复。"
              rows={4}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={duplicateReviewDecision === 'duplicate' ? 'default' : 'outline'}
                onClick={() => setDuplicateReviewDecision('duplicate')}
                className={duplicateReviewDecision === 'duplicate' ? 'bg-brand-500 hover:bg-brand-600' : ''}
              >
                判定重复
              </Button>
              <Button
                type="button"
                variant={duplicateReviewDecision === 'not_duplicate' ? 'default' : 'outline'}
                onClick={() => setDuplicateReviewDecision('not_duplicate')}
                className={duplicateReviewDecision === 'not_duplicate' ? 'bg-brand-500 hover:bg-brand-600' : ''}
              >
                判定非重复
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateReviewOpen(false)} disabled={submittingDuplicateReview}>
              取消
            </Button>
            <Button
              onClick={() => void handleSubmitDuplicateReview(duplicateReviewDecision)}
              disabled={submittingDuplicateReview}
              className="bg-brand-500 hover:bg-brand-600"
            >
              {submittingDuplicateReview ? '提交中...' : '上传结果'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

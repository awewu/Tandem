/**
 * PMS · 商机详情
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Edit, Trash2, MessageSquare } from 'lucide-react';

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
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
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
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-ink-tertiary">客户名称</Label>
                  <p className="text-ink-primary mt-1">{opportunity.customerName}</p>
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
                <Label className="text-ink-tertiary">当前阶段</Label>
                <p className="mt-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-caption bg-brand-100 text-brand-700">
                    {opportunity.stage}
                  </span>
                </p>
              </div>
              <div>
                <Label className="text-ink-tertiary">状态</Label>
                <p className="mt-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-caption bg-success/10 text-success">
                    {opportunity.status}
                  </span>
                </p>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

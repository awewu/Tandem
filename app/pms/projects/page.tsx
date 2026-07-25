/**
 * PMS · 工程项目列表 (项目型销售)
 * 阶段筛选 + 新建项目 + 卡片(阶段/区域/设计院/预估额).
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Building2, Plus } from 'lucide-react';

interface Project {
  id: string;
  projectCode: string;
  projectName: string;
  projectType: string;
  region?: string;
  designInstitute?: string;
  stage: string;
  status: string;
  estimatedValue?: number;
  customerName?: string;
}

const ALL = '__all__';

const STAGE_LABELS: Record<string, string> = {
  lead: '立项',
  design: '设计选型',
  tender: '招投标',
  awarded: '中标',
  delivery: '交付',
  warranty: '质保',
  closed: '结案',
  lost: '丢标',
};

const STAGE_COLOR: Record<string, string> = {
  lead: 'bg-surface-2 text-ink-secondary',
  design: 'bg-brand-500/10 text-brand-500',
  tender: 'bg-warning/15 text-warning',
  awarded: 'bg-success/15 text-success',
  delivery: 'bg-success/15 text-success',
  warranty: 'bg-success/15 text-success',
  closed: 'bg-surface-2 text-ink-tertiary',
  lost: 'bg-danger/10 text-danger',
};

const TYPE_LABELS: Record<string, string> = {
  new_construction: '新建',
  renovation: '改造',
  replacement: '更换',
  expansion: '扩建',
};

const EMPTY_FORM = { projectName: '', projectType: 'new_construction', region: '', designInstitute: '', customerName: '', estimatedValue: '' };

export default function PmsProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<string>(ALL);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams();
      if (stage !== ALL) qs.set('stage', stage);
      const res = await fetch(`/api/pms/projects?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [stage]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitCreate() {
    if (!form.projectName.trim()) {
      setCreateError('请填写项目名称');
      return;
    }
    try {
      setCreating(true);
      setCreateError(null);
      const body: Record<string, string | number> = {
        projectName: form.projectName.trim(),
        projectType: form.projectType,
      };
      if (form.region.trim()) body.region = form.region.trim();
      if (form.designInstitute.trim()) body.designInstitute = form.designInstitute.trim();
      if (form.customerName.trim()) body.customerName = form.customerName.trim();
      if (form.estimatedValue.trim()) body.estimatedValue = Number(form.estimatedValue);
      const res = await fetch('/api/pms/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || '创建失败');
      const data = await res.json();
      setCreateOpen(false);
      setForm({ ...EMPTY_FORM });
      router.push(`/pms/projects/${data.project.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-500" />
            工程项目
          </h1>
          <p className="text-body text-ink-secondary mt-1">项目型销售 · 决策链 · 规格指定 · 招投标</p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_FORM }); setCreateError(null); setCreateOpen(true); }} className="bg-brand-500 hover:bg-brand-600">
          <Plus className="w-4 h-4 mr-2" />
          新建项目
        </Button>
      </div>

      <div className="mb-6 max-w-xs">
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger>
            <SelectValue placeholder="阶段" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>全部阶段</SelectItem>
            {Object.entries(STAGE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="mb-4 border-danger/30">
          <CardContent className="p-4 text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">暂无工程项目</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-soft-sm transition-shadow"
              onClick={() => router.push(`/pms/projects/${p.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-caption font-medium rounded px-1.5 py-0.5 ${STAGE_COLOR[p.stage] || 'bg-surface-2 text-ink-secondary'}`}>
                        {STAGE_LABELS[p.stage] || p.stage}
                      </span>
                      <h3 className="text-headline font-semibold text-ink-primary truncate">{p.projectName}</h3>
                    </div>
                    <p className="text-caption text-ink-tertiary mt-1">
                      {p.projectCode} · {TYPE_LABELS[p.projectType] || p.projectType}
                      {p.region ? ` · ${p.region}` : ''}
                      {p.designInstitute ? ` · ${p.designInstitute}` : ''}
                    </p>
                    {p.customerName && <p className="text-caption text-ink-secondary mt-1">{p.customerName}</p>}
                  </div>
                  {p.estimatedValue != null && (
                    <div className="text-right shrink-0">
                      <p className="text-headline font-bold text-brand-500">¥{p.estimatedValue.toLocaleString('zh-CN')}</p>
                      <p className="text-caption text-ink-tertiary mt-1">预估额</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建工程项目</DialogTitle>
            <DialogDescription>以项目为核心组织销售, 之后可挂决策链干系人 / 规格指定 / 招投标 / 报价商机。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <label className="text-caption text-ink-secondary mb-1 block">项目名称 *</label>
              <input
                value={form.projectName}
                onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
                placeholder="如 成都新都香城小学热水系统"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-caption placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-caption text-ink-secondary mb-1 block">项目类型</label>
                <Select value={form.projectType} onValueChange={(v) => setForm((f) => ({ ...f, projectType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-caption text-ink-secondary mb-1 block">区域</label>
                <input
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  placeholder="如 西南"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-caption placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-caption text-ink-secondary mb-1 block">设计院</label>
                <input
                  value={form.designInstitute}
                  onChange={(e) => setForm((f) => ({ ...f, designInstitute: e.target.value }))}
                  placeholder="如 中建西南院"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-caption placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              <div>
                <label className="text-caption text-ink-secondary mb-1 block">预估额</label>
                <input
                  type="number"
                  value={form.estimatedValue}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedValue: e.target.value }))}
                  placeholder="2000000"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-caption placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            </div>
            <div>
              <label className="text-caption text-ink-secondary mb-1 block">终端客户</label>
              <input
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                placeholder="选填"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-caption placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
            {createError && <p className="text-caption text-danger">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>取消</Button>
            <Button onClick={submitCreate} disabled={creating} className="bg-brand-500 hover:bg-brand-600">
              {creating ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

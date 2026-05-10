'use client';

/**
 * 建群对话框 (Q2 IM 替代企微 · 2026-05-10)
 *
 * 支持 Tandem 7 种群型:
 *   group        通用多人群 (任意拉)
 *   announcement 全员/部门公告 (只读)
 *   department   部门工作群 (按 Department 关联)
 *   team         团队工作群 (Department.parentId != null)
 *   project      项目临时群 (可设结束日期, 到期归档)
 *   cross_dept   跨部门协同群 (双方 leader 协商建)
 *   (dm 1:1 走 /api/im/dm, 不在本对话框)
 *
 * UI:
 *   - 类型 radio
 *   - 名称 + 简介 (topic)
 *   - 部门 select (department/team/cross_dept 时)
 *   - 项目结束日期 (project 时)
 *   - 公开/私密 toggle
 *   - 成员 textarea (V1 简版, M2 替换为用户多选)
 */

import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useOrgStore } from '@/lib/store';
import {
  Users, Megaphone, Building2, UsersRound, Briefcase, Network,
  Lock, Globe, Calendar, Plus,
} from 'lucide-react';

type ChannelKind = 'group' | 'announcement' | 'department' | 'team' | 'project' | 'cross_dept';

const KIND_META: Record<ChannelKind, {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  needsDepartment: boolean;
  needsEndDate: boolean;
}> = {
  group:        { label: '普通群',     description: '通用多人群, 任意拉成员',           icon: Users,       color: 'text-violet-600 bg-violet-50',  needsDepartment: false, needsEndDate: false },
  department:   { label: '部门群',     description: '按部门组织, HR seed 自动包含全员', icon: Building2,   color: 'text-blue-600 bg-blue-50',      needsDepartment: true,  needsEndDate: false },
  team:         { label: '团队群',     description: '部门下的小组 (Department parent)', icon: UsersRound, color: 'text-cyan-600 bg-cyan-50',      needsDepartment: true,  needsEndDate: false },
  project:      { label: '项目群',     description: '临时项目协作, 到期自动归档',       icon: Briefcase,   color: 'text-amber-600 bg-amber-50',    needsDepartment: false, needsEndDate: true },
  cross_dept:   { label: '跨部门协同', description: '双方部门 leader 协商建立',         icon: Network,     color: 'text-fuchsia-600 bg-fuchsia-50', needsDepartment: true,  needsEndDate: false },
  announcement: { label: '公告频道',   description: '全员/部门公告 (只读流)',           icon: Megaphone,   color: 'text-rose-600 bg-rose-50',      needsDepartment: false, needsEndDate: false },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前用户 ID (写入 createdBy + memberIds[0]) */
  currentUserId: string;
  /** 创建成功回调, 父组件应刷新 channels 列表并切换到新频道 */
  onCreated: (channelId: string) => void;
}

export function CreateChannelDialog({ open, onOpenChange, currentUserId, onCreated }: Props) {
  const { departments } = useOrgStore();
  const allDepartments = useMemo(() => {
    // Department 在 zustand 是嵌套结构 (Department -> Ministry[])
    // V1 简版: 把 Department 和 Department.ministries 都展平为可选
    const out: { id: string; name: string; level: 'department' | 'team' }[] = [];
    for (const d of departments) {
      out.push({ id: d.id, name: d.name, level: 'department' });
      for (const m of d.ministries) {
        out.push({ id: m.id, name: `${d.name} / ${m.name}`, level: 'team' });
      }
    }
    return out;
  }, [departments]);

  const [kind, setKind] = useState<ChannelKind>('group');
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [projectEndsAt, setProjectEndsAt] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [memberInput, setMemberInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = KIND_META[kind];
  const Icon = meta.icon;

  const memberIds = memberInput.split(',').map((s) => s.trim()).filter(Boolean);

  const valid =
    name.trim().length > 0 &&
    (!meta.needsDepartment || departmentId.length > 0) &&
    (!meta.needsEndDate || projectEndsAt.length > 0);

  function reset() {
    setKind('group');
    setName('');
    setTopic('');
    setDepartmentId('');
    setProjectEndsAt('');
    setVisibility('public');
    setMemberInput('');
    setError(null);
    setSubmitting(false);
  }

  async function handleCreate() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/im/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: kind,
          name: name.trim(),
          topic: topic.trim() || undefined,
          visibility,
          memberIds,
          createdBy: currentUserId,
          departmentId: meta.needsDepartment ? departmentId : undefined,
          projectEndsAt: meta.needsEndDate
            ? new Date(projectEndsAt).toISOString()
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onCreated(data.channel.id);
      reset();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            建群
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 类型选择 */}
          <div className="space-y-1.5">
            <Label className="text-xs">群类型</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(KIND_META) as ChannelKind[]).map((k) => {
                const km = KIND_META[k];
                const KmIcon = km.icon;
                const active = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`flex items-start gap-2 rounded-md border p-2 text-left transition-colors ${
                      active
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <span className={`rounded p-1 ${km.color}`}>
                      <KmIcon className="h-3 w-3" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">{km.label}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{km.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="ch-name" className="text-xs">群名称 *</Label>
            <Input
              id="ch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                kind === 'department' ? '例: 研发部 (按部门命名)' :
                kind === 'team'       ? '例: 后端组' :
                kind === 'project'    ? '例: V1 GA 上线项目' :
                kind === 'cross_dept' ? '例: 销售-产品对齐周会' :
                kind === 'announcement' ? '例: 公司公告' :
                '例: 周末骑行小分队'
              }
              maxLength={50}
              disabled={submitting}
            />
          </div>

          {/* 简介 */}
          <div className="space-y-1.5">
            <Label htmlFor="ch-topic" className="text-xs">简介 (可选)</Label>
            <Input
              id="ch-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="一句话讲清楚这个群干嘛"
              maxLength={100}
              disabled={submitting}
            />
          </div>

          {/* 部门 */}
          {meta.needsDepartment && (
            <div className="space-y-1.5">
              <Label htmlFor="ch-dept" className="text-xs flex items-center gap-1">
                <Building2 className="h-3 w-3" /> 关联部门 *
              </Label>
              <select
                id="ch-dept"
                aria-label="关联部门"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={submitting}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— 选择部门/团队 —</option>
                {allDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.level === 'team' ? '└ ' : ''}
                    {d.name}
                  </option>
                ))}
              </select>
              {allDepartments.length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  暂无部门数据 · 去 /organization 创建后再来
                </p>
              )}
            </div>
          )}

          {/* 项目结束日期 */}
          {meta.needsEndDate && (
            <div className="space-y-1.5">
              <Label htmlFor="ch-end" className="text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" /> 项目结束日期 *
              </Label>
              <Input
                id="ch-end"
                type="date"
                value={projectEndsAt}
                onChange={(e) => setProjectEndsAt(e.target.value)}
                disabled={submitting}
              />
              <p className="text-[10px] text-muted-foreground">
                到期后系统自动归档群组 (M2 cron)
              </p>
            </div>
          )}

          {/* 公开/私密 */}
          <div className="space-y-1.5">
            <Label className="text-xs">可见范围</Label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                disabled={submitting}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${
                  visibility === 'public'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <Globe className="h-3 w-3" /> 公开 (全员可见可加)
              </button>
              <button
                type="button"
                onClick={() => setVisibility('private')}
                disabled={submitting}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs ${
                  visibility === 'private'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <Lock className="h-3 w-3" /> 私密 (受邀加入)
              </button>
            </div>
          </div>

          {/* 成员 */}
          <div className="space-y-1.5">
            <Label htmlFor="ch-members" className="text-xs">初始成员 userId (可选, 逗号分隔)</Label>
            <Textarea
              id="ch-members"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              placeholder="colleague-li, colleague-wang, colleague-zhang"
              rows={2}
              disabled={submitting}
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              你 ({currentUserId}) 自动作为创建者. 当前 {memberIds.length} 位邀请.
              {kind === 'department' && (allDepartments.find((d) => d.id === departmentId)) && (
                <> · M2 将自动 seed 部门全员</>
              )}
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Preview */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-1">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">预览</div>
            <div className="flex items-center gap-2">
              <span className={`rounded p-1.5 ${meta.color}`}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{name || '未命名'}</div>
                <div className="text-[10px] text-muted-foreground">
                  {meta.label} · {visibility === 'public' ? '公开' : '私密'} · {memberIds.length + 1} 人
                  {meta.needsEndDate && projectEndsAt && ` · 截止 ${projectEndsAt}`}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={!valid || submitting}>
            {submitting ? '创建中...' : '建群'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

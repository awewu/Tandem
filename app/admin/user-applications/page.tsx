'use client';

/**
 * 外部协作申请审批中心 (Owner/Admin)
 *
 * 功能:
 *  - Tabs 切换 pending / approved / rejected
 *  - 行展开看完整 reason / organization / IP / UA
 *  - Approve: 弹框选 grantedRoles, 提交后展示一次性 inviteCode (含 copy 按钮)
 *  - Reject: 选填 decisionNote
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  RefreshCw,
  Building,
  User,
  Mail,
} from 'lucide-react';
import {
  ROLE_LABELS,
  EXTERNAL_ROLES,
  type Role,
} from '@/lib/auth/roles';

interface AppItem {
  id: string;
  email: string;
  name: string;
  organization?: string;
  reason: string;
  requestedScopes?: ('naba' | 'dazi')[];
  status: 'pending' | 'approved' | 'rejected';
  grantedRoles?: Role[];
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
}

type Tab = 'pending' | 'approved' | 'rejected';

export default function UserApplicationsAdminPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/user-applications?status=${tab}`);
      const data = await res.json();
      if (data.ok) setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-title-3 font-semibold">外部协作申请审批</h1>
          <p className="text-caption text-secondary">
            通过后会生成一次性邀请码 (72h 有效, 与申请邮箱绑定), 由你带外发给申请人。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </header>

      <div className="flex gap-1 border-b">
        {(['pending', 'approved', 'rejected'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-caption border-b-2 -mb-px ${
              tab === t
                ? 'border-brand-600 text-primary font-medium'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            {t === 'pending' && '待审批'}
            {t === 'approved' && '已通过'}
            {t === 'rejected' && '已拒绝'}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-secondary text-caption">
            {loading ? '加载中…' : `当前没有 ${tab} 状态的申请。`}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <ApplicationRow
              key={it.id}
              item={it}
              expanded={expanded === it.id}
              onToggle={() => setExpanded((p) => (p === it.id ? null : it.id))}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ApplicationRow({
  item,
  expanded,
  onToggle,
  onChanged,
}: {
  item: AppItem;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  return (
    <Card>
      <CardHeader className="cursor-pointer pb-2" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <StatusIcon status={item.status} />
          <div className="flex-1 min-w-0">
            <CardTitle className="text-caption flex items-center gap-2">
              {item.name}
              <span className="text-footnote text-secondary font-normal">{item.email}</span>
              {item.organization && (
                <Badge variant="outline" className="text-footnote">
                  {item.organization}
                </Badge>
              )}
            </CardTitle>
            <p className="text-footnote text-secondary mt-0.5 line-clamp-1">{item.reason}</p>
          </div>
          <span className="text-footnote text-secondary whitespace-nowrap">
            {new Date(item.createdAt).toLocaleString('zh-CN')}
          </span>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-3">
          <DetailGrid item={item} />
          {item.status === 'pending' ? (
            <PendingActions applicationId={item.id} onChanged={onChanged} />
          ) : (
            <DecidedSummary item={item} />
          )}
        </CardContent>
      )}
    </Card>
  );
}

function StatusIcon({ status }: { status: AppItem['status'] }) {
  if (status === 'pending') return <Clock className="w-4 h-4 text-warning" />;
  if (status === 'approved') return <CheckCircle2 className="w-4 h-4 text-success" />;
  return <XCircle className="w-4 h-4 text-danger" />;
}

function DetailGrid({ item }: { item: AppItem }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-footnote bg-muted/40 rounded-lg p-3">
      <Field icon={<Mail className="w-3 h-3" />} label="邮箱" value={item.email} />
      <Field icon={<User className="w-3 h-3" />} label="姓名" value={item.name} />
      {item.organization && (
        <Field icon={<Building className="w-3 h-3" />} label="组织" value={item.organization} />
      )}
      {item.requestedScopes && item.requestedScopes.length > 0 && (
        <Field
          icon={null}
          label="申请板块"
          value={item.requestedScopes.map((s) => (s === 'naba' ? '拿捏' : '搭子')).join(' · ')}
        />
      )}
      {item.ip && <Field icon={null} label="IP" value={item.ip} />}
      <div className="md:col-span-2 mt-1">
        <span className="text-muted-foreground">申请理由:</span>
        <p className="mt-0.5 whitespace-pre-wrap text-foreground">{item.reason}</p>
      </div>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {icon}
      <span>{label}:</span>
      <span className="text-foreground truncate">{value}</span>
    </div>
  );
}

function PendingActions({
  applicationId,
  onChanged,
}: {
  applicationId: string;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<null | 'approve' | 'reject'>(null);
  const [grantedRoles, setGrantedRoles] = useState<Role[]>(['guest']);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [issuedCode, setIssuedCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleRole(r: Role) {
    setGrantedRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  }

  async function approve() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/user-applications/${applicationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantedRoles, decisionNote: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '操作失败');
        return;
      }
      setIssuedCode({ code: data.inviteCode, expiresAt: data.inviteExpiresAt });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/user-applications/${applicationId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionNote: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '操作失败');
        return;
      }
      setMode(null);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (issuedCode) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-2">
        <p className="text-caption font-medium text-success">
          已通过 · 一次性邀请码生成 (仅本次显示)
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-caption bg-background px-3 py-2 rounded-lg border">
            {issuedCode.code}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(issuedCode.code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <p className="text-footnote text-secondary">
          有效期至 {new Date(issuedCode.expiresAt).toLocaleString('zh-CN')}, 仅可使用 1 次, 已绑定申请邮箱。
          请通过邮件 / IM 等带外通道发给申请人, 让对方在{' '}
          <code>/register?invite=...</code> 完成注册。
        </p>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setMode('approve')}>
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          通过申请
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode('reject')}>
          <XCircle className="w-3.5 h-3.5 mr-1" />
          拒绝
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded border bg-muted/30 p-3 space-y-3">
      {mode === 'approve' && (
        <div>
          <label className="text-footnote font-medium text-secondary mb-1.5 block">
            授予角色 (默认 guest, 可加 partner / contractor)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {EXTERNAL_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleRole(r)}
                className={`px-3 py-1 rounded-full text-footnote border transition-colors ${
                  grantedRoles.includes(r)
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-background border-border hover:border-brand-400'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <label className="text-footnote font-medium text-secondary mb-1.5 block">
          {mode === 'approve' ? '审批备注 (选填)' : '拒绝原因 (建议填写)'}
        </label>
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            mode === 'approve'
              ? '例如: 与 X 项目对接, 限内部演示用'
              : '例如: 信息不充分, 请补充后重新申请'
          }
        />
      </div>
      {error && <p className="text-footnote text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || (mode === 'approve' && grantedRoles.length === 0)}
          onClick={mode === 'approve' ? approve : reject}
          variant={mode === 'reject' ? 'destructive' : 'default'}
        >
          {busy ? '提交中…' : mode === 'approve' ? '确认通过' : '确认拒绝'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode(null)} disabled={busy}>
          取消
        </Button>
      </div>
    </div>
  );
}

function DecidedSummary({ item }: { item: AppItem }) {
  return (
    <div className="text-footnote text-secondary space-y-1 border-t pt-2">
      <p>
        <span className="font-medium">{item.status === 'approved' ? '已通过' : '已拒绝'}</span>
        {item.decidedAt && ` · ${new Date(item.decidedAt).toLocaleString('zh-CN')}`}
        {item.decidedBy && ` · 审批人 ${item.decidedBy}`}
      </p>
      {item.grantedRoles && item.grantedRoles.length > 0 && (
        <p>
          授予角色:{' '}
          {item.grantedRoles.map((r) => ROLE_LABELS[r] ?? r).join(' · ')}
        </p>
      )}
      {item.decisionNote && <p>备注: {item.decisionNote}</p>}
    </div>
  );
}

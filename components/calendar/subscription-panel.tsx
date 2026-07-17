'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Plus, ShieldX, UserRoundPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface CalendarUserOption {
  id: string;
  name: string;
  email: string;
}

interface Subscription {
  id: string;
  subscriberId: string;
  targetUserId: string;
  status: 'subscribed' | 'cancelled';
  detailPermission: 'not_requested' | 'pending' | 'approved' | 'rejected' | 'revoked';
}

interface CalendarSubscriptionPanelProps {
  currentUserId: string;
  selectedTargetId: string | null;
  onViewTarget: (targetId: string | null) => void;
  onChanged: () => void | Promise<void>;
}

const PERMISSION_LABEL: Record<Subscription['detailPermission'], string> = {
  not_requested: '忙闲',
  pending: '待同意',
  approved: '完整详情',
  rejected: '已拒绝',
  revoked: '已撤销',
};

export default function CalendarSubscriptionPanel({
  currentUserId,
  selectedTargetId,
  onViewTarget,
  onChanged,
}: CalendarSubscriptionPanelProps) {
  const [users, setUsers] = useState<CalendarUserOption[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [requestDetails, setRequestDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState('');

  const load = useCallback(async () => {
    if (!currentUserId) return;
    setLoadError('');
    const [usersResponse, subscriptionsResponse] = await Promise.all([
      fetch('/api/calendar/attendees?limit=500', { credentials: 'include', cache: 'no-store' }),
      fetch('/api/calendar/subscriptions', { credentials: 'include' }),
    ]);
    if (usersResponse.ok) {
      const data = await usersResponse.json();
      setUsers((data.users ?? []).filter((user: CalendarUserOption) => user.id !== currentUserId));
    } else {
      setUsers([]);
      setLoadError('用户列表加载失败，请刷新后重试');
    }
    if (subscriptionsResponse.ok) setSubscriptions((await subscriptionsResponse.json()).subscriptions ?? []);
  }, [currentUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const outgoing = useMemo(() => subscriptions.filter((item) => (
    item.subscriberId === currentUserId && item.status === 'subscribed'
  )), [currentUserId, subscriptions]);
  const incoming = useMemo(() => subscriptions.filter((item) => (
    item.targetUserId === currentUserId && item.status === 'subscribed'
  )), [currentUserId, subscriptions]);
  const nameOf = (id: string) => users.find((user) => user.id === id)?.name ?? id;
  const availableUsers = useMemo(() => users.filter((user) => (
    !outgoing.some((item) => item.targetUserId === user.id)
  )), [outgoing, users]);
  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    if (!query) return availableUsers;
    return availableUsers.filter((user) => (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    ));
  }, [availableUsers, userQuery]);
  const selectedTarget = users.find((user) => user.id === targetUserId);

  async function subscribe() {
    if (!targetUserId) return;
    setBusy(true);
    setFeedback('');
    try {
      const response = await fetch('/api/calendar/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetUserId, requestDetails }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const subscription = data.subscription as Subscription | undefined;
        const nextTargetId = subscription?.targetUserId ?? targetUserId;
        const targetName = users.find((user) => user.id === nextTargetId)?.name ?? '该用户';
        setShowCreate(false);
        setTargetUserId('');
        setUserQuery('');
        setUserDropdownOpen(false);
        setRequestDetails(false);
        await load();
        onViewTarget(nextTargetId);
        setFeedback(`已订阅 ${targetName} 的日程，正在显示其忙闲信息。`);
        void Promise.resolve(onChanged()).catch(() => undefined);
      } else {
        setFeedback(data.error?.message ?? data.error ?? '订阅失败，请稍后重试');
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '订阅失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: 'approve' | 'reject' | 'revoke' | 'cancel') {
    setBusy(true);
    try {
      const response = await fetch(`/api/calendar/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });
      if (response.ok) {
        const cancelled = subscriptions.find((item) => item.id === id)?.targetUserId;
        if (action === 'cancel' && selectedTargetId === cancelled) onViewTarget(null);
        await load();
        await onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-caption font-semibold uppercase text-muted-foreground">订阅日程</h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowCreate((value) => !value)} title="新增订阅">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {showCreate && (
        <div className="mb-3 space-y-2 border-b pb-3">
          <div className="relative">
            <Input
              value={userQuery}
              onChange={(event) => {
                setUserQuery(event.target.value);
                setTargetUserId('');
                setUserDropdownOpen(true);
              }}
              onFocus={() => setUserDropdownOpen(true)}
              onBlur={() => window.setTimeout(() => setUserDropdownOpen(false), 120)}
              placeholder="输入姓名或邮箱筛选"
              className="h-8 pr-7 text-caption"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              onMouseDown={(event) => {
                event.preventDefault();
                setUserDropdownOpen((value) => !value);
              }}
              aria-label="展开用户列表"
            >
              <span className={cn('block text-[10px] transition-transform', userDropdownOpen && 'rotate-180')}>▾</span>
            </button>
            {userDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-background shadow-soft-lg">
                <div className="border-b px-3 py-1.5 text-[10px] text-muted-foreground">
                  共 {users.length} 人，可订阅 {availableUsers.length} 人，当前匹配 {filteredUsers.length} 人
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <div className="px-3 py-4 text-center text-caption text-muted-foreground">没有匹配用户</div>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-caption hover:bg-muted/60',
                          targetUserId === user.id && 'bg-brand-50 text-brand-700'
                        )}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setTargetUserId(user.id);
                          setUserQuery(user.name);
                          setUserDropdownOpen(false);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{user.name}</span>
                          {user.email && <span className="block truncate text-[10px] text-muted-foreground">{user.email}</span>}
                        </span>
                        {targetUserId === user.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {loadError && (
            <div className="rounded-md border border-danger/20 bg-danger/5 px-2 py-1.5 text-[11px] text-danger">
              {loadError}
            </div>
          )}
          {selectedTarget && (
            <div className="rounded-md bg-brand-50 px-2 py-1.5 text-[11px] text-brand-700">
              已选择：{selectedTarget.name}{selectedTarget.email ? ` (${selectedTarget.email})` : ''}
            </div>
          )}
          <div className="flex items-center justify-between text-caption">
            <span>申请完整详情</span>
            <Switch checked={requestDetails} onCheckedChange={setRequestDetails} />
          </div>
          <Button size="sm" className="h-8 w-full gap-1" disabled={!targetUserId || busy} onClick={subscribe}>
            <UserRoundPlus className="h-3.5 w-3.5" />
            {busy ? '订阅中...' : '订阅'}
          </Button>
        </div>
      )}

      {feedback && (
        <div className={cn(
          'mb-2 rounded-md border px-2 py-1.5 text-[11px]',
          feedback.includes('失败') ? 'border-danger/20 bg-danger/5 text-danger' : 'border-brand-200 bg-brand-50 text-brand-700',
        )}>
          {feedback}
        </div>
      )}

      <div className="space-y-1">
        {outgoing.map((item) => {
          const viewing = selectedTargetId === item.targetUserId;
          return (
          <div key={item.id} className={cn('flex items-center gap-1 rounded px-1.5 py-1.5 text-caption', viewing && 'bg-brand-50 text-brand-700')}>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => onViewTarget(viewing ? null : item.targetUserId)}
              title={viewing ? '点击取消查看，回到我的日程' : '点击查看该用户日程'}
            >
              <div className="flex items-center gap-1 truncate font-medium">
                <span className="truncate">{nameOf(item.targetUserId)}</span>
                {viewing && <span className="shrink-0 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-700">查看中</span>}
              </div>
              <div className={cn('text-[10px] text-muted-foreground', viewing && 'text-brand-700/80')}>
                {viewing ? '再次点击可取消查看' : PERMISSION_LABEL[item.detailPermission]}
              </div>
            </button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-danger" disabled={busy} onClick={() => act(item.id, 'cancel')} title="取消订阅">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          );
        })}
        {outgoing.length === 0 && <div className="px-1.5 py-2 text-caption text-muted-foreground">暂无订阅</div>}
      </div>

      {incoming.some((item) => item.detailPermission === 'pending' || item.detailPermission === 'approved') && (
        <div className="mt-3 border-t pt-3">
          <div className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">详情权限</div>
          {incoming.filter((item) => item.detailPermission === 'pending' || item.detailPermission === 'approved').map((item) => (
            <div key={item.id} className="flex items-center gap-1 py-1 text-caption">
              <span className="min-w-0 flex-1 truncate">{nameOf(item.subscriberId)}</span>
              {item.detailPermission === 'pending' ? (
                <>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-success" disabled={busy} onClick={() => act(item.id, 'approve')} title="同意">
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-danger" disabled={busy} onClick={() => act(item.id, 'reject')} title="拒绝">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-danger" disabled={busy} onClick={() => act(item.id, 'revoke')} title="撤销详情权限">
                  <ShieldX className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

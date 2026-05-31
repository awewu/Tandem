'use client';

/**
 * 频道设置对话框 (Day 5-7 · 2026-05-10)
 *
 * 4 个 tab:
 *   - 信息: 群名 / 简介 (owner/admin 可改)
 *   - 成员: 列表 + 角色徽章 + [加成员] [移除] [改角色]
 *   - 公告: markdown 文本框 + 最后编辑时间/人 (owner/admin 可改)
 *   - 置顶: 已 pin 的消息列表 (最多 5 条) + 取消置顶
 *
 * Props 来自 /im 主页, callback 让主页刷新 channel/messages.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Settings, Users, Megaphone, Pin, Crown, Shield, UserPlus,
  Trash2, X, Pencil,
} from 'lucide-react';
import type { ImChannel, ImMembership, ImMessage, ImMemberRole } from '@/lib/types/im';
import { useOKRStore } from '@/lib/store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ImChannel | null;
  messages: ImMessage[];
  currentUserId: string;
  /** 任何修改成功后调用, 父组件应 reloadChannels + reloadMessages */
  onChanged: () => void;
}

type Tab = 'info' | 'members' | 'announcement' | 'pinned';

export function ChannelSettingsDialog({
  open, onOpenChange, channel, messages, currentUserId, onChanged,
}: Props) {
  const [tab, setTab] = useState<Tab>('info');
  const [members, setMembers] = useState<ImMembership[]>([]);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [editingAnn, setEditingAnn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const people = useOKRStore((s) => s.people);
  const peopleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of people) m.set(p.id, p.name);
    return m;
  }, [people]);

  // 当前用户在该频道的角色
  const myMembership = members.find((m) => m.userId === currentUserId);
  const isAdmin = myMembership?.role === 'owner' || myMembership?.role === 'admin';
  const isOwner = myMembership?.role === 'owner';

  // 加载成员
  useEffect(() => {
    if (!open || !channel) return;
    setName(channel.name);
    setTopic(channel.topic ?? '');
    setAnnouncement(channel.announcement ?? '');
    setEditingAnn(false);
    setError(null);
    void fetch(`/api/im/channels/${channel.id}/members`)
      .then((r) => r.json())
      .then((data) => setMembers(data.members ?? []));
  }, [open, channel]);

  if (!channel) return null;

  const reloadMembers = async () => {
    const res = await fetch(`/api/im/channels/${channel.id}/members`);
    const data = await res.json();
    setMembers(data.members ?? []);
  };

  const handleSaveInfo = async () => {
    if (!isAdmin) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/im/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUserId, name, topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChanged();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const handleSaveAnnouncement = async () => {
    if (!isAdmin) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/im/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUserId, announcement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingAnn(false);
      onChanged();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const handleAddMember = async (userId: string) => {
    if (!isAdmin) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/im/channels/${channel.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUserId, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await reloadMembers();
      onChanged();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm(`确认移除 ${peopleById.get(userId) ?? userId}?`)) return;
    setBusy(true); setError(null);
    try {
      const url = `/api/im/channels/${channel.id}/members?userId=${encodeURIComponent(userId)}&operatorId=${encodeURIComponent(currentUserId)}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await reloadMembers();
      onChanged();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const handleSetRole = async (userId: string, role: ImMemberRole) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/im/channels/${channel.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUserId, userId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await reloadMembers();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const handleUnpin = async (messageId: string) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/im/channels/${channel.id}/pins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUserId, messageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChanged();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  // 候选成员: 全员 - 已在群
  const memberIdSet = new Set(members.map((m) => m.userId));
  const candidates = people.filter((p) => !memberIdSet.has(p.id) && p.id !== currentUserId);

  // pinned 消息 (从 messages 拉对应 ID)
  const pinnedIds = channel.pinnedMessageIds ?? [];
  const pinnedMessages = pinnedIds
    .map((id) => messages.find((m) => m.id === id))
    .filter((m): m is ImMessage => Boolean(m));

  const tabs: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'info', label: '信息', icon: Settings },
    { key: 'members', label: '成员', icon: Users, count: members.length },
    { key: 'announcement', label: '公告', icon: Megaphone },
    { key: 'pinned', label: '置顶', icon: Pin, count: pinnedIds.length },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {channel.name} · 设置
            {!isAdmin && (
              <Badge variant="secondary" className="text-[10px]">只读</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border pb-0 -mx-6 px-6">
          {tabs.map((t) => {
            const TIcon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-footnote transition ${
                  active
                    ? 'border-primary font-semibold text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <TIcon className="h-3 w-3" />
                {t.label}
                {t.count !== undefined && (
                  <span className="text-[10px] opacity-70">({t.count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-footnote text-destructive">
              {error}
            </div>
          )}

          {/* 信息 tab */}
          {tab === 'info' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ch-name" className="text-footnote">群名称</Label>
                <Input
                  id="ch-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isAdmin || busy}
                  maxLength={50}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ch-topic" className="text-footnote">简介</Label>
                <Input
                  id="ch-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={!isAdmin || busy}
                  maxLength={100}
                  placeholder="一句话讲清楚这个群干嘛"
                />
              </div>
              <div className="text-[10px] text-muted-foreground space-y-0.5">
                <div>类型: {channel.type} · 可见: {channel.visibility}</div>
                <div>创建于 {new Date(channel.createdAt).toLocaleString('zh-CN')}</div>
                {channel.departmentId && <div>关联部门: {channel.departmentId}</div>}
                {channel.projectEndsAt && (
                  <div>项目结束: {new Date(channel.projectEndsAt).toLocaleDateString('zh-CN')}</div>
                )}
              </div>
              {isAdmin && (
                <Button onClick={handleSaveInfo} disabled={busy} size="sm">
                  {busy ? '保存中...' : '保存'}
                </Button>
              )}
            </div>
          )}

          {/* 成员 tab */}
          {tab === 'members' && (
            <div className="space-y-2">
              {members.map((m) => {
                const name = peopleById.get(m.userId) ?? m.userId;
                const isMe = m.userId === currentUserId;
                const RoleIcon = m.role === 'owner' ? Crown : m.role === 'admin' ? Shield : null;
                const roleColor =
                  m.role === 'owner' ? 'text-warning' :
                  m.role === 'admin' ? 'text-blue-600' : 'text-muted-foreground';
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/30"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-[11px] font-semibold uppercase text-white">
                      {(name[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-caption font-medium truncate">{name}</span>
                        {isMe && <Badge variant="secondary" className="text-[9px] h-4">我</Badge>}
                        {RoleIcon && (
                          <RoleIcon className={`h-3 w-3 ${roleColor}`} />
                        )}
                        <span className={`text-[10px] ${roleColor}`}>{m.role}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {m.lastReadAt ? `最后已读 ${new Date(m.lastReadAt).toLocaleString('zh-CN')}` : '未读过'}
                      </div>
                    </div>
                    {isOwner && !isMe && m.role !== 'owner' && (
                      <select
                        aria-label={`${name} 角色`}
                        value={m.role}
                        onChange={(e) => handleSetRole(m.userId, e.target.value as ImMemberRole)}
                        disabled={busy}
                        className="h-7 rounded border border-input bg-background px-2 text-footnote"
                      >
                        <option value="member">成员</option>
                        <option value="admin">管理员</option>
                      </select>
                    )}
                    {isAdmin && !isMe && m.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveMember(m.userId)}
                        disabled={busy}
                        title="移除"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}

              {/* 加成员 */}
              {isAdmin && candidates.length > 0 && (
                <details className="rounded-md border border-dashed p-2">
                  <summary className="cursor-pointer text-footnote text-muted-foreground hover:text-foreground">
                    <UserPlus className="inline h-3 w-3 mr-1" />
                    添加成员 ({candidates.length} 位候选)
                  </summary>
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {candidates.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddMember(p.id)}
                        disabled={busy}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-footnote hover:bg-accent disabled:opacity-50"
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-[9px] font-semibold uppercase text-white">
                          {(p.name[0] ?? '?').toUpperCase()}
                        </div>
                        <span className="flex-1">{p.name}</span>
                        <UserPlus className="h-3 w-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* 公告 tab */}
          {tab === 'announcement' && (
            <div className="space-y-2">
              {!editingAnn ? (
                <>
                  {channel.announcement ? (
                    <div className="rounded-md border bg-warning/5/40 p-3">
                      <div className="whitespace-pre-wrap text-caption">{channel.announcement}</div>
                      {channel.announcementUpdatedAt && (
                        <div className="mt-2 pt-2 border-t border-warning/20/50 text-[10px] text-muted-foreground">
                          {peopleById.get(channel.announcementUpdatedBy ?? '') ?? channel.announcementUpdatedBy}
                          {' · '}
                          {new Date(channel.announcementUpdatedAt).toLocaleString('zh-CN')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-footnote text-muted-foreground py-4 text-center">
                      暂无公告
                    </div>
                  )}
                  {isAdmin && (
                    <Button onClick={() => setEditingAnn(true)} size="sm" variant="outline">
                      <Pencil className="h-3 w-3 mr-1" />
                      {channel.announcement ? '编辑' : '发布公告'}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Textarea
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                    rows={6}
                    placeholder="支持 markdown · 例如:&#10;**本周重点**&#10;1. 周二评审&#10;2. 周四上线"
                    disabled={busy}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSaveAnnouncement} disabled={busy} size="sm">
                      {busy ? '保存中...' : '保存'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAnnouncement(channel.announcement ?? '');
                        setEditingAnn(false);
                      }}
                      disabled={busy}
                    >
                      取消
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 置顶 tab */}
          {tab === 'pinned' && (
            <div className="space-y-2">
              {pinnedMessages.length === 0 ? (
                <div className="text-footnote text-muted-foreground py-4 text-center">
                  暂无置顶消息
                  <div className="mt-1 text-[10px]">
                    在消息上 hover → 点 📌 即可置顶 (最多 5 条)
                  </div>
                </div>
              ) : (
                pinnedMessages.map((msg) => {
                  const senderName = peopleById.get(msg.senderId) ?? msg.senderId;
                  return (
                    <div key={msg.id} className="rounded-md border p-2 flex items-start gap-2">
                      <Pin className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-muted-foreground">
                          {senderName} · {new Date(msg.createdAt).toLocaleString('zh-CN')}
                        </div>
                        <div className="mt-0.5 text-footnote whitespace-pre-wrap break-words line-clamp-3">
                          {msg.deletedAt ? <em className="text-muted-foreground">[已撤回]</em> : msg.body}
                        </div>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => handleUnpin(msg.id)}
                          disabled={busy}
                          title="取消置顶"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

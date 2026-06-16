'use client';

/**
 * ChannelDetailPanel — 企业微信式右侧聊天信息面板 (v2)
 *
 * Sections:
 *   - 群聊名称 / 简介 (inline 编辑)
 *   - 群公告 (展示 + 编辑)
 *   - 群成员 (头像墙 + 个人名片 + 添加弹窗)
 *   - 群管理 (改角色 / 转让群主 / 踢人 / 解散群)
 *   - 群看板 (关联 OKR)
 *   - 消息设置 (免打扰 / 置顶 / 标记)
 *   - 智能总结
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronDown,
  ChevronRight,
  Megaphone,
  Users,
  LayoutDashboard,
  Sparkles,
  Crown,
  Shield,
  UserPlus,
  UserMinus,
  X,
  Pencil,
  Check,
  Phone,
  Mail,
  Building2,
  Loader2,
  Settings,
  BellOff,
  Pin,
  Bookmark,
  Trash2,
  Search,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import type { ImChannel, ImMembership } from '@/lib/types/im';

interface OrgUser {
  id: string;
  name: string;
  email: string;
  departmentId: string | null;
  roles: string[];
  title?: string;
  phone?: string;
}

interface OkrItem {
  id: string;
  title: string;
  currentProgress: number;
  confidence: string;
}

interface Props {
  channel: ImChannel;
  currentUserId: string;
  onChanged: () => void;
  onClose: () => void;
  onDissolve?: () => void;
}

// ─── helpers ───────────────────────────────────────────────

const PALETTE = [
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
  'from-sky-400 to-blue-500',
  'from-violet-400 to-purple-500',
  'from-pink-400 to-rose-500',
];
function avatarColor(id: string) { return PALETTE[(id.codePointAt(0) ?? 0) % PALETTE.length]; }

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-surface-3'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function SectionHeader({ icon: Icon, label, count, open, onToggle }: {
  icon: React.ElementType; label: string; count?: number; open: boolean; onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle}
      className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-3 transition-colors">
      <Icon className="h-3.5 w-3.5 shrink-0 text-ink-secondary" />
      <span className="flex-1 text-[12.5px] font-semibold text-ink-primary">{label}</span>
      {count !== undefined && <span className="text-[11px] text-ink-tertiary">{count}</span>}
      {open
        ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
        : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />}
    </button>
  );
}

// ─── 个人名片弹层 ───────────────────────────────────────────

function MemberCard({ user, onClose, onStartDm }: {
  user: OrgUser; onClose: () => void; onStartDm: (id: string) => void;
}) {
  const idx = avatarColor(user.id);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-80 overflow-hidden rounded-2xl bg-surface-2 shadow-soft-xl" onClick={(e) => e.stopPropagation()}>
        <div className={`h-20 bg-gradient-to-br ${idx}`} />
        <div className="relative -mt-10 px-5">
          <div className={`h-[72px] w-[72px] rounded-2xl border-4 border-white bg-gradient-to-br ${idx} flex items-center justify-center text-[22px] font-bold text-white shadow-soft`}>
            {user.name.slice(0, 1)}
          </div>
        </div>
        <div className="px-5 pb-5 pt-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[16px] font-semibold text-ink-primary">{user.name}</div>
              {user.title && <div className="mt-0.5 text-[12px] text-ink-secondary">{user.title}</div>}
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-surface-3">
              <X className="h-4 w-4 text-ink-tertiary" />
            </button>
          </div>
          <div className="mt-3 space-y-2 border-t border-hairline pt-3">
            {user.phone && (
              <div className="flex items-center gap-2.5 text-[12.5px] text-ink-secondary">
                <Phone className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" /><span>{user.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-[12.5px] text-ink-secondary">
              <Mail className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" /><span className="truncate">{user.email}</span>
            </div>
            {user.departmentId && (
              <div className="flex items-center gap-2.5 text-[12.5px] text-ink-secondary">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" /><span className="truncate">{user.departmentId}</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" className="flex-1 rounded-lg text-[12.5px]"
              onClick={() => { onStartDm(user.id); onClose(); }}>发消息</Button>
            {user.email && (
              <Button size="sm" variant="outline" className="flex-1 rounded-lg text-[12.5px]"
                onClick={() => { window.location.href = `mailto:${user.email}`; }}>写邮件</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 添加成员弹窗 ───────────────────────────────────────────

function AddMembersDialog({ channelId, operatorId, existingIds, onAdded, onClose }: {
  channelId: string; operatorId: string; existingIds: Set<string>;
  onAdded: () => void; onClose: () => void;
}) {
  const [allUsers, setAllUsers] = useState<OrgUser[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch('/api/org/users').then((r) => r.json()).then((d) => setAllUsers(d.users ?? []));
  }, []);

  const candidates = allUsers.filter(
    (u) => !existingIds.has(u.id) && (
      !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    )
  );

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  async function handleConfirm() {
    if (!selected.size || busy) return;
    setBusy(true);
    try {
      await Promise.all(
        Array.from(selected).map((userId) =>
          fetch(`/api/im/channels/${channelId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operatorId, userId }),
          })
        )
      );
      onAdded();
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-[420px] max-h-[80vh] overflow-hidden rounded-2xl bg-surface-2 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <span className="text-[14px] font-semibold text-ink-primary">添加群成员</span>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-surface-3">
            <X className="h-4 w-4 text-ink-tertiary" />
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-4 py-2 border-b border-hairline">
          <div className="flex items-center gap-2 rounded-lg bg-surface-3 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索姓名 / 邮箱"
              className="flex-1 bg-transparent text-[12.5px] text-ink-primary outline-none placeholder:text-ink-tertiary"
            />
          </div>
        </div>

        {/* 已选 chips */}
        {selected.size > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-hairline px-4 py-2">
            {Array.from(selected).map((id) => {
              const u = allUsers.find((x) => x.id === id);
              return (
                <span key={id}
                  className="flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11.5px] text-brand-700">
                  {u?.name ?? id}
                  <button type="button" onClick={() => toggle(id)} className="hover:text-brand-900">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* 按部门分组候选列表 */}
        <div className="flex-1 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-ink-tertiary">没有符合条件的同事</p>
          ) : (
            (() => {
              const deptMap = new Map<string, OrgUser[]>();
              for (const u of candidates) {
                const dept = u.departmentId ?? '(未分配)';
                if (!deptMap.has(dept)) deptMap.set(dept, []);
                deptMap.get(dept)!.push(u);
              }
              return Array.from(deptMap.entries()).map(([dept, members]) => (
                <div key={dept}>
                  <div className="sticky top-0 bg-surface-3 px-4 py-1.5">
                    <span className="text-[11px] font-medium text-ink-tertiary">{dept}</span>
                  </div>
                  {members.map((u) => (
                    <button key={u.id} type="button"
                      onClick={() => toggle(u.id)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-surface-3 transition-colors">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColor(u.id)} text-[11px] font-semibold text-white`}>
                        {u.name.slice(0, 1)}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-[12.5px] font-medium text-ink-primary truncate">{u.name}</div>
                        <div className="text-[11px] text-ink-tertiary truncate">{u.email}</div>
                      </div>
                      <div className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${selected.has(u.id) ? 'border-brand-500 bg-brand-500' : 'border-hairline bg-surface-1'}`}>
                        {selected.has(u.id) && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              ));
            })()
          )}
        </div>

        <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
          <span className="text-[12px] text-ink-tertiary">已选 {selected.size} 人</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-[12.5px]">取消</Button>
            <Button size="sm" onClick={handleConfirm} disabled={!selected.size || busy}
              className="h-8 text-[12.5px]">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '确定'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 主面板 ────────────────────────────────────────────────

export function ChannelDetailPanel({ channel, currentUserId, onChanged, onClose, onDissolve }: Props) {
  const [members, setMembers] = useState<ImMembership[]>([]);
  const [orgUsers, setOrgUsers] = useState<Map<string, OrgUser>>(new Map());
  const [okrs, setOkrs] = useState<OkrItem[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [editingAnn, setEditingAnn] = useState(false);
  const [annDraft, setAnnDraft] = useState(channel.announcement ?? '');
  const [annBusy, setAnnBusy] = useState(false);

  const [editingInfo, setEditingInfo] = useState(false);
  const [nameDraft, setNameDraft] = useState(channel.name);
  const [topicDraft, setTopicDraft] = useState(channel.topic ?? '');
  const [infoBusy, setInfoBusy] = useState(false);

  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [mgmtBusy, setMgmtBusy] = useState(false);

  const [mute, setMute] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [marked, setMarked] = useState(false);

  const [openAnn, setOpenAnn] = useState(true);
  const [openMembers, setOpenMembers] = useState(true);
  const [openMgmt, setOpenMgmt] = useState(true);
  const [openBoard, setOpenBoard] = useState(true);
  const [openSettings, setOpenSettings] = useState(true);
  const [openSummary, setOpenSummary] = useState(false);

  const myRole = members.find((m) => m.userId === currentUserId)?.role ?? 'member';
  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';
  const isDm = channel.type === 'dm';

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/im/channels/${channel.id}/members`);
    const data = await res.json();
    const list: ImMembership[] = data.members ?? [];
    setMembers(list);
    const mine = list.find((m) => m.userId === currentUserId);
    if (mine) {
      setMute(mine.muted ?? false);
      setPinned(mine.pinnedChat ?? false);
      setMarked(mine.markedChat ?? false);
    }
    const r2 = await fetch('/api/org/users');
    const d2 = await r2.json();
    const map = new Map<string, OrgUser>();
    for (const u of (d2.users ?? [])) map.set(u.id, u);
    setOrgUsers(map);
  }, [channel.id, currentUserId]);

  const loadOkrs = useCallback(async () => {
    try {
      const res = await fetch(`/api/okr/objectives?channelId=${channel.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setOkrs((data.objectives ?? []).slice(0, 5).map((o: { id: string; title: string; currentProgress?: number; confidence?: string }) => ({
        id: o.id, title: o.title,
        currentProgress: o.currentProgress ?? 0,
        confidence: o.confidence ?? 'on-track',
      })));
    } catch { /* ignore */ }
  }, [channel.id]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);
  useEffect(() => { if (openBoard && okrs.length === 0) void loadOkrs(); }, [openBoard, okrs.length, loadOkrs]);

  async function handleSaveInfo() {
    setInfoBusy(true);
    try {
      const res = await fetch(`/api/im/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameDraft, topic: topicDraft }),
      });
      if (!res.ok) throw new Error('保存失败');
      setEditingInfo(false);
      onChanged();
    } finally { setInfoBusy(false); }
  }

  async function handleSaveAnn() {
    setAnnBusy(true);
    try {
      const res = await fetch(`/api/im/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement: annDraft }),
      });
      if (!res.ok) throw new Error('保存失败');
      setEditingAnn(false);
      onChanged();
    } finally { setAnnBusy(false); }
  }

  async function handleRemoveMember(userId: string, name: string) {
    if (!confirm(`确认移除 ${name}？`)) return;
    setMgmtBusy(true);
    try {
      await fetch(
        `/api/im/channels/${channel.id}/members?userId=${encodeURIComponent(userId)}&operatorId=${encodeURIComponent(currentUserId)}`,
        { method: 'DELETE' }
      );
      await loadMembers();
      onChanged();
    } finally { setMgmtBusy(false); }
  }

  async function handleSetRole(userId: string, role: 'owner' | 'admin' | 'member') {
    if (role === 'owner') {
      if (!confirm(`确认将群主转让给 ${orgUsers.get(userId)?.name ?? userId}？你将降为管理员。`)) return;
      setMgmtBusy(true);
      try {
        await fetch(`/api/im/channels/${channel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newOwnerId: userId }),
        });
        await loadMembers();
        onChanged();
      } finally { setMgmtBusy(false); }
    } else {
      setMgmtBusy(true);
      try {
        await fetch(`/api/im/channels/${channel.id}/members`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operatorId: currentUserId, userId, role }),
        });
        await loadMembers();
      } finally { setMgmtBusy(false); }
    }
  }

  async function handleDissolve() {
    if (!confirm('确认解散该群？此操作不可撤销。')) return;
    setMgmtBusy(true);
    try {
      const res = await fetch(`/api/im/channels/${channel.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('解散失败');
      onDissolve?.();
      onClose();
    } finally { setMgmtBusy(false); }
  }

  async function requestSummary() {
    if (summaryLoading) return;
    setSummaryLoading(true); setSummary(null);
    try {
      const res = await fetch(`/api/im/channels/${channel.id}/summary`, { method: 'POST' });
      const data = await res.json();
      setSummary(data.summary ?? '总结生成失败');
    } catch { setSummary('网络错误，请重试'); }
    finally { setSummaryLoading(false); }
  }

  function confColor(c: string) {
    if (c === 'on-track') return 'bg-emerald-500';
    if (c === 'at-risk') return 'bg-warning';
    return 'bg-danger';
  }

  const displayName = isDm
    ? (orgUsers.get(channel.memberIds.find((m) => m !== currentUserId) ?? '') ?.name ?? '私聊')
    : channel.name;

  return (
    <>
      <aside className="flex h-full w-[270px] shrink-0 flex-col border-l border-hairline bg-surface-1">
        {/* ── 顶部标题 ── */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-3">
          <span className="text-[13px] font-semibold text-ink-primary">聊天信息</span>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-tertiary hover:bg-surface-3">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-hairline">

          {/* ── 群名称 / 简介 ── */}
          {!isDm && (
            <div className="px-3 py-3">
              {!editingInfo ? (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-ink-primary truncate">{channel.name}</div>
                    {channel.topic
                      ? <div className="mt-0.5 text-[11.5px] text-ink-secondary line-clamp-2">{channel.topic}</div>
                      : <div className="mt-0.5 text-[11.5px] text-ink-tertiary">暂无群简介</div>}
                  </div>
                  {isAdmin && (
                    <button type="button" onClick={() => { setNameDraft(channel.name); setTopicDraft(channel.topic ?? ''); setEditingInfo(true); }}
                      className="shrink-0 rounded-full p-1 hover:bg-surface-3">
                      <Pencil className="h-3.5 w-3.5 text-ink-tertiary" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="群聊名称" className="h-8 text-[12.5px]" disabled={infoBusy} maxLength={50} />
                  <Textarea value={topicDraft} onChange={(e) => setTopicDraft(e.target.value)}
                    placeholder="群简介（可选）" rows={2} className="text-[12px] resize-none" disabled={infoBusy} />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 gap-1 text-[11.5px]" onClick={handleSaveInfo} disabled={infoBusy}>
                      <Check className="h-3 w-3" /> 保存
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[11.5px]" onClick={() => setEditingInfo(false)}>取消</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 群公告 ── */}
          {!isDm && (
            <div>
              <SectionHeader icon={Megaphone} label="群公告" open={openAnn} onToggle={() => setOpenAnn((v) => !v)} />
              {openAnn && (
                <div className="px-3 pb-3">
                  {!editingAnn ? (
                    <>
                      {channel.announcement
                        ? <div className="rounded-lg bg-brand-50 p-2.5 text-[12px] leading-relaxed text-ink-primary whitespace-pre-wrap line-clamp-4">{channel.announcement}</div>
                        : <p className="text-[12px] text-ink-tertiary">暂无公告</p>}
                      {isAdmin && (
                        <button type="button"
                          onClick={() => { setAnnDraft(channel.announcement ?? ''); setEditingAnn(true); }}
                          className="mt-2 flex items-center gap-1 text-[11.5px] text-brand-600 hover:underline">
                          <Pencil className="h-3 w-3" /> {channel.announcement ? '编辑公告' : '发布公告'}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <Textarea value={annDraft} onChange={(e) => setAnnDraft(e.target.value)}
                        rows={4} className="text-[12px]" placeholder="支持 Markdown…" disabled={annBusy} />
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-7 gap-1 text-[11.5px]" onClick={handleSaveAnn} disabled={annBusy}>
                          <Check className="h-3 w-3" /> 保存
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[11.5px]" onClick={() => setEditingAnn(false)}>取消</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 群成员 ── */}
          <div>
            <SectionHeader icon={Users} label="群成员" count={members.length} open={openMembers} onToggle={() => setOpenMembers((v) => !v)} />
            {openMembers && (
              <div className="px-3 pb-3">
                <div className="grid grid-cols-5 gap-2">
                  {members.map((m) => {
                    const u = orgUsers.get(m.userId);
                    const name = u?.name ?? m.userId;
                    const RoleIcon = m.role === 'owner' ? Crown : m.role === 'admin' ? Shield : null;
                    return (
                      <button key={m.id} type="button" title={name}
                        onClick={() => u && setSelectedUser(u)}
                        className="group flex flex-col items-center gap-1">
                        <div className="relative">
                          <div className={`h-9 w-9 rounded-2xl bg-gradient-to-br ${avatarColor(m.userId)} flex items-center justify-center text-[11px] font-semibold text-white shadow-soft-xs group-hover:ring-2 group-hover:ring-brand-400 group-hover:ring-offset-1 transition`}>
                            {name.slice(0, 1)}
                          </div>
                          {RoleIcon && (
                            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface-1 shadow-soft-xs">
                              <RoleIcon className={`h-2.5 w-2.5 ${m.role === 'owner' ? 'text-warning' : 'text-blue-500'}`} />
                            </span>
                          )}
                        </div>
                        <span className="w-full truncate text-center text-[9.5px] text-ink-secondary">{name.slice(0, 3)}</span>
                      </button>
                    );
                  })}
                  {isAdmin && !isDm && (
                    <button type="button" title="添加成员" onClick={() => setShowAddDialog(true)}
                      className="flex flex-col items-center gap-1">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl border-2 border-dashed border-hairline text-ink-tertiary hover:border-brand-400 hover:text-brand-500 transition">
                        <UserPlus className="h-4 w-4" />
                      </div>
                      <span className="text-[9.5px] text-ink-tertiary">添加</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── 群管理 ── */}
          {isAdmin && !isDm && (
            <div>
              <SectionHeader icon={Settings} label="群管理" open={openMgmt} onToggle={() => setOpenMgmt((v) => !v)} />
              {openMgmt && (
                <div className="pb-2">
                  {members
                    .filter((m) => m.userId !== currentUserId)
                    .map((m) => {
                      const u = orgUsers.get(m.userId);
                      const name = u?.name ?? m.userId;
                      return (
                        <div key={m.id} className="flex items-center gap-2 px-3 py-2 hover:bg-surface-3">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColor(m.userId)} text-[10px] font-semibold text-white`}>
                            {name.slice(0, 1)}
                          </div>
                          <span className="flex-1 truncate text-[12px] text-ink-primary">{name}</span>
                          {isOwner && (
                            <select
                              aria-label={`${name} 角色`}
                              value={m.role}
                              disabled={mgmtBusy}
                              onChange={(e) => handleSetRole(m.userId, e.target.value as 'owner' | 'admin' | 'member')}
                              className="h-6 rounded border border-hairline bg-surface-1 px-1 text-[11px] text-ink-secondary">
                              <option value="member">成员</option>
                              <option value="admin">管理员</option>
                              <option value="owner">转让群主</option>
                            </select>
                          )}
                          <button type="button" disabled={mgmtBusy || m.role === 'owner'}
                            onClick={() => handleRemoveMember(m.userId, name)}
                            className="rounded p-1 text-ink-tertiary hover:bg-danger/10 hover:text-danger disabled:opacity-30 transition">
                            <UserMinus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}

                  {/* 解散群 */}
                  {isOwner && (
                    <button type="button" onClick={handleDissolve} disabled={mgmtBusy}
                      className="mx-3 mt-2 mb-1 flex w-[calc(100%-1.5rem)] items-center justify-center gap-1.5 rounded-md border border-danger/30 py-2 text-[12px] text-danger hover:bg-danger/10 transition disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" /> 解散群
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 群看板 ── */}
          <div>
            <SectionHeader icon={LayoutDashboard} label="群看板" open={openBoard} onToggle={() => setOpenBoard((v) => !v)} />
            {openBoard && (
              <div className="px-3 pb-3 space-y-2">
                {okrs.length === 0
                  ? <p className="text-[12px] text-ink-tertiary">暂无关联 OKR</p>
                  : okrs.map((o) => (
                    <div key={o.id} className="rounded-md border border-hairline bg-surface-3 p-2">
                      <div className="mb-1.5 flex items-start justify-between gap-1">
                        <span className="text-[11.5px] font-medium text-ink-primary leading-snug line-clamp-2">{o.title}</span>
                        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${confColor(o.confidence)}`} />
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-md bg-surface-3">
                        <div className={`h-full rounded-full ${confColor(o.confidence)}`} style={{ width: `${Math.min(100, o.currentProgress)}%` }} />
                      </div>
                      <div className="mt-1 text-right text-[10px] text-ink-tertiary">{o.currentProgress}%</div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* ── 消息设置 ── */}
          <div>
            <SectionHeader icon={BellOff} label="消息设置" open={openSettings} onToggle={() => setOpenSettings((v) => !v)} />
            {openSettings && (
              <div className="px-3 pb-3 space-y-0">
                {[
                  { icon: BellOff, label: '消息免打扰', key: 'muted' as const, val: mute, set: setMute },
                  { icon: Pin, label: '置顶聊天', key: 'pinnedChat' as const, val: pinned, set: setPinned },
                  { icon: Bookmark, label: '标记', key: 'markedChat' as const, val: marked, set: setMarked },
                ].map(({ icon: Icon, label, key, val, set }) => (
                  <div key={label} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-ink-secondary" />
                      <span className="text-[12.5px] text-ink-primary">{label}</span>
                    </div>
                    <Toggle on={val} onToggle={() => {
                      const next = !val;
                      set(next);
                      void fetch(`/api/im/channels/${channel.id}/members`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ [key]: next }),
                      });
                    }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 智能总结 ── */}
          <div>
            <SectionHeader icon={Sparkles} label="智能总结" open={openSummary}
              onToggle={() => { setOpenSummary((v) => !v); if (!openSummary && !summary) void requestSummary(); }} />
            {openSummary && (
              <div className="px-3 pb-3">
                {summaryLoading ? (
                  <div className="flex items-center gap-2 text-[12px] text-ink-tertiary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI 正在阅读群聊…
                  </div>
                ) : summary ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-brand-100 bg-brand-50 p-2.5 text-[12px] leading-relaxed text-ink-primary whitespace-pre-wrap">{summary}</div>
                    <button type="button" onClick={() => void requestSummary()}
                      className="flex items-center gap-1 text-[11.5px] text-brand-600 hover:underline">
                      <Sparkles className="h-3 w-3" /> 重新生成
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => void requestSummary()}
                    className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-[12px] text-brand-700 hover:bg-brand-100 transition">
                    <Sparkles className="h-3.5 w-3.5" /> 生成群聊总结
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </aside>

      {selectedUser && (
        <MemberCard user={selectedUser} onClose={() => setSelectedUser(null)}
          onStartDm={(userId) => { setSelectedUser(null); window.dispatchEvent(new CustomEvent('im:startDm', { detail: userId })); }} />
      )}

      {showAddDialog && (
        <AddMembersDialog
          channelId={channel.id}
          operatorId={currentUserId}
          existingIds={new Set(members.map((m) => m.userId))}
          onAdded={() => { void loadMembers(); onChanged(); }}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </>
  );
}

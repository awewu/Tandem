'use client';

/**
 * 按组织架构一键建群对话框 (IM P1, 2026-05-10)
 *
 * HR/Admin 视角:
 *   - 列出所有部门 + 下辖 ministry, 默认全选
 *   - 勾选哪些要建群 (已存在的自动跳过)
 *   - 显示预估成员数
 *   - 执行 → 展示结果 (created / skipped)
 *
 * 数据流:
 *   zustand OrgStore (departments) + OKRStore (people.ministryId)
 *     → 组装 specs → POST /api/im/channels/seed-from-org → 结果面板
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2, UsersRound, CheckCircle2, AlertCircle, Sparkles,
  Users,
} from 'lucide-react';
import { useOrgStore } from '@/lib/store';
import { useOrgPeopleStore } from '@/lib/org/people-source';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  /** 建群成功后触发, 父组件应 reloadChannels */
  onSeeded: () => void;
}

interface RowSpec {
  id: string;             // department.id 或 ministry.id
  name: string;
  parentName?: string;    // ministry 时是 department name
  level: 'department' | 'team';
  memberIds: string[];
}

interface SeedResponse {
  created: { departmentId: string; channelId: string; name: string }[];
  skipped: { departmentId: string; reason: string; existingChannelId?: string }[];
}

export function SeedFromOrgDialog({ open, onOpenChange, currentUserId, onSeeded }: Props) {
  const { departments } = useOrgStore();
  // E-pragma (2026-05-31): 真用户 + fixture 合并后的人源
  const people = useOrgPeopleStore((s) => s.people);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 展平: 每个 department + 每个 ministry 都是一行
  const rows = useMemo<RowSpec[]>(() => {
    const out: RowSpec[] = [];
    for (const d of departments) {
      const deptMembers = people
        .filter((p) =>
          p.ministryId === d.id ||
          d.ministries.some((m) => m.id === p.ministryId)
        )
        .map((p) => p.id);
      out.push({
        id: d.id,
        name: `${d.name} 工作群`,
        level: 'department',
        memberIds: deptMembers,
      });
      for (const m of d.ministries) {
        const teamMembers = people
          .filter((p) => p.ministryId === m.id)
          .map((p) => p.id);
        out.push({
          id: m.id,
          name: `${d.name} / ${m.name}`,
          parentName: d.name,
          level: 'team',
          memberIds: teamMembers,
        });
      }
    }
    return out;
  }, [departments, people]);

  // 对话框打开时: 默认全选 (且清结果)
  useEffect(() => {
    if (open) {
      setSelected(new Set(rows.map((r) => r.id)));
      setResult(null);
      setError(null);
    }
  }, [open, rows]);

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const handleSeed = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const specs = rows
        .filter((r) => selected.has(r.id))
        .map((r) => ({
          departmentId: r.id,
          name: r.level === 'department' ? r.name : `${r.name} 工作群`,
          memberIds: r.memberIds,
          level: r.level,
        }));
      if (specs.length === 0) {
        setError('至少选 1 个部门/团队');
        return;
      }
      const res = await fetch('/api/im/channels/seed-from-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: currentUserId, specs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setResult(data);
      if (data.created.length > 0) onSeeded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const allChecked = selected.size === rows.length && rows.length > 0;
  const totalMembers = rows
    .filter((r) => selected.has(r.id))
    .reduce((s, r) => s + r.memberIds.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-warning" />
            按组织架构一键建群
          </DialogTitle>
          <div className="text-[11px] text-muted-foreground mt-1">
            每个部门 + 团队生成 1 个工作群 · 已存在的自动跳过 (幂等)
          </div>
        </DialogHeader>

        {/* 结果面板 */}
        {result ? (
          <div className="flex-1 overflow-y-auto space-y-3 py-2">
            {result.created.length > 0 && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-footnote font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  新建 {result.created.length} 个群
                </div>
                {result.created.map((c) => (
                  <div key={c.channelId} className="text-[11px] text-emerald-700 pl-5">
                    ✓ {c.name}
                  </div>
                ))}
              </div>
            )}
            {result.skipped.length > 0 && (
              <div className="rounded-md border border-hairline bg-surface-3 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-footnote font-semibold text-ink-primary">
                  <AlertCircle className="h-3.5 w-3.5" />
                  跳过 {result.skipped.length} 个
                </div>
                {result.skipped.map((s) => (
                  <div key={s.departmentId} className="text-[11px] text-ink-secondary pl-5">
                    · {s.departmentId}: {s.reason}
                  </div>
                ))}
              </div>
            )}
            {result.created.length === 0 && result.skipped.length === 0 && (
              <div className="text-footnote text-muted-foreground text-center py-4">
                无变更
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 列表 */}
            <div className="flex items-center justify-between pb-1 text-[11px] border-b">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded border-hairline accent-brand-600"
                />
                <span className="font-medium">全选</span>
              </label>
              <span className="text-muted-foreground">
                选 {selected.size}/{rows.length} · 共 {totalMembers} 人 (含重复)
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-0.5 py-1">
              {rows.map((r) => {
                const Icon = r.level === 'department' ? Building2 : UsersRound;
                return (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      className="h-3.5 w-3.5 rounded border-hairline accent-brand-600"
                    />
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        r.level === 'department' ? 'text-blue-600' : 'text-ink-secondary'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-footnote truncate">
                        {r.level === 'team' && r.parentName && (
                          <span className="text-muted-foreground">{r.parentName} / </span>
                        )}
                        <span className="font-medium">
                          {r.level === 'department' ? r.name : r.name.split(' / ').pop()}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Users className="h-2.5 w-2.5" />
                        {r.memberIds.length} 人
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] h-4">
                      {r.level === 'department' ? '部门' : '团队'}
                    </Badge>
                  </label>
                );
              })}
              {rows.length === 0 && (
                <div className="text-footnote text-muted-foreground text-center py-6">
                  无部门数据 · 先去 /organization 配置
                </div>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-footnote text-destructive">
            {error}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>完成</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                取消
              </Button>
              <Button onClick={handleSeed} disabled={busy || selected.size === 0}>
                {busy ? '建群中...' : `一键建 ${selected.size} 个群`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

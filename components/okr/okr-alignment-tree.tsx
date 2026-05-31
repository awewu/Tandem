'use client';

/**
 * OKR 跨部门对齐树 · P0.2 (2026-05-10)
 *
 * 解决 Tita 缺口: 公司战略 (顶层 O) → 部门/团队 O → 个人 O 的穿透可视化.
 *
 * 数据源 (零新字段):
 *   - Objective.parentId → 树结构 (现有)
 *   - Objective.ownerId → 'person:X' 或 'team:<ministryId>' (现有)
 *   - useOrgStore.departments → ministry → department 映射
 *   - useOKRStore.people → person → ministry 映射
 *
 * 特色:
 *   - **跨部门高亮**: 父子 ownerId 不同部门时, 连线加粗红色边框提示对齐风险
 *   - **部门 swimlane**: 同层节点按部门染色 (一眼看出"哪个部门的 OKR 挂在公司战略下")
 *   - **进度条 + 信心点**: 节点内显示 progress + confidence
 *   - **孤儿 O**: 没挂父的 O 单独一栏 (提示可对齐)
 *
 * 与 /okr/cascade (5 层 O→KR→I→DC→AP) 的区别:
 *   - cascade 是"单 Objective 的纵向穿透 5 层"
 *   - alignment 是"全公司 Objective 间的横向对齐 + 部门维度"
 */

import { useMemo } from 'react';
import { useOKRStore, useOrgStore } from '@/lib/store';
import { buildDeptIndex, resolveOwner as resolveOwnerSSOT } from '@/lib/org/ownership';
import { Badge } from '@/components/ui/badge';
import {
  Network, AlertTriangle, Building2, User, Users, ChevronRight,
} from 'lucide-react';
import type { Objective } from '@/lib/store';

interface Props {
  /** 当前选中 objective (用于高亮祖孙链路) */
  selectedId?: string | null;
  cycleId: string;
  onSelect?: (objId: string) => void;
}

/** KR 加权平均 → Objective progress */
function calcObjProgress(
  obj: Objective,
  keyResults: ReturnType<typeof useOKRStore.getState>['keyResults'],
): number {
  if (obj.progressOverride !== undefined && obj.progressOverride !== null) return obj.progressOverride;
  const krs = keyResults.filter((k) => k.objectiveId === obj.id);
  if (!krs.length) return 0;
  const totalW = krs.reduce((s, k) => s + (k.weight || 0), 0) || krs.length;
  let sum = 0;
  for (const k of krs) {
    const denom = k.targetValue - k.startValue;
    const pct = Math.abs(denom) < 0.0001
      ? (k.currentValue >= k.targetValue ? 100 : 0)
      : Math.max(0, Math.min(100, ((k.currentValue - k.startValue) / denom) * 100));
    sum += (pct * (k.weight || 1)) / (totalW || 1);
  }
  return Math.round(sum);
}

const DEPT_COLORS = [
  'bg-blue-50 border-blue-200 text-blue-900',
  'bg-emerald-50 border-emerald-200 text-emerald-900',
  'bg-violet-50 border-violet-200 text-violet-900',
  'bg-warning/5 border-warning/20 text-warning',
  'bg-rose-50 border-rose-200 text-rose-900',
  'bg-cyan-50 border-cyan-200 text-cyan-900',
  'bg-lime-50 border-lime-200 text-lime-900',
];

export function OKRAlignmentTree({ selectedId, cycleId, onSelect }: Props) {
  const { objectives, keyResults, people } = useOKRStore();
  const { departments } = useOrgStore();

  // ministry/department → 索引 (Ownership SSOT)
  const deptIndex = useMemo(() => buildDeptIndex(departments), [departments]);

  // 部门 → 颜色
  const deptColor = useMemo(() => {
    const m = new Map<string, string>();
    departments.forEach((d, i) => m.set(d.id, DEPT_COLORS[i % DEPT_COLORS.length]));
    return m;
  }, [departments]);

  // 仅取当前 cycle 的非归档 O
  const cycleObjs = useMemo(
    () => objectives.filter((o) => o.cycleId === cycleId && o.status !== 'archived'),
    [objectives, cycleId]
  );

  // 构建树: parentId → children[]
  const childrenMap = useMemo(() => {
    const m = new Map<string | null, Objective[]>();
    for (const o of cycleObjs) {
      const pid = o.parentId ?? null;
      const arr = m.get(pid) ?? [];
      arr.push(o);
      m.set(pid, arr);
    }
    return m;
  }, [cycleObjs]);

  const roots = childrenMap.get(null) ?? [];

  // 祖孙链路 (highlight)
  const highlightChain = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const s = new Set<string>();
    // 祖: 向上爬
    let cur: string | undefined = selectedId;
    while (cur) {
      s.add(cur);
      const o = cycleObjs.find((x) => x.id === cur);
      cur = o?.parentId ?? undefined;
    }
    // 孙: BFS
    const queue = [selectedId];
    while (queue.length) {
      const id = queue.shift()!;
      const kids = childrenMap.get(id) ?? [];
      for (const k of kids) {
        s.add(k.id);
        queue.push(k.id);
      }
    }
    return s;
  }, [selectedId, cycleObjs, childrenMap]);

  if (cycleObjs.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-caption text-muted-foreground">
        本 cycle 暂无 Objective · 先创建至少 1 个 O 再看对齐
      </div>
    );
  }

  const renderNode = (obj: Objective, depth: number, parentOwner?: string): React.ReactNode => {
    const progress = calcObjProgress(obj, keyResults);
    const owner = resolveOwnerSSOT(obj.ownerId, { people, deptIndex });
    const color = owner.deptId
      ? deptColor.get(owner.deptId) ?? 'bg-slate-50 border-slate-200 text-slate-900'
      : 'bg-slate-50 border-slate-200 text-slate-900';
    const children = childrenMap.get(obj.id) ?? [];

    // 跨部门警告: 父和子 ownerId deptId 不同
    let crossDeptWarn = false;
    if (parentOwner) {
      const parentResolved = resolveOwnerSSOT(parentOwner, { people, deptIndex });
      if (parentResolved.deptId && owner.deptId && parentResolved.deptId !== owner.deptId) {
        crossDeptWarn = true;
      }
    }

    const dimmed = selectedId && !highlightChain.has(obj.id);
    const isSelected = obj.id === selectedId;

    // Confidence = 'on-track' | 'at-risk' | 'off-track'
    const confColor =
      obj.confidence === 'on-track' ? 'bg-emerald-500' :
      obj.confidence === 'at-risk' ? 'bg-warning' : 'bg-rose-500';

    return (
      <div key={obj.id} className="relative">
        <div
          className={`flex items-start gap-2 rounded-md border-l-2 p-2 transition ${color} ${
            dimmed ? 'opacity-40' : ''
          } ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
          style={{ marginLeft: depth * 20 }}
        >
          {crossDeptWarn && (
            <div
              className="mt-0.5 shrink-0"
              title="跨部门对齐 · 上下级属不同部门"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onSelect?.(obj.id)}
              className="text-left w-full group"
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`h-1.5 w-1.5 rounded-full ${confColor}`} title={`信心 ${obj.confidence}`} />
                <span className="text-footnote font-semibold line-clamp-1 group-hover:underline">
                  {obj.title}
                </span>
                {obj.status === 'paused' && (
                  <Badge variant="outline" className="h-4 text-[9px] border-warning/30 text-warning">
                    暂停
                  </Badge>
                )}
                {obj.confidence === 'off-track' && (
                  <Badge variant="outline" className="h-4 text-[9px] border-rose-300 text-rose-700">
                    偏离
                  </Badge>
                )}
                {obj.confidence === 'on-track' && obj.status === 'active' && (
                  <Badge variant="outline" className="h-4 text-[9px] border-emerald-300 text-emerald-700">
                    在轨
                  </Badge>
                )}
              </div>

              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                {owner.kind === 'team' ? (
                  <Users className="h-2.5 w-2.5" />
                ) : (
                  <User className="h-2.5 w-2.5" />
                )}
                <span>{owner.name}</span>
                {owner.deptName && (
                  <>
                    <span className="text-slate-300">·</span>
                    <Building2 className="h-2.5 w-2.5" />
                    <span>{owner.deptName}</span>
                  </>
                )}
              </div>

              {/* Progress bar */}
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="flex-1 h-1 bg-white/70 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      progress >= 70 ? 'bg-emerald-500' :
                      progress >= 40 ? 'bg-warning' : 'bg-rose-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums font-medium min-w-[28px] text-right">
                  {progress}%
                </span>
              </div>
            </button>
          </div>

          {children.length > 0 && (
            <ChevronRight className="h-3 w-3 mt-1 text-slate-400 shrink-0" />
          )}
        </div>

        {/* Children */}
        {children.length > 0 && (
          <div className="mt-1 space-y-1">
            {children.map((c) => renderNode(c, depth + 1, obj.ownerId))}
          </div>
        )}
      </div>
    );
  };

  const orphans = childrenMap.get(null) ?? [];
  const withParent = cycleObjs.filter((o) => o.parentId);
  const totalCross = cycleObjs.reduce((cnt, o) => {
    if (!o.parentId) return cnt;
    const parent = cycleObjs.find((p) => p.id === o.parentId);
    if (!parent) return cnt;
    const co = resolveOwnerSSOT(o.ownerId, { people, deptIndex });
    const cp = resolveOwnerSSOT(parent.ownerId, { people, deptIndex });
    if (co.deptId && cp.deptId && co.deptId !== cp.deptId) return cnt + 1;
    return cnt;
  }, 0);

  return (
    <div className="space-y-3">
      {/* 概览 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-caption font-semibold">
            <Network className="h-4 w-4 text-violet-600" />
            跨部门对齐树
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {roots.length} 根 · {withParent.length} 条对齐 · {totalCross} 条跨部门
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-rose-600" />
            跨部门
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> &ge; 70%
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-warning" /> 40-69%
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> &lt; 40%
          </span>
        </div>
      </div>

      {/* 部门图例 */}
      {departments.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          {departments.map((d) => (
            <Badge
              key={d.id}
              variant="outline"
              className={`text-[10px] font-normal ${deptColor.get(d.id) ?? ''}`}
            >
              <Building2 className="h-2.5 w-2.5 mr-0.5" />
              {d.name}
            </Badge>
          ))}
        </div>
      )}

      {/* 树根 */}
      {orphans.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-footnote text-muted-foreground">
          无根节点 (所有 O 都有父对齐)
        </div>
      ) : (
        <div className="space-y-2">
          {orphans.map((root) => renderNode(root, 0))}
        </div>
      )}

      {/* 说明 */}
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-2.5 text-[10.5px] text-slate-600">
        <strong>💡 怎么用:</strong> 点节点 → 右侧详情联动 | 高亮链路 = 选中 O 的祖+孙 |
        红三角 ⚠️ = 子 O 跟父 O 不同部门 (公司战略沟通风险点, 该季复盘重点)
      </div>
    </div>
  );
}

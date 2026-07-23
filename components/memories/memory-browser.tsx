/**
 * <MemoryBrowser>
 *
 * 组织记忆浏览器 · 按【职能/部门 × 知识类型 × 权威级别】过滤浏览。
 *
 * 设计说明 (回答"是否按财务/人力/市场等职能大类分"):
 *   职能维度不是硬编码枚举, 而是通过 ownerDepartmentId 绑定 HR 部门线动态浮现。
 *   本浏览器把 company 级归入「全公司」桶, department/team 级按其部门分组,
 *   并叠加 type(SOP/案例/红线/价值观/教训)与 ownershipLevel 两个正交过滤维度。
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BookOpen, AlertTriangle, Lightbulb, Heart, TrendingUp, RefreshCw,
  Building2, Search, Filter,
} from 'lucide-react';

type MemType = 'sop' | 'case' | 'redline' | 'value' | 'lesson';
type Ownership = 'company' | 'department' | 'team' | 'personal';

interface MemoryRow {
  id: string;
  type: MemType;
  title: string;
  status: string;
  ownershipLevel?: Ownership;
  ownerDepartmentId?: string | null;
  tags?: string[];
  referenceCount: number;
  updatedAt: string;
}

interface Dept { id: string; name: string; }

const TYPE_META: Record<MemType, { label: string; icon: React.ElementType; color: string }> = {
  sop: { label: 'SOP', icon: BookOpen, color: 'bg-sky-100 text-sky-800 border-sky-200' },
  case: { label: '案例', icon: Lightbulb, color: 'bg-warning/10 text-warning border-warning/20' },
  redline: { label: '红线', icon: AlertTriangle, color: 'bg-rose-100 text-rose-800 border-rose-200' },
  value: { label: '价值观', icon: Heart, color: 'bg-violet-100 text-violet-800 border-violet-200' },
  lesson: { label: '教训', icon: TrendingUp, color: 'bg-surface-1 text-ink-primary border' },
};

const LEVEL_LABELS: Record<Exclude<Ownership, 'personal'>, string> = {
  company: '公司级', department: '部门级', team: '团队级',
};

const COMPANY_BUCKET = '__company__';
const OTHER_BUCKET = '__other__';

export function MemoryBrowser() {
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dept, setDept] = useState<string>('all');
  const [type, setType] = useState<string>('all');
  const [level, setLevel] = useState<string>('all');
  const [status, setStatus] = useState<string>('active');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (status !== 'all') params.set('status', status);
      if (type !== 'all') params.set('type', type);
      if (level !== 'all') params.set('ownershipLevel', level);
      if (dept !== 'all') params.set('ownerDepartmentId', dept);
      const r = await fetch(`/api/tandem/memory/list?${params.toString()}`, { cache: 'no-store', credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const list: MemoryRow[] = Array.isArray(j.memories) ? j.memories : [];
      // 组织记忆绝不含个人记事 (已归位「搭子手抄」)
      setRows(list.filter((m) => m.ownershipLevel !== 'personal'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [status, type, level, dept]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    fetch('/api/org/departments', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { depts: [] }))
      .then((j) => setDepts(Array.isArray(j.depts) ? j.depts : []))
      .catch(() => setDepts([]));
  }, []);

  const deptName = useCallback(
    (id?: string | null) => (id ? depts.find((d) => d.id === id)?.name ?? id : null),
    [depts],
  );

  // 文本搜索 (标题 + 标签), 客户端
  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(
      (m) => m.title.toLowerCase().includes(kw) || (m.tags ?? []).some((t) => t.toLowerCase().includes(kw)),
    );
  }, [rows, q]);

  // 按"职能/部门"分组: company → 全公司桶; department/team → 各自部门; 未知部门 → 其他
  const groups = useMemo(() => {
    const map = new Map<string, MemoryRow[]>();
    for (const m of filtered) {
      let key: string;
      if (m.ownershipLevel === 'company') key = COMPANY_BUCKET;
      else if (m.ownerDepartmentId) key = m.ownerDepartmentId;
      else key = OTHER_BUCKET;
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    const order = (k: string) => (k === COMPANY_BUCKET ? 0 : k === OTHER_BUCKET ? 2 : 1);
    return Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        label: key === COMPANY_BUCKET ? '全公司' : key === OTHER_BUCKET ? '未归属部门' : deptName(key) ?? key,
        items: items.sort((a, b) => b.referenceCount - a.referenceCount),
      }))
      .sort((a, b) => order(a.key) - order(b.key) || b.items.length - a.items.length);
  }, [filtered, deptName]);

  const total = filtered.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-body flex items-center gap-2">
              <Filter className="h-4 w-4" /> 组织记忆浏览器
            </CardTitle>
            <p className="text-footnote text-muted-foreground mt-1">
              按【部门/职能 × 知识类型 × 权威级别】筛选 · 职能分组由部门归属动态生成, 非固定枚举
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 过滤条 */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="w-40"><SelectValue placeholder="部门" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部部门</SelectItem>
              {depts.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-32"><SelectValue placeholder="类型" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {(Object.keys(TYPE_META) as MemType[]).map((t) => (
                <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="w-32"><SelectValue placeholder="级别" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部级别</SelectItem>
              <SelectItem value="company">公司级</SelectItem>
              <SelectItem value="department">部门级</SelectItem>
              <SelectItem value="team">团队级</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue placeholder="状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">生效中</SelectItem>
              <SelectItem value="revising">修订中</SelectItem>
              <SelectItem value="deprecated">已废弃</SelectItem>
              <SelectItem value="all">全部状态</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[10rem]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索标题 / 标签" className="pl-7" />
          </div>
        </div>

        {loading ? (
          <div className="text-footnote text-muted-foreground py-8 text-center">加载中…</div>
        ) : error ? (
          <div className="text-footnote text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
            加载失败: {error} · <button onClick={() => void load()} className="underline">重试</button>
          </div>
        ) : total === 0 ? (
          <div className="text-footnote text-muted-foreground bg-muted/30 border border-dashed rounded px-3 py-8 text-center">
            没有符合条件的组织记忆
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-footnote text-muted-foreground">共 {total} 条 · {groups.length} 个分组</div>
            {groups.map((g) => (
              <div key={g.key}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-caption font-semibold">{g.label}</span>
                  <span className="text-footnote text-muted-foreground">({g.items.length})</span>
                </div>
                <ul className="divide-y divide-border border rounded-md">
                  {g.items.map((m) => {
                    const meta = TYPE_META[m.type];
                    const Icon = meta.icon;
                    return (
                      <li key={m.id} className="px-3 py-2 hover:bg-muted/30 transition-colors flex items-center gap-2 text-caption">
                        <Badge variant="outline" className={`${meta.color} shrink-0 gap-1`}>
                          <Icon className="h-3 w-3" />{meta.label}
                        </Badge>
                        {m.ownershipLevel && m.ownershipLevel !== 'personal' && (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {LEVEL_LABELS[m.ownershipLevel]}
                          </Badge>
                        )}
                        <span className="flex-1 truncate font-medium">{m.title}</span>
                        {(m.tags ?? []).slice(0, 2).map((t) => (
                          <span key={t} className="text-footnote text-muted-foreground hidden sm:inline">#{t}</span>
                        ))}
                        <span className="text-footnote text-muted-foreground tabular-nums shrink-0">引用 {m.referenceCount}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

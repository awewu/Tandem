'use client';

/**
 * /dashboard — 三层 Dashboard 入口枢纽 (P3-11)
 *
 * 已有的 3 个层级 dashboard 入口在不同路径, 本页提供统一导航 + 快速摘要:
 *   - 员工 (我):     /  (主页 WorkbenchCards) + /api/me/dashboard 数据
 *   - 主管 / 部门:   /okr/dashboard  + /1on1 (我的下属)
 *   - 高管 / 老板:   /admin/kpi/health-dashboard + /nine-box + KPI analytics
 *
 * 角色路由策略 (本页只是导航, 不阻拦):
 *   - 任何人都能看到 3 个区块, 但点进去的页本身有 requireRole 守卫
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  User, Users2, Building2, Target, BarChart3, Activity, Grid3x3,
  ArrowRight, Briefcase, MessageSquare, AlertTriangle, TrendingUp,
} from 'lucide-react';
import { useCurrentUser } from '@/lib/hooks/use-current-user';

interface MeDashboard {
  todos?: { totalCount?: number; myKrAtRisk?: unknown[]; myTtiInProgress?: unknown[] };
  creation?: { myMemoryContributions?: { total?: number } };
}

interface KpiSummary {
  total?: number;
  green?: number;
  amber?: number;
  red?: number;
}

export default function DashboardHubPage() {
  const { user } = useCurrentUser();
  const roles = (user?.roles ?? []) as string[];
  const isManager = roles.includes('manager') || roles.includes('admin') || roles.includes('hr');
  const isExec = roles.includes('admin') || roles.includes('champion') || roles.includes('hr');

  const [me, setMe] = useState<MeDashboard | null>(null);
  const [kpi, setKpi] = useState<KpiSummary | null>(null);

  useEffect(() => {
    fetch('/api/me/dashboard', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isExec) return;
    // 取 active KPI cycle 的 company-summary
    fetch('/api/kpi/cycles', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const cycles = j?.cycles ?? [];
        const active = cycles.find((c: { status: string }) => c.status === 'active') ?? cycles[0];
        if (!active) return null;
        return fetch(`/api/kpi/analytics?view=company-summary&cycleId=${active.id}`, {
          credentials: 'include',
        }).then((r) => (r.ok ? r.json() : null));
      })
      .then((j) => {
        if (j) setKpi(j);
      })
      .catch(() => {});
  }, [isExec]);

  const myTodos = me?.todos?.totalCount ?? 0;
  const myKrAtRisk = me?.todos?.myKrAtRisk?.length ?? 0;
  const myMemContrib = me?.creation?.myMemoryContributions?.total ?? 0;

  return (
    <div className="page-container py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Dashboard 入口
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          三层视角: 员工 (我) · 主管 (下属) · 高管 (全公司)
        </p>
      </header>

      {/* ① 员工层 — 任何人都看得到 */}
      <Card className="border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-blue-700">
            <User className="h-4 w-4" />
            ① 员工层 · 我的工作台
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Tile label="我的待办" value={myTodos} icon={Briefcase} tone="blue" />
            <Tile label="风险 KR" value={myKrAtRisk} icon={AlertTriangle} tone="amber" />
            <Tile label="Memory 贡献" value={myMemContrib} icon={Target} tone="emerald" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <NavLink href="/" label="主页 工作台" />
            <NavLink href="/okr" label="我的 OKR" />
            <NavLink href="/persona" label="我的 Persona" />
            <NavLink href="/1on1" label="我的 1on1" />
          </div>
        </CardContent>
      </Card>

      {/* ② 主管层 */}
      {isManager ? (
        <Card className="border-violet-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-violet-700">
              <Users2 className="h-4 w-4" />
              ② 主管层 · 下属与部门
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              下属 OKR 进度 · 1on1 节奏 · 360 反馈 · 部门聚合
            </p>
            <div className="flex gap-2 flex-wrap">
              <NavLink href="/okr/dashboard" label="部门 OKR Dashboard" icon={BarChart3} />
              <NavLink href="/1on1" label="1on1 全部" icon={MessageSquare} />
              <NavLink href="/admin/organization" label="员工组织" icon={Building2} />
              <NavLink href="/review-360" label="360 反馈" icon={Users2} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="opacity-60">
          <CardContent className="py-4 text-xs text-muted-foreground flex items-center gap-2">
            <Users2 className="h-4 w-4" />
            ② 主管层 · 仅 manager / admin / hr 角色可见
          </CardContent>
        </Card>
      )}

      {/* ③ 高管层 */}
      {isExec ? (
        <Card className="border-rose-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-rose-700">
              <Building2 className="h-4 w-4" />
              ③ 高管层 · 全公司视角
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {kpi && (
              <div className="grid grid-cols-4 gap-3">
                <Tile label="KPI 总数" value={kpi.total ?? 0} icon={Activity} tone="blue" />
                <Tile label="健康" value={kpi.green ?? 0} icon={TrendingUp} tone="emerald" />
                <Tile label="警戒" value={kpi.amber ?? 0} icon={AlertTriangle} tone="amber" />
                <Tile label="风险" value={kpi.red ?? 0} icon={AlertTriangle} tone="rose" />
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <NavLink href="/admin/kpi/health-dashboard" label="KPI 健康度" icon={Activity} />
              <NavLink href="/nine-box" label="9-box 矩阵" icon={Grid3x3} />
              <NavLink href="/admin/organization" label="员工组织" icon={Building2} />
              <NavLink href="/admin/intranet" label="Intranet 管理" />
              <NavLink href="/admin/audit" label="审计日志" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="opacity-60">
          <CardContent className="py-4 text-xs text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            ③ 高管层 · 仅 admin / champion / hr 角色可见
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Tile({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  tone: 'blue' | 'amber' | 'emerald' | 'rose';
}) {
  const TONE: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <div className={`rounded-lg border p-3 ${TONE[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon?: React.ElementType }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-1.5 text-xs hover:bg-muted/40 transition-colors"
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
      <ArrowRight className="h-3 w-3 opacity-50" />
    </Link>
  );
}
// avoid unused import
void Badge;

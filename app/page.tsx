'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Users,
  Grid3x3,
  Brain,
  Target,
  ScrollText,
  Ticket,
  Layers,
  Lock,
  ShieldCheck,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  TrendingUp,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  decisionCards: {
    total: number;
    committed: number;
    escalated: number;
    vetoed: number;
    inTimeRate: number;
    dRate: number;
  };
  memories: {
    total: number;
    byType: { sop: number; case: number; redline: number; value: number };
  };
  okr: {
    objectives: number;
    keyResults: number;
    keyResultsOnTrack: number;
    ttis: number;
  };
  personas: {
    total: number;
    byStage: Record<string, number>;
  };
  recentDecisions: Array<{
    id: string;
    title: string;
    state: string;
    elapsedSeconds: number;
    selected?: string;
    createdAt: string;
  }>;
}

const stageMeta: Record<string, { emoji: string; label: string }> = {
  newborn: { emoji: '🥚', label: '新生 newborn' },
  apprentice: { emoji: '🐣', label: '学徒 apprentice' },
  assistant: { emoji: '🐤', label: '助理 assistant' },
  deputy: { emoji: '🦅', label: '副手 deputy' },
  partner: { emoji: '🐉', label: '搭档 partner' },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-slate-50 via-white to-amber-50/30">
      <div className="container mx-auto max-w-7xl space-y-6 p-6">
        {/* Hero */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Tandem · 牛马搭子
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              17 分钟达成共识的 AI 协作伙伴 · V1 PoC
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="outline" size="sm">
                <Lock className="mr-1.5 h-3.5 w-3.5" /> 登录
              </Button>
            </Link>
            <Link href="/admin/invite">
              <Button size="sm">
                <Ticket className="mr-1.5 h-3.5 w-3.5" /> 发邀请码
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI 条 */}
        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard
            title="议事室决议"
            value={stats?.decisionCards.total ?? '—'}
            sub={`${stats?.decisionCards.committed ?? 0} 已成 · ${stats?.decisionCards.escalated ?? 0} 升级`}
            icon={Sparkles}
            href="/decision-card"
            accent="amber"
          />
          <KpiCard
            title="17 分钟达成率"
            value={
              stats
                ? `${Math.round(stats.decisionCards.inTimeRate * 100)}%`
                : '—'
            }
            sub={`目标 ≥ 70% · D 选项 ${stats ? Math.round(stats.decisionCards.dRate * 100) : 0}%`}
            icon={Clock}
            href="/convergence"
            accent="emerald"
          />
          <KpiCard
            title="Memory 知识资产"
            value={stats?.memories.total ?? '—'}
            sub={`${stats?.memories.byType.sop ?? 0} SOP · ${stats?.memories.byType.case ?? 0} 案例 · ${stats?.memories.byType.redline ?? 0} 红线`}
            icon={Brain}
            href="/memories"
            accent="violet"
          />
          <KpiCard
            title="活跃 Persona"
            value={stats?.personas.total ?? '—'}
            sub={
              stats
                ? Object.entries(stats.personas.byStage)
                    .map(([k, v]) => `${stageMeta[k]?.emoji ?? '·'} ${v}`)
                    .join(' · ') || '—'
                : '—'
            }
            icon={Users}
            href="/persona/evolution"
            accent="sky"
          />
        </div>

        {/* 核心功能导览 */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">核心功能 · Take a Tour</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Sparkles}
              iconColor="text-amber-600 bg-amber-50"
              title="议事室 (5 步 + 17min)"
              desc="CONTEXT_GATHER → OPTION_GENERATION → DELIBERATION → CONVERGENCE → COMMIT. 流式生成 3+1 选项 (SOP/AI 推演/历史/原创)."
              href="/convergence"
              cta="进入议事室"
            />
            <FeatureCard
              icon={ScrollText}
              iconColor="text-orange-600 bg-orange-50"
              title="决议卡 (Decision Card)"
              desc="所有决议结构化沉淀, 自动 watermark + 24h 否决窗口 + 7 天后自动复盘."
              href="/decision-card"
              cta="查看历史决议"
            />
            <FeatureCard
              icon={Users}
              iconColor="text-sky-600 bg-sky-50"
              title="Persona 5 阶段进化"
              desc="🥚 newborn → 🐣 apprentice → 🐤 assistant → 🦅 deputy → 🐉 partner. 学习钩子 + 代行控制台."
              href="/persona/evolution"
              cta="看分身进度"
            />
            <FeatureCard
              icon={Grid3x3}
              iconColor="text-fuchsia-600 bg-fuchsia-50"
              title="9 宫格人才矩阵"
              desc="KPI × TTI 双轨 (TTI 60-70% 最佳, 超额是反信号). 9 类标签自动归位."
              href="/nine-box"
              cta="人才地图"
            />
            <FeatureCard
              icon={Target}
              iconColor="text-emerald-600 bg-emerald-50"
              title="OKR + TTI 双轨"
              desc="硬指标 + 成长度. KR 健康度信号 + 自动 Check-in 草稿 + 风险预警."
              href="/okr"
              cta="OKR 看板"
              extra={
                stats
                  ? `${stats.okr.keyResultsOnTrack}/${stats.okr.keyResults} KR 健康`
                  : undefined
              }
            />
            <FeatureCard
              icon={Brain}
              iconColor="text-violet-600 bg-violet-50"
              title="Memory 三级签批门"
              desc="宪章 §8.1: Lv1 团队 (3d) / Lv2 部门 (5d) / Lv3 公司 (14d). SLA 逾期自动 escalate +1 级."
              href="/admin/steward"
              cta="Steward 工作台"
            />
            <FeatureCard
              icon={Layers}
              iconColor="text-indigo-600 bg-indigo-50"
              title="Skills 注册中心"
              desc="6 个内置 skills · 红/黄/绿区分级 · 代行守门 · 预算追踪."
              href="/admin/tandem-skills"
              cta="技能注册表"
            />
            <FeatureCard
              icon={Ticket}
              iconColor="text-rose-600 bg-rose-50"
              title="自研身份系统"
              desc="邀请制 + scrypt 密码 + TOTP MFA + JWT session. 私有化, 不依赖第三方."
              href="/admin/invite"
              cta="生成邀请码"
            />
            <FeatureCard
              icon={ShieldCheck}
              iconColor="text-slate-600 bg-slate-50"
              title="登录入口"
              desc="自研 Native Auth · 含 MFA 二阶段 · SSO 占位."
              href="/login"
              cta="登录页"
            />
          </div>
        </div>

        {/* 最近决议 + KR 健康度 + 价值主张 */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  最近决议
                </span>
                <Link
                  href="/decision-card"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  查看全部 →
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!stats || stats.recentDecisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  暂无决议. 去 /convergence 发起一个 →
                </p>
              ) : (
                <div className="space-y-2">
                  {stats.recentDecisions.map((d) => (
                    <RecentDecisionRow key={d.id} d={d} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                KR 健康度
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">on_track</span>
                  <span className="font-medium">
                    {stats?.okr.keyResultsOnTrack ?? 0} / {stats?.okr.keyResults ?? 0}
                  </span>
                </div>
                <Progress
                  value={
                    stats && stats.okr.keyResults > 0
                      ? (stats.okr.keyResultsOnTrack / stats.okr.keyResults) * 100
                      : 0
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Mini label="Objectives" value={stats?.okr.objectives ?? 0} />
                <Mini label="TTIs" value={stats?.okr.ttis ?? 0} />
                <Mini label="SOP" value={stats?.memories.byType.sop ?? 0} />
                <Mini label="案例" value={stats?.memories.byType.case ?? 0} />
              </div>
              <Link href="/okr">
                <Button variant="outline" size="sm" className="w-full">
                  OKR 看板 <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Demo flow + Docs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              端到端体验流程 (10 步)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2 text-sm md:grid-cols-2">
              <DemoStep n={1} href="/admin/invite" text="发邀请码 → 复制" />
              <DemoStep n={2} href="/register" text="带邀请码注册账号" />
              <DemoStep n={3} href="/login" text="登录 + (可选) 启用 MFA" />
              <DemoStep n={4} href="/convergence" text="发起议事 (LLM 流式 3+1)" />
              <DemoStep n={5} href="/decision-card" text="选定 + COMMIT 决议" />
              <DemoStep n={6} href="/persona/evolution" text="看 Persona 学习统计 +1" />
              <DemoStep n={7} href="/decision-card" text="24h 内行使否决 → VETOED" />
              <DemoStep n={8} href="/admin/steward" text="Steward 工作台看升级提议" />
              <DemoStep n={9} href="/admin/steward" text="按 level 签字 → Memory 入库" />
              <DemoStep n={10} href="/nine-box" text="9 宫格人才矩阵更新" />
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  href,
  accent,
}: {
  title: string;
  value: number | string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  accent: 'amber' | 'emerald' | 'violet' | 'sky';
}) {
  const accentMap = {
    amber: 'border-amber-200 bg-amber-50/50',
    emerald: 'border-emerald-200 bg-emerald-50/50',
    violet: 'border-violet-200 bg-violet-50/50',
    sky: 'border-sky-200 bg-sky-50/50',
  };
  return (
    <Link href={href}>
      <Card className={`cursor-pointer transition-all hover:shadow-md ${accentMap[accent]}`}>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{title}</span>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-3xl font-bold">{value}</div>
          {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

function FeatureCard({
  icon: Icon,
  iconColor,
  title,
  desc,
  href,
  cta,
  extra,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
  extra?: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-2 ${iconColor}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{desc}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-medium text-amber-700">
                  {cta} <ArrowRight className="inline h-3 w-3" />
                </span>
                {extra && (
                  <Badge variant="outline" className="text-[10px]">
                    {extra}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function RecentDecisionRow({
  d,
}: {
  d: DashboardStats['recentDecisions'][number];
}) {
  const stateMeta: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    COMMIT: { color: 'text-emerald-700 bg-emerald-50', icon: <CheckCircle2 className="h-3 w-3" />, label: '已决' },
    ESCALATED: { color: 'text-amber-700 bg-amber-50', icon: <AlertCircle className="h-3 w-3" />, label: '升级' },
    VETOED: { color: 'text-rose-700 bg-rose-50', icon: <XCircle className="h-3 w-3" />, label: '否决' },
    DELIBERATION: { color: 'text-sky-700 bg-sky-50', icon: <Clock className="h-3 w-3" />, label: '议中' },
  };
  const m = stateMeta[d.state] ?? { color: 'text-muted-foreground bg-muted', icon: null, label: d.state };
  const mins = Math.floor(d.elapsedSeconds / 60);
  const secs = d.elapsedSeconds % 60;
  return (
    <div className="flex items-center justify-between rounded border bg-white p-2.5 hover:bg-slate-50">
      <div className="flex-1">
        <p className="text-sm font-medium">{d.title}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {new Date(d.createdAt).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' · '}
          用时 {mins}:{secs.toString().padStart(2, '0')}
          {d.selected && ` · 选 ${d.selected}`}
        </p>
      </div>
      <span
        className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${m.color}`}
      >
        {m.icon}
        {m.label}
      </span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-white p-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function DemoStep({ n, href, text }: { n: number; href: string; text: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-2 rounded p-1.5 hover:bg-amber-50"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-800">
          {n}
        </span>
        <span className="flex-1">{text}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
      </Link>
    </li>
  );
}

'use client';

/**
 * /me/comp — 员工个人薪酬看板
 *
 * 展示: 三段薪资构成 + 当前层级 + 下一级缺口 + 推荐课程
 * 员工自助驱动: 看缺口 → 学课程 → 提交认证 → 升级 → 加薪
 */

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Wallet, TrendingUp, GraduationCap, ArrowRight, RefreshCw, Award, Shield, Sparkles, Heart, Unlock, Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

interface GradeView {
  status: 'ok' | 'notfound';
  employeeId: string;
  family?: { id: string; name: string; board: string };
  jobClass?: string;
  level?: string;
  taskGear?: string;
  breakdown?: { base: number; skill: number; task: number; monthly: number };
  certifiedSkillWage?: number;
  standardSkillWage?: number;
  nextLevel?: {
    level: string;
    standardSkillWage: number;
    gapSkills: Array<{ id: string; name: string; skillWage: number }>;
  } | null;
}

interface WhatIfResult {
  status: 'ok' | 'notfound';
  before?: { base: number; skill: number; task: number; monthly: number };
  after?: { base: number; skill: number; task: number; monthly: number };
  delta?: number;
  deltaBreakdown?: { base: number; skill: number; task: number };
}

interface SkillGapRecommendation {
  skillId: string;
  skillName: string;
  courses: Array<{ id: string; title: string; summary?: string }>;
}

export default function MyCompPage() {
  const [view, setView] = useState<GradeView | null>(null);
  const [recommendations, setRecommendations] = useState<SkillGapRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<{ hasPin: boolean } | null>(null);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [whatIf, setWhatIf] = useState<WhatIfResult | null>(null);
  const [simGear, setSimGear] = useState('');
  const [simLoading, setSimLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [gradeRes, gapRes] = await Promise.all([
        fetch('/api/comp/me/grade', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/comp/me/skill-gaps', { credentials: 'include', cache: 'no-store' }),
      ]);
      if (gradeRes.ok) {
        const g = await gradeRes.json();
        if (g.locked) {
          setLocked({ hasPin: !!g.hasPin });
          setView(null);
        } else {
          setView(g.view ?? g);
          setLocked(null);
        }
      }
      if (gapRes.ok) {
        const gap = await gapRes.json();
        setRecommendations(gap.recommendations ?? []);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitPin(action: 'unlock' | 'set') {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/comp/income', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'set' ? { action: 'set', pin, pin2 } : { action: 'unlock', pin }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setPin('');
      setPin2('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runWhatIf(gear?: string) {
    setSimLoading(true);
    setSimGear(gear ?? '');
    try {
      const r = await fetch('/api/comp/me/what-if', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gear ? { toGear: gear } : { certifyAll: true }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        if (j.locked) { setLocked({ hasPin: true }); return; }
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      const j = await r.json();
      setWhatIf(j.result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSimLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-caption py-20">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载…
      </div>
    );
  }

  if (locked) {
    return (
      <div className="container mx-auto max-w-4xl p-6 space-y-4">
        <header className="space-y-2">
          <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            我的薪酬
          </h1>
        </header>
        {error && <Card className="border-danger/30 bg-danger/5"><CardContent className="py-2 text-caption text-danger">{error}</CardContent></Card>}
        <Card className="border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-caption flex items-center gap-1.5">
              <Unlock className="h-4 w-4 text-warning" />
              收入二次密码
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              {locked.hasPin
                ? '收入数据受二次密码保护，请输入二次密码解锁 (有效 15 分钟)。'
                : '首次查看请设置收入二次密码 (6-12 位数字，独立于登录密码)。'}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                type="password"
                inputMode="numeric"
                placeholder={locked.hasPin ? '二次密码' : '设置二次密码 (6-12 位数字)'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && locked.hasPin) void submitPin('unlock'); }}
                className="h-8 w-40 text-[12px]"
              />
              {!locked.hasPin && (
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="确认二次密码"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value)}
                  className="h-8 w-40 text-[12px]"
                />
              )}
              <Button
                size="sm"
                className="h-8 text-[12px] gap-1"
                disabled={busy || !pin}
                onClick={() => submitPin(locked.hasPin ? 'unlock' : 'set')}
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlock className="h-3 w-3" />}
                {locked.hasPin ? '解锁查看' : '设置并解锁'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return <div className="container mx-auto max-w-4xl p-6"><Card className="border-danger/30 bg-danger/5"><CardContent className="py-2 text-danger">{error}</CardContent></Card></div>;
  }

  if (!view || view.status === 'notfound') {
    return (
      <div className="container mx-auto max-w-4xl p-6 space-y-4">
        <Card>
          <CardContent className="py-10 text-center">
            <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-caption text-muted-foreground">暂无薪酬定级记录，请联系 HR 为您定级。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bd = view.breakdown;

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-4 md:px-8">
      <header className="space-y-2">
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          我的薪酬
        </h1>
        <p className="text-caption text-muted-foreground">
          {view.family?.name ?? '—'} · {view.jobClass ?? '—'} · 层级 {view.level ?? '—'} · 任务档位 {view.taskGear ?? '—'}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          薪酬不是黑箱。你的三段薪资 (基本 + 技能 + 任务) 完全透明，
          <span className="text-ink-primary">缺口在哪、差多少、怎么补</span>——全部可见、可自助驱动。
        </p>
      </header>

      {/* 价值文化横幅: 创造价值 · 赢得尊重 · 快乐工作 */}
      <Card className="bg-gradient-to-r from-primary/5 via-success/5 to-info/5 border-border/30">
        <CardContent className="py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] font-medium text-primary">创造价值</span>
              </div>
              <span className="text-border text-[10px]">·</span>
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-success" />
                <span className="text-[11px] font-medium text-success">赢得尊重</span>
              </div>
              <span className="text-border text-[10px]">·</span>
              <div className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-info" />
                <span className="text-[11px] font-medium text-info">快乐工作</span>
              </div>
            </div>
            <Link href="/admin/comp/overview" className="text-[10px] text-muted-foreground hover:text-primary">
              了解薪酬体系 →
            </Link>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            奖金不是天生就有的，是你自己干出来的。你创造了多少可分享的价值，就分享多少——规则前置、人人可算、进退自主。
          </p>
        </CardContent>
      </Card>

      {/* 成长飞轮 */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {[
              { icon: GraduationCap, label: '学课程', href: '/learning' },
              { icon: Award, label: '提交认证', href: '/admin/comp/certifications' },
              { icon: Wallet, label: '技能加薪', href: '/me/comp' },
              { icon: TrendingUp, label: '升级晋升', href: '/admin/comp/grade-changes' },
              { icon: RefreshCw, label: '再学下一级', href: '/me/comp' },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-1.5 shrink-0">
                <Link href={step.href} className="flex flex-col items-center gap-1 group">
                  <div className="w-10 h-10 rounded-full bg-surface-1 border border-border/60 flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/5 transition-colors">
                    <step.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-[9px] font-medium text-ink-primary">{step.label}</span>
                </Link>
                {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-border shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 三段薪资构成 */}
      {bd && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-caption flex items-center justify-between">
              <span>月度薪资构成</span>
              <span className="text-[9px] text-muted-foreground font-normal">基本 + 技能(已认证) + 任务</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-title-2 font-semibold tabular-nums">{bd.base.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">基本工资</div>
              </div>
              <div className="text-center">
                <div className="text-title-2 font-semibold tabular-nums text-primary">{bd.skill.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">技能工资 (已认证)</div>
              </div>
              <div className="text-center">
                <div className="text-title-2 font-semibold tabular-nums">{bd.task.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">任务工资</div>
              </div>
              <div className="text-center">
                <div className="text-title-2 font-semibold tabular-nums text-success">{bd.monthly.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">月度合计</div>
              </div>
            </div>
            {view.standardSkillWage != null && view.certifiedSkillWage != null && view.standardSkillWage > view.certifiedSkillWage && (
              <div className="mt-3 text-[10px] text-info flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                当前层级标准技能工资 {view.standardSkillWage.toLocaleString()} 元 · 你已认证 {view.certifiedSkillWage.toLocaleString()} 元 · 缺口 {(view.standardSkillWage - view.certifiedSkillWage).toLocaleString()} 元
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 下一级缺口 + 推荐课程 */}
      {view.nextLevel && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-caption flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              升级到 {view.nextLevel.level} 的技能缺口
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {view.nextLevel.gapSkills.length === 0 ? (
              <p className="text-center text-muted-foreground text-caption py-6">无缺口技能，满足升级条件！</p>
            ) : (
              view.nextLevel.gapSkills.map((skill) => {
                const rec = recommendations.find((r) => r.skillId === skill.id);
                return (
                  <div key={skill.id} className="border border-border/40 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[12px] font-medium">{skill.name}</span>
                        <Badge variant="outline" className="ml-2 text-[9px] tabular-nums">+{skill.skillWage} 元</Badge>
                      </div>
                      <Link href="/learning" className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                        去学习 <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                    {rec && rec.courses.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {rec.courses.map((c) => (
                          <Link key={c.id} href={`/learning/lesson/${c.id}`}>
                            <Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-primary/5">{c.title}</Badge>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">暂无关联课程</span>
                    )}
                  </div>
                );
              })
            )}
            <div className="pt-2 border-t border-border/30">
              <div className="text-[10px] text-muted-foreground">
                升级后标准技能工资: <span className="font-medium text-success tabular-nums">{view.nextLevel.standardSkillWage.toLocaleString()}</span> 元
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* What-if 收入试算器 */}
      {bd && (
        <Card className="bg-info/5 border-info/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-caption flex items-center gap-2">
              <Calculator className="w-4 h-4 text-info" />
              What-if 收入试算
              <span className="text-[9px] text-muted-foreground font-normal">模拟换任务档/全认证后的月薪变化</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((g) => (
                <Button
                  key={g}
                  variant={simGear === g ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-[11px]"
                  disabled={simLoading}
                  onClick={() => void runWhatIf(g)}
                >
                  档位 {g}
                </Button>
              ))}
              <Button
                variant={simGear === 'certifyAll' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-[11px] gap-1"
                disabled={simLoading}
                onClick={() => void runWhatIf()}
              >
                <Award className="w-3 h-3" /> 全部认证
              </Button>
            </div>
            {simLoading && (
              <div className="flex items-center text-[11px] text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> 试算中…
              </div>
            )}
            {whatIf && whatIf.status === 'ok' && whatIf.delta != null && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground">当前月薪</div>
                    <div className="text-title-3 font-semibold tabular-nums">{whatIf.before?.monthly.toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground">模拟月薪</div>
                    <div className="text-title-3 font-semibold tabular-nums text-primary">{whatIf.after?.monthly.toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground">变化</div>
                    <div className={`text-title-3 font-semibold tabular-nums ${whatIf.delta >= 0 ? 'text-success' : 'text-danger'}`}>
                      {whatIf.delta >= 0 ? '+' : ''}{whatIf.delta.toLocaleString()}
                    </div>
                  </div>
                </div>
                {whatIf.deltaBreakdown && (whatIf.deltaBreakdown.skill !== 0 || whatIf.deltaBreakdown.task !== 0) && (
                  <div className="text-[10px] text-muted-foreground flex items-center gap-3 justify-center">
                    {whatIf.deltaBreakdown.skill !== 0 && (
                      <span>技能: <span className={whatIf.deltaBreakdown.skill >= 0 ? 'text-success' : 'text-danger'}>{whatIf.deltaBreakdown.skill >= 0 ? '+' : ''}{whatIf.deltaBreakdown.skill.toLocaleString()}</span></span>
                    )}
                    {whatIf.deltaBreakdown.task !== 0 && (
                      <span>任务: <span className={whatIf.deltaBreakdown.task >= 0 ? 'text-success' : 'text-danger'}>{whatIf.deltaBreakdown.task >= 0 ? '+' : ''}{whatIf.deltaBreakdown.task.toLocaleString()}</span></span>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground text-center">
                  P4 员工是收入第一责任人 · 规则前置、人人可算、进退自主
                </p>
              </div>
            )}
            {whatIf && whatIf.status === 'notfound' && (
              <p className="text-[11px] text-muted-foreground text-center">暂无定级数据，无法试算</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 制度保障说明 */}
      <Card className="bg-surface-1/30 border-border/30">
        <CardContent className="py-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-ink-primary">
            <Shield className="w-3 h-3 text-danger" />
            制度保障
          </div>
          <div className="text-[10px] text-muted-foreground leading-relaxed">
            绩效系数封顶 1.3 (超额有界) · 安全一票否决 (绩效归零) · KPI 达成率自动派生系数 · 他评去极值 (4人去掉最高最低) · 降职分布偏差自动告警
          </div>
        </CardContent>
      </Card>

      {/* 快捷入口 */}
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/comp/certifications">
          <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1"><Award className="w-3 h-3" /> 提交技能认证</Button>
        </Link>
        <Link href="/admin/comp/commitments">
          <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1"><TrendingUp className="w-3 h-3" /> 任务承诺申请</Button>
        </Link>
        <Link href="/admin/comp/peer-assignments">
          <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1">他评管理</Button>
        </Link>
        <Link href="/admin/comp/overview">
          <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1">了解薪酬体系</Button>
        </Link>
      </div>
    </div>
  );
}

'use client';

/**
 * /admin/comp/overview — 薪酬绩效模块总览 (价值文化宣言)
 *
 * 落地两层文化:
 *   MANIFESTO §44-63: 四个满意 (客户/员工/股东/社会) + 三大理念 (创造价值·赢得尊重·快乐工作)
 *   PRD §1: 反禀赋四原则 (P1守底线/P2公允线之上分享/P3分享真实增量/P4员工是收入第一责任人)
 *   PRD §3: 四族人格 (LIP/AIP/MIP/SIP) × 增值分享
 *   PRD §5: 双轨轮动 (A轨能力认证 + B轨任务档位)
 *   PRD §6: PIP合规链 (稳定→观察→PIP→降职, 给改进机会)
 *   PRD §10: 风险护栏 (SDT/挤出/心理契约/前景理论/Goodhart/组织公正)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, Shield, Scale, RefreshCw, GraduationCap, Award, ArrowRight, Lock, AlertTriangle, Heart, Users, Building2, Globe, Sparkles, Target, Eye } from 'lucide-react';
import Link from 'next/link';

// --- 四个满意 (MANIFESTO §44) ---
const FOUR_SATISFACTIONS = [
  { icon: Building2, label: '客户满意', desc: '数据安全 · ROI 透明 · 长期陪伴', color: 'text-info', bg: 'bg-info/5', border: 'border-info/20' },
  { icon: Heart, label: '员工满意', desc: '反卷设计 · 心流保护 · 成长可见', color: 'text-danger', bg: 'bg-danger/5', border: 'border-danger/20' },
  { icon: TrendingUp, label: '股东满意', desc: '健康增长 · 健康现金流 · 长期主义', color: 'text-success', bg: 'bg-success/5', border: 'border-success/20' },
  { icon: Globe, label: '社会满意', desc: '合规 · 不做替代型 AI · 推动职场进步', color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/20' },
];

// --- 三大理念 (MANIFESTO §57-59) ---
const THREE_IDEALS = [
  { icon: Sparkles, label: '创造价值', en: 'Create Value', desc: '为客户、员工、股东、社会都创造可见价值', color: 'text-primary' },
  { icon: Award, label: '赢得尊重', en: 'Earn Respect', desc: '不靠营销话术, 靠产品本身赢得每一类受众的尊重', color: 'text-success' },
  { icon: Heart, label: '快乐工作', en: 'Work Happily', desc: '让用户、员工、自己都能在工作中感到快乐', color: 'text-info' },
];

// --- 反禀赋四原则 (PRD §1) ---
const ANTI_ENTITLEMENT = [
  { id: 'P1', label: '守底线才有资格', desc: '未达预算线 → 硬截断, 只发基本工资, 不进入绩效与奖金。股东、员工同守底线。', icon: Shield, color: 'text-danger' },
  { id: 'P2', label: '公允线之上才有分享', desc: '地板保障(线下) + 分享创造(线上)。公允线由 FP&A/BSC 模拟"好的公允关系"。', icon: Scale, color: 'text-info' },
  { id: 'P3', label: '分享的是真实兑现的增量', desc: '利润超预算、开票回款、效率改进、质量损失下降——绝不分享未兑现的空头。', icon: Target, color: 'text-success' },
  { id: 'P4', label: '员工是收入的第一责任人', desc: '规则前置、人人可算、进退自主。双轨轮动 + What-if 模拟器把方向盘交给员工。', icon: Wallet, color: 'text-primary' },
];

// --- 四族增值分享 (PRD §3) ---
const FOUR_TRIBES = [
  { code: 'LIP', name: '蓝领/一线', floor: '基本工资(主)', share: '系数上浮(小)', value: '效率改进 / 质量损失下降', color: 'bg-warning/5 text-warning border-warning/20' },
  { code: 'AIP', name: '专才/成长者', floor: '固定含任务工资(厚)', share: '季度激励 + S1池(中)', value: '专业交付 / 战略专业支撑', color: 'bg-info/5 text-info border-info/20' },
  { code: 'MIP', name: '经营者/责任人', floor: '基本工资(薄)', share: '增值池份数×分值(大)', value: 'BU 实际利润超预算', color: 'bg-success/5 text-success border-success/20' },
  { code: 'SIP', name: '猎手/创收者', floor: '固薪三段(中)', share: '提成(上不封顶)', value: '越目标线的开票回款', color: 'bg-primary/5 text-primary border-primary/20' },
];

const FLYWHEEL_STEPS = [
  { icon: GraduationCap, label: '学课程', desc: '学院推荐', href: '/learning' },
  { icon: Award, label: '提交认证', desc: '案例佐证', href: '/admin/comp/certifications' },
  { icon: Wallet, label: '技能加薪', desc: '认证计入', href: '/me/comp' },
  { icon: TrendingUp, label: '升级晋升', desc: '职级签批', href: '/admin/comp/grade-changes' },
  { icon: RefreshCw, label: '再学下一级', desc: '新缺口出现', href: '/me/comp' },
];

const GATES = [
  { label: '系数封顶 1.3', desc: '超额奖金有上界, 防薪酬失控', icon: Lock },
  { label: '安全一票否决', desc: '安全事故 → 绩效归零, 不可绕过', icon: AlertTriangle },
  { label: 'P1 硬截断 (<预算线)', desc: '未达预算线 → 只发基本工资, 不进奖金', icon: Shield },
  { label: '降职分布审计', desc: '某部门降职 >40% 自动标记偏差', icon: Scale },
];

// --- PIP 合规链 (PRD §6.2) ---
const PIP_CHAIN = [
  { state: '稳定', trigger: '', action: '', color: 'bg-success/5 text-success border-success/20' },
  { state: '观察预警', trigger: '连续1季 <目标', action: '知悉确认', color: 'bg-warning/5 text-warning border-warning/20' },
  { state: 'PIP触发', trigger: '连续2季 <目标', action: '书面确认=PIP告知', color: 'bg-warning/10 text-warning border-warning/30' },
  { state: '改进期', trigger: '第3季', action: '给机会改进', color: 'bg-info/5 text-info border-info/20' },
  { state: '降职生效', trigger: '仍<目标', action: '书面确认=降职签署', color: 'bg-danger/5 text-danger border-danger/20' },
];

const TRACKS = [
  {
    title: 'A 轨 · 技能认证',
    color: 'text-primary',
    bg: 'bg-primary/5',
    desc: '技能矩阵定价 → 员工提交认证 → HR 审批 → 认证计入技能工资',
    items: ['技能矩阵定价', '员工认证提交', 'HR 审批台', '矩阵版本发布'],
    links: ['/admin/comp', '/me/comp', '/admin/comp/certifications', '/admin/comp/matrix-versions'],
  },
  {
    title: 'B 轨 · 任务档位',
    color: 'text-success',
    bg: 'bg-success/5',
    desc: '员工承接任务档位 A-G → 审批通过 → 任务工资即时调整',
    items: ['任务承诺申请', '审批/驳回', '档位生效'],
    links: ['/admin/comp/commitments', '/admin/comp/commitments', '/admin/comp/commitments'],
  },
];

export default function CompOverviewPage() {
  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-6 md:px-8">
      {/* 标题 */}
      <header className="space-y-2">
        <h1 className="text-title-1 font-semibold tracking-tight">
          薪酬绩效 · 价值文化
        </h1>
        <p className="text-body text-muted-foreground">
          基于<span className="text-ink-primary font-medium">价值模型</span>的增值分享体系——
          奖金不是天生就有的，是员工自己干出来的。
        </p>
      </header>

      {/* 四个满意 */}
      <section className="space-y-2">
        <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          四个满意 · 企业价值观底座
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FOUR_SATISFACTIONS.map((s) => (
            <Card key={s.label} className={`${s.bg} ${s.border} border`}>
              <CardContent className="pt-4 pb-4 text-center">
                <s.icon className={`w-6 h-6 ${s.color} mx-auto mb-2`} />
                <div className={`text-[12px] font-semibold ${s.color}`}>{s.label}</div>
                <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{s.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 三大理念 */}
      <section className="space-y-2">
        <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          三大理念 · 创造价值 · 赢得尊重 · 快乐工作
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {THREE_IDEALS.map((ideal) => (
            <Card key={ideal.label} className="border-border/40">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start gap-3">
                  <ideal.icon className={`w-6 h-6 ${ideal.color} shrink-0`} />
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-caption font-semibold ${ideal.color}`}>{ideal.label}</span>
                      <span className="text-[9px] text-muted-foreground font-mono">{ideal.en}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{ideal.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 反禀赋四原则 */}
      <section className="space-y-2">
        <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-1.5">
          <Shield className="w-4 h-4" />
          反禀赋四原则 · 奖金是自己干出来的
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ANTI_ENTITLEMENT.map((p) => (
            <Card key={p.id} className="border-border/40">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-surface-1 flex items-center justify-center">
                    <p.icon className={`w-4 h-4 ${p.color}`} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] tabular-nums">{p.id}</Badge>
                      <span className="text-[12px] font-medium text-ink-primary">{p.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground italic px-1">
          叙事红线: 系统话术永远是&quot;你创造了多少可分享的价值&quot;, 而非&quot;你被扣了多少&quot;。未达线 = 没有共同做出可分享的增量, 不是惩罚。
        </p>
      </section>

      {/* 四族增值分享 */}
      <section className="space-y-2">
        <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-1.5">
          <Wallet className="w-4 h-4" />
          四族增值分享 · 地板保障 + 线上创造
        </h2>
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border/30">
                    <th className="pb-2 pr-3 font-normal">族</th>
                    <th className="pb-2 pr-3 font-normal">定位</th>
                    <th className="pb-2 pr-3 font-normal">地板(线下保障)</th>
                    <th className="pb-2 pr-3 font-normal">分享乐器(线上创造)</th>
                    <th className="pb-2 font-normal">越线创造的价值</th>
                  </tr>
                </thead>
                <tbody>
                  {FOUR_TRIBES.map((t) => (
                    <tr key={t.code} className="border-b border-border/20 last:border-0">
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className={`text-[9px] ${t.color}`}>{t.code}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-ink-primary">{t.name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{t.floor}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{t.share}</td>
                      <td className="py-2 text-muted-foreground">{t.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              公允线 = 预算/目标规划线。线下 = 基本保障, 线上 = 增值分享。四族各有不同的地板厚度与分享乐器, 但共享同一个精神: 分享的是真实兑现的增量。
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 成长飞轮 */}
      <section className="space-y-2">
        <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-1.5">
          <RefreshCw className="w-4 h-4 text-primary" />
          成长飞轮 · 员工自助驱动薪酬增长
        </h2>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between gap-2 overflow-x-auto py-4">
            {FLYWHEEL_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2 shrink-0">
                <Link href={step.href} className="flex flex-col items-center gap-1.5 group">
                  <div className="w-14 h-14 rounded-full bg-surface-1 border border-border/60 flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/5 transition-colors">
                    <step.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-[10px] font-medium text-ink-primary">{step.label}</span>
                  <span className="text-[9px] text-muted-foreground">{step.desc}</span>
                </Link>
                {i < FLYWHEEL_STEPS.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-border shrink-0" />
                )}
              </div>
            ))}
            <ArrowRight className="w-4 h-4 text-border shrink-0 rotate-90" />
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            飞轮每转一圈 = 一次完整的&quot;学习→认证→加薪&quot;循环 · 员工随时可查看 <Link href="/me/comp" className="text-primary hover:underline">我的薪酬</Link> 看下一步
          </p>
        </CardContent>
      </Card>

      </section>

      {/* 双轨轮动 */}
      <section className="space-y-2">
        <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" />
          双轨轮动 · 员工自己把握收入
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TRACKS.map((track) => (
          <Card key={track.title} className={`${track.bg} border-border/30`}>
            <CardHeader className="pb-2">
              <CardTitle className={`text-caption ${track.color}`}>{track.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-[11px] text-muted-foreground">{track.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {track.items.map((item, i) => (
                  <Link key={i} href={track.links[i]}>
                    <Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-surface-1">{item}</Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      </section>

      {/* PIP 合规链 */}
      <section className="space-y-2">
        <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-warning" />
          PIP 合规链 · 降职不是惩罚, 是绩效闭环的自然结果
        </h2>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-1 overflow-x-auto py-2">
              {PIP_CHAIN.map((step, i) => (
                <div key={step.state} className="flex items-center gap-1 shrink-0">
                  <div className="flex flex-col items-center gap-1 min-w-[80px]">
                    <Badge variant="outline" className={`text-[10px] ${step.color}`}>{step.state}</Badge>
                    {step.trigger && <span className="text-[9px] text-muted-foreground text-center">{step.trigger}</span>}
                    {step.action && <span className="text-[9px] text-ink-primary text-center">{step.action}</span>}
                  </div>
                  {i < PIP_CHAIN.length - 1 && <ArrowRight className="w-3 h-3 text-border shrink-0" />}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border/30">
              合规红线: 连续两季低于目标只触发 PIP 告知 + 书面确认, 不直接降薪; 必须再给一个改进期。此链对齐《劳动合同法》第40条&quot;不能胜任→培训/调岗→仍不能胜任→才可调整&quot;。
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 制度闸门 */}
      <section className="space-y-2">
        <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-danger" />
          制度闸门 · 硬编码不可绕过
        </h2>
      <Card className="border-danger/20">
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {GATES.map((g) => (
              <div key={g.label} className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-1/50">
                <g.icon className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-medium text-ink-primary">{g.label}</div>
                  <div className="text-[10px] text-muted-foreground">{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border/30">
            这些闸门不是配置项——它们是代码级硬约束, 确保薪酬增长有界、风险可控、公平可审。
          </p>
        </CardContent>
      </Card>

      </section>

      {/* 风险护栏 (PRD §10 理论加固) */}
      <section className="space-y-2">
        <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-1.5">
          <Eye className="w-4 h-4" />
          风险护栏 · 管理学理论加固
        </h2>
        <Card className="border-border/30">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {[
                { theory: 'SDT 关系性', risk: '过度个体化侵蚀协作', guard: '他评维度 40% + 团队协作分' },
                { theory: '挤出效应 (Deci)', risk: '外在激励挤出内在动机', guard: '学习预算/课题自主/导师身份 (第二锚)' },
                { theory: '心理契约 (Rousseau)', risk: '职级重挣瓦解关系契约', guard: '分期灰度 + 老人过渡 (grandfathering)' },
                { theory: '前景理论 (KT)', risk: '降薪痛感≈2倍', guard: '有尊严的滑道 + 明确重挣路径' },
                { theory: 'Goodhart', risk: '指标决定薪资→被操纵', guard: '量化+定性双复核, AI 只聚合证据' },
                { theory: '组织公正', risk: '降职分布系统性偏差', guard: '降职分布公平性审计 (合规+ESG)' },
              ].map((r) => (
                <div key={r.theory} className="flex items-start gap-2 text-[10px]">
                  <span className="font-medium text-ink-primary shrink-0 w-28">{r.theory}</span>
                  <span className="text-muted-foreground">{r.risk}</span>
                  <ArrowRight className="w-3 h-3 text-border shrink-0 mt-0.5" />
                  <span className="text-success">{r.guard}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 快捷入口 */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Link href="/me/comp"><Badge variant="outline" className="cursor-pointer hover:bg-primary/5 text-[10px]">我的薪酬</Badge></Link>
        <Link href="/admin/comp"><Badge variant="outline" className="cursor-pointer hover:bg-primary/5 text-[10px]">定价治理台</Badge></Link>
        <Link href="/admin/comp/settlements"><Badge variant="outline" className="cursor-pointer hover:bg-primary/5 text-[10px]">月度结算</Badge></Link>
        <Link href="/admin/comp/certifications"><Badge variant="outline" className="cursor-pointer hover:bg-primary/5 text-[10px]">认证审批</Badge></Link>
        <Link href="/admin/comp/demotion-audit"><Badge variant="outline" className="cursor-pointer hover:bg-primary/5 text-[10px]">降职审计</Badge></Link>
        <Link href="/admin/comp/lip-assessment"><Badge variant="outline" className="cursor-pointer hover:bg-primary/5 text-[10px]">LIP考核</Badge></Link>
      </div>
    </div>
  );
}

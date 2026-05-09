'use client';

/**
 * Steward 工作台 · 知识治理官的"决议入库"操作台
 *
 * 对应宪章 §8.1 (三级签批) + §8.2 (降级流程)
 *
 * 三个 tab:
 *   1. Promotions: Material → Memory 升级 (Lv1 团队 / Lv2 部门 / Lv3 公司)
 *   2. Downgrades: Memory → Material/归档 评估
 *   3. SLA Watch: 即将逾期 / 已逾期需要 escalate
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';

// ---------- Types (match API response shape) ----------

interface Signer {
  userId: string;
  role: string;
  signedAt: string;
  comment?: string;
}

interface PromotionRequest {
  id: string;
  materialId: string;
  proposedType: string;
  proposedTitle: string;
  proposedBody: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  level?: 'team' | 'dept' | 'company';
  signers: {
    teamLeader?: Signer;
    deptLeader?: Signer;
    krOwner?: Signer;
    ceo?: Signer;
    clevel?: Signer;
    steward?: Signer;
    history?: Signer[];
  };
  slaDeadline?: string;
  publicReviewUntil?: string;
  createdBy: string;
  createdAt: string;
  isEmergencyTrack?: boolean;
  escalationHistory?: Array<{ fromLevel: string; toLevel: string; at: string; reason: string }>;
}

interface DowngradeRequest {
  id: string;
  memoryId: string;
  proposedBy: string;
  reason: string;
  metrics: { referenceCount: number; averageReferenceCount?: number };
  status: 'proposed' | 'under_review' | 'kept' | 'revising' | 'archived' | 'historical_only';
  decision?: { by: string; decidedAt: string; note?: string };
  createdAt: string;
}

// ---------- Constants ----------

const LEVEL_LABEL: Record<string, { label: string; color: string }> = {
  team: { label: 'Lv1 团队', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  dept: { label: 'Lv2 部门', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  company: { label: 'Lv3 公司', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const LEVEL_REQUIRED_ROLES: Record<string, string[]> = {
  team: ['team_leader', 'steward'],
  dept: ['dept_leader', 'steward', 'kr_owner'],
  company: ['ceo', 'clevel', 'steward'],
};

const ROLE_LABEL: Record<string, string> = {
  team_leader: '团队 Leader',
  dept_leader: '部门 Leader',
  kr_owner: 'KR 关联人',
  ceo: 'CEO',
  clevel: 'C-level',
  steward: 'Steward',
  business_leader: 'BusinessLeader (V1)',
};

// ---------- Page ----------

export default function StewardWorkbenchPage() {
  const [tab, setTab] = useState<'promotions' | 'downgrades' | 'sla'>('promotions');
  const [signerId, setSignerId] = useState('u_steward');

  return (
    <div className="container mx-auto max-w-6xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-violet-600" />
            Steward 工作台 · 知识治理官
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            宪章 §8.1 三级签批门 (Lv1/Lv2/Lv3) + §8.2 降级评估 — 守门人, 不是橡皮章
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">当前签字身份:</span>
            <Input
              value={signerId}
              onChange={(e) => setSignerId(e.target.value)}
              className="h-8 w-48 font-mono text-xs"
              placeholder="signerId (e.g. u_steward)"
            />
            <span className="ml-auto text-xs text-muted-foreground">
              真实环境: 从登录态自动注入, 此处供演示
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="promotions">
            升级请求 (Material → Memory)
          </TabsTrigger>
          <TabsTrigger value="downgrades">
            降级评估 (Memory → 归档)
          </TabsTrigger>
          <TabsTrigger value="sla">
            SLA 监控
          </TabsTrigger>
        </TabsList>

        <TabsContent value="promotions">
          <PromotionsPanel signerId={signerId} />
        </TabsContent>
        <TabsContent value="downgrades">
          <DowngradesPanel signerId={signerId} />
        </TabsContent>
        <TabsContent value="sla">
          <SlaPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Promotions panel ----------

function PromotionsPanel({ signerId }: { signerId: string }) {
  const [items, setItems] = useState<PromotionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const url =
        filter === 'all'
          ? '/api/tandem/memory/promotion'
          : `/api/tandem/memory/promotion?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(data.promotions ?? []);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load();
  }, [filter]);

  async function sign(p: PromotionRequest, role: string) {
    setActionMsg(null);
    const res = await fetch('/api/tandem/memory/promotion', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ promotionId: p.id, action: 'sign', signerId, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionMsg(`签字失败: ${data.error ?? res.statusText}`);
      return;
    }
    setActionMsg(`已签字 ${ROLE_LABEL[role] ?? role}, 状态 = ${data.promotion.status}`);
    void load();
  }

  async function reject(p: PromotionRequest) {
    const reason = window.prompt('请填写拒绝理由:');
    if (!reason) return;
    setActionMsg(null);
    const res = await fetch('/api/tandem/memory/promotion', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ promotionId: p.id, action: 'reject', signerId, reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      setActionMsg(`拒绝失败: ${data.error ?? res.statusText}`);
      return;
    }
    setActionMsg('已拒绝');
    void load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pt-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? 'default' : 'outline'}
            onClick={() => setFilter(s)}
          >
            {s === 'all' ? '全部' : s === 'pending' ? '待签' : s === 'approved' ? '已通过' : '已拒'}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => void load()} className="ml-auto">
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> 刷新
        </Button>
      </div>

      {actionMsg && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-2 text-xs text-amber-900">{actionMsg}</CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">加载中…</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            暂无 {filter === 'all' ? '' : filter} 升级请求
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <PromotionCard
              key={p.id}
              p={p}
              onSign={(role) => void sign(p, role)}
              onReject={() => void reject(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PromotionCard({
  p,
  onSign,
  onReject,
}: {
  p: PromotionRequest;
  onSign: (role: string) => void;
  onReject: () => void;
}) {
  const level = (p.level ?? 'company') as keyof typeof LEVEL_LABEL;
  const required = LEVEL_REQUIRED_ROLES[level];
  const slaInfo = computeSlaStatus(p.slaDeadline);
  const isPending = p.status === 'pending';

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={LEVEL_LABEL[level].color}>
                {LEVEL_LABEL[level].label}
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase">
                {p.proposedType}
              </Badge>
              {p.isEmergencyTrack && (
                <Badge variant="destructive" className="text-[10px]">
                  紧急通道 24h
                </Badge>
              )}
              <Badge
                variant="outline"
                className={
                  p.status === 'approved'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : p.status === 'rejected'
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-slate-200 text-slate-600'
                }
              >
                {p.status}
              </Badge>
              {(p.escalationHistory?.length ?? 0) > 0 && (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                  已 escalate {p.escalationHistory!.length} 次
                </Badge>
              )}
            </div>
            <div className="font-medium">{p.proposedTitle}</div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.proposedBody}</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right text-[11px] text-muted-foreground">
            <span>提议: {p.createdBy}</span>
            <span>{new Date(p.createdAt).toLocaleString()}</span>
            {slaInfo && (
              <span
                className={
                  slaInfo.overdue
                    ? 'flex items-center gap-1 font-medium text-rose-600'
                    : 'flex items-center gap-1 text-amber-600'
                }
              >
                <Clock className="h-3 w-3" />
                {slaInfo.overdue ? `已逾期 ${slaInfo.label}` : `剩 ${slaInfo.label}`}
              </span>
            )}
          </div>
        </div>

        {/* 签字进度 */}
        <div className="mt-3 grid gap-2 rounded-md border bg-slate-50/50 p-2 sm:grid-cols-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:col-span-2">
            签字进度 · {LEVEL_LABEL[level].label} 需要 {required.length} 人
          </div>
          {required.map((r) => {
            const signed = isRoleSigned(p.signers, r);
            return (
              <div
                key={r}
                className="flex items-center gap-2 rounded-sm border bg-white px-2 py-1 text-xs"
              >
                {signed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-slate-300" />
                )}
                <span className="font-medium">{ROLE_LABEL[r] ?? r}</span>
                {signed && (
                  <span className="ml-auto truncate text-[10px] text-muted-foreground">
                    {signed.userId} · {new Date(signed.signedAt).toLocaleDateString()}
                  </span>
                )}
                {!signed && isPending && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-6 px-2 text-[10px]"
                    onClick={() => onSign(r)}
                  >
                    我签
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* 公示期 / 操作 */}
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            公示截止:{' '}
            {p.publicReviewUntil
              ? new Date(p.publicReviewUntil).toLocaleString()
              : '—'}
          </span>
          {isPending && (
            <Button size="sm" variant="ghost" onClick={onReject} className="h-7 text-rose-600">
              拒绝
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function isRoleSigned(signers: PromotionRequest['signers'], role: string): Signer | null {
  switch (role) {
    case 'team_leader':
      return signers.teamLeader ?? null;
    case 'dept_leader':
      return signers.deptLeader ?? null;
    case 'kr_owner':
      return signers.krOwner ?? null;
    case 'ceo':
      return signers.ceo ?? null;
    case 'clevel':
      return signers.clevel ?? null;
    case 'steward':
      return signers.steward ?? null;
    default:
      return null;
  }
}

function computeSlaStatus(deadline?: string): { overdue: boolean; label: string } | null {
  if (!deadline) return null;
  const diffMs = new Date(deadline).getTime() - Date.now();
  const overdue = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const days = Math.floor(absMs / 86400_000);
  const hrs = Math.floor((absMs % 86400_000) / 3600_000);
  const label = days > 0 ? `${days}天${hrs}h` : `${hrs}h`;
  return { overdue, label };
}

// ---------- Downgrades panel ----------

function DowngradesPanel({ signerId }: { signerId: string }) {
  const [items, setItems] = useState<DowngradeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'proposed' | 'all'>('proposed');
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const url =
        filter === 'all'
          ? '/api/tandem/memory/downgrade'
          : `/api/tandem/memory/downgrade?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(data.downgrades ?? []);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    void load();
  }, [filter]);

  async function decide(d: DowngradeRequest, decision: string) {
    setMsg(null);
    const note = window.prompt(`决议: ${decision}\n请填写说明 (可选):`) ?? undefined;
    const res = await fetch('/api/tandem/memory/downgrade', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        downgradeId: d.id,
        stewardId: signerId,
        decision,
        note,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(`失败: ${data.error}`);
      return;
    }
    setMsg(`已决议 ${decision}`);
    void load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pt-2">
        {(['proposed', 'all'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? 'default' : 'outline'}
            onClick={() => setFilter(s)}
          >
            {s === 'all' ? '全部' : '待评估'}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => void load()} className="ml-auto">
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> 刷新
        </Button>
      </div>

      {msg && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-2 text-xs">{msg}</CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">加载中…</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            暂无降级评估请求 (cron 每 10min 自动扫描引用率低于均值 30% 的 Memory)
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-4">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-rose-500" />
                  <span className="font-medium">Memory: {d.memoryId}</span>
                  <Badge variant="outline" className="text-[10px]">
                    触发: {d.proposedBy === 'ai' ? 'AI 扫描' : d.proposedBy}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      d.status === 'proposed' || d.status === 'under_review'
                        ? 'border-amber-300 bg-amber-50 text-amber-700'
                        : 'border-slate-200'
                    }
                  >
                    {d.status}
                  </Badge>
                </div>
                <p className="text-sm">{d.reason}</p>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  引用次数: {d.metrics.referenceCount}
                  {d.metrics.averageReferenceCount !== undefined &&
                    ` · 均值 ${d.metrics.averageReferenceCount.toFixed(1)}`}
                  {' · '}
                  创建: {new Date(d.createdAt).toLocaleString()}
                </div>

                {(d.status === 'proposed' || d.status === 'under_review') && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void decide(d, 'kept')}>
                      保留 (kept)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void decide(d, 'revising')}>
                      修订 (revising)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void decide(d, 'archived')}>
                      归档 (archived)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void decide(d, 'historical_only')}
                    >
                      仅历史 (historical_only)
                    </Button>
                  </div>
                )}
                {d.decision && (
                  <div className="mt-2 rounded-sm border bg-emerald-50/50 p-2 text-[11px]">
                    决议: {d.status} · 由 {d.decision.by} 于{' '}
                    {new Date(d.decision.decidedAt).toLocaleString()}
                    {d.decision.note && ` · ${d.decision.note}`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- SLA Watch panel ----------

function SlaPanel() {
  const [items, setItems] = useState<PromotionRequest[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/tandem/memory/promotion?status=pending');
      const data = await res.json();
      setItems(data.promotions ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const now = Date.now();
  const overdue = items.filter(
    (p) => p.slaDeadline && new Date(p.slaDeadline).getTime() < now
  );
  const dueSoon = items.filter((p) => {
    if (!p.slaDeadline) return false;
    const t = new Date(p.slaDeadline).getTime();
    return t >= now && t - now < 24 * 3600_000;
  });

  return (
    <div className="space-y-3 pt-2">
      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-3">
          <Stat label="待签总数" value={items.length} />
          <Stat label="24h 内到期" value={dueSoon.length} accent="amber" />
          <Stat label="已逾期 (待 cron escalate)" value={overdue.length} accent="rose" />
        </CardContent>
      </Card>

      {overdue.length > 0 && (
        <Card className="border-rose-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              已逾期 (cron 下一轮 10min 内自动 escalate +1 级)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdue.map((p) => {
              const lvl = (p.level ?? 'company') as keyof typeof LEVEL_LABEL;
              const sla = computeSlaStatus(p.slaDeadline);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded border bg-rose-50/30 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{p.proposedTitle}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{p.id}</span>
                  </div>
                  <Badge variant="outline" className={LEVEL_LABEL[lvl].color}>
                    {LEVEL_LABEL[lvl].label}
                  </Badge>
                  {sla && (
                    <span className="ml-2 text-xs font-medium text-rose-600">
                      逾期 {sla.label}
                    </span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {dueSoon.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-amber-600" />
              24h 内到期
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dueSoon.map((p) => {
              const lvl = (p.level ?? 'company') as keyof typeof LEVEL_LABEL;
              const sla = computeSlaStatus(p.slaDeadline);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded border bg-amber-50/30 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{p.proposedTitle}</span>
                  <Badge variant="outline" className={LEVEL_LABEL[lvl].color}>
                    {LEVEL_LABEL[lvl].label}
                  </Badge>
                  {sla && <span className="ml-2 text-xs text-amber-700">剩 {sla.label}</span>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            当前没有待签升级请求
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'amber' | 'rose';
}) {
  const cls =
    accent === 'rose'
      ? 'text-rose-600'
      : accent === 'amber'
      ? 'text-amber-600'
      : 'text-foreground';
  return (
    <div className="rounded border bg-white p-3 text-center">
      <div className={`text-2xl font-semibold ${cls}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

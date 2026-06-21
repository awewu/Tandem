'use client';

/**
 * /360 — 360 度评估 (OKR P1 · 2026-05-10)
 *
 * 3 个 tab:
 *   1. 周期 — 列出/创建评估周期, 选评估关系
 *   2. 待我评 — 我作为 rater 要给谁评
 *   3. 收到的反馈 — 我作为 subject 看到的聚合报告 (匿名 peer)
 *
 * 默认 8 维度 (业绩/协作/创新/责任/沟通/学习/领导力/价值观)
 * peer 默认匿名, manager/report 实名
 */

import { useMemo, useState } from 'react';
import {
  useReview360Store, useOKRStore, DEFAULT_360_QUESTIONS,
  type Review360CycleDef, type Review360RaterType, type Review360Question,
  type Review360Submission,
} from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Users, Star, MessageSquare, Plus, CheckCircle2, AlertCircle,
  Lock, Eye, ChevronRight, Send, X,
} from 'lucide-react';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';

const RATER_LABEL: Record<Review360RaterType, string> = {
  self: '自评',
  manager: '上级',
  peer: '平级',
  report: '下级',
  cross: '跨部门',
};

const RATER_COLOR: Record<Review360RaterType, string> = {
  self: 'bg-violet-100 text-violet-700',
  manager: 'bg-info/10 text-info',
  peer: 'bg-emerald-100 text-emerald-700',
  report: 'bg-warning/10 text-warning',
  cross: 'bg-slate-100 text-slate-700',
};

export default function Review360Page() {
  const [tab, setTab] = useState<'cycles' | 'todo' | 'received'>('todo');

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="mb-5">
          <h1 className="text-title-3 font-semibold flex items-center gap-2">
            <Star className="h-6 w-6 text-warning" />
            360 度评估
          </h1>
          <p className="text-footnote text-muted-foreground mt-1">
            多源反馈 · 8 维度 · peer 匿名 · 季度/年度发起
          </p>
        </div>

        <div className="flex gap-1 border-b mb-4">
          <TabBtn active={tab === 'todo'} onClick={() => setTab('todo')} icon={Send}>
            待我评
          </TabBtn>
          <TabBtn active={tab === 'received'} onClick={() => setTab('received')} icon={Eye}>
            收到反馈
          </TabBtn>
          <TabBtn active={tab === 'cycles'} onClick={() => setTab('cycles')} icon={Users}>
            周期管理
          </TabBtn>
        </div>

        {tab === 'todo' && <TodoTab />}
        {tab === 'received' && <ReceivedTab />}
        {tab === 'cycles' && <CyclesTab />}
      </div>
    </div>
  );
}

function TabBtn({
  active, onClick, icon: Icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-caption flex items-center gap-1.5 border-b-2 transition ${
        active ? 'border-warning text-warning font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

// =============================================================================
// Tab 1: 待我评
// =============================================================================
function TodoTab() {
  const ME = useCurrentUserId();
  const { cycles, assignments, submissions, submitReview } = useReview360Store();
  const { people } = useOKRStore();
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);

  const myTodos = useMemo(() => {
    return assignments.filter((a) => a.raterId === ME && !a.submitted);
  }, [assignments, ME]);
  const myDone = useMemo(() => {
    return assignments.filter((a) => a.raterId === ME && a.submitted);
  }, [assignments, ME]);

  const personById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of people) m.set(p.id, p.name);
    return m;
  }, [people]);

  const cycleById = useMemo(() => {
    const m = new Map<string, Review360CycleDef>();
    for (const c of cycles) m.set(c.id, c);
    return m;
  }, [cycles]);

  const activeAssignment = activeAssignmentId
    ? assignments.find((a) => a.id === activeAssignmentId)
    : null;
  const activeCycle = activeAssignment ? cycleById.get(activeAssignment.cycleId) : null;

  if (activeAssignment && activeCycle) {
    return (
      <ReviewForm
        assignment={activeAssignment}
        cycle={activeCycle}
        subjectName={personById.get(activeAssignment.subjectId) ?? activeAssignment.subjectId}
        onSubmit={(payload) => {
          submitReview(payload);
          setActiveAssignmentId(null);
        }}
        onCancel={() => setActiveAssignmentId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-caption">待评 ({myTodos.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {myTodos.length === 0 && (
            <div className="text-footnote text-muted-foreground py-4 text-center">
              没有待评估的人 · 主管/HR 在「周期管理」分配后会出现
            </div>
          )}
          {myTodos.map((a) => {
            const c = cycleById.get(a.cycleId);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setActiveAssignmentId(a.id)}
                className="w-full border rounded p-3 text-left hover:bg-muted/40 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-caption font-medium">
                      评估 {personById.get(a.subjectId) ?? a.subjectId}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {c?.name ?? a.cycleId}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[10px] ${RATER_COLOR[a.raterType]}`}>
                      {RATER_LABEL[a.raterType]}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {myDone.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-caption text-emerald-700">已完成 ({myDone.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {myDone.map((a) => {
              const c = cycleById.get(a.cycleId);
              return (
                <div key={a.id} className="border rounded p-2 text-footnote flex items-center justify-between bg-emerald-50/30">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    {personById.get(a.subjectId) ?? a.subjectId}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{c?.name}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =============================================================================
// Review Form
// =============================================================================
function ReviewForm({
  assignment, cycle, subjectName, onSubmit, onCancel,
}: {
  assignment: { cycleId: string; subjectId: string; raterId: string; raterType: Review360RaterType };
  cycle: Review360CycleDef;
  subjectName: string;
  onSubmit: (s: Omit<Review360Submission, 'id' | 'submittedAt'>) => void;
  onCancel: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, { score?: number; text?: string }>>({});
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [overallScore, setOverallScore] = useState<number | undefined>();

  const setScore = (qid: string, score: number) => {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], score: a[qid]?.score === score ? undefined : score } }));
  };
  const setText = (qid: string, text: string) => {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], text } }));
  };

  const valid = strengths.trim().length > 0 && improvements.trim().length > 0
    && cycle.questions.every((q) => !q.rated || typeof answers[q.id]?.score === 'number');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-body">
              评估: {subjectName}
              <Badge className={`ml-2 text-[10px] ${RATER_COLOR[assignment.raterType]}`}>
                作为 {RATER_LABEL[assignment.raterType]}
              </Badge>
            </CardTitle>
            <p className="text-footnote text-muted-foreground mt-1">{cycle.name}</p>
          </div>
          {assignment.raterType === 'peer' && cycle.anonymizePeers && (
            <Badge className="bg-slate-100 text-slate-700 gap-1">
              <Lock className="h-3 w-3" /> 匿名提交
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {cycle.questions.map((q) => (
          <div key={q.id} className="border-b pb-4 last:border-b-0">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="text-[10px] shrink-0">{q.dimension}</Badge>
              <div className="flex-1">
                <div className="text-caption font-medium">{q.prompt}</div>
                {q.rated && (
                  <div className="flex gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setScore(q.id, n)}
                        className={`h-9 w-9 rounded text-caption transition ${
                          answers[q.id]?.score === n
                            ? 'bg-warning text-white'
                            : 'bg-white border hover:bg-warning/5'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <span className="text-[10px] text-muted-foreground self-center ml-2">
                      1=远低于预期 · 5=显著超出预期
                    </span>
                  </div>
                )}
                {q.qualitative && (
                  <Textarea
                    value={answers[q.id]?.text ?? ''}
                    onChange={(e) => setText(q.id, e.target.value)}
                    placeholder="举一两个具体例子..."
                    rows={2}
                    className="mt-2 text-footnote"
                  />
                )}
              </div>
            </div>
          </div>
        ))}

        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-footnote text-emerald-700">✓ 整体优势 (必填)</Label>
            <Textarea
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder="该同事最值得继续保持的 1-2 个亮点..."
              rows={3}
              className="mt-1 text-caption"
            />
          </div>
          <div>
            <Label className="text-footnote text-rose-700">→ 整体改进点 (必填, 建设性)</Label>
            <Textarea
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder="如果只能挑 1-2 件事再做得更好, 是什么..."
              rows={3}
              className="mt-1 text-caption"
            />
          </div>
          <div>
            <Label className="text-footnote">总评分 (可选)</Label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setOverallScore(overallScore === n ? undefined : n)}
                  className={`h-8 w-8 rounded text-caption transition ${
                    overallScore === n
                      ? 'bg-warning text-white'
                      : 'bg-white border hover:bg-warning/5'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button
            disabled={!valid}
            onClick={() => {
              const ans = cycle.questions.map((q) => ({
                questionId: q.id,
                score: answers[q.id]?.score,
                text: answers[q.id]?.text,
              }));
              onSubmit({
                cycleId: cycle.id,
                subjectId: assignment.subjectId,
                raterId: assignment.raterId,
                raterType: assignment.raterType,
                answers: ans,
                strengths: strengths.trim(),
                improvements: improvements.trim(),
                overallScore,
              });
            }}
          >
            <Send className="h-3 w-3 mr-1" /> 提交
          </Button>
          {!valid && (
            <span className="text-[10px] text-muted-foreground self-center">
              所有评分题 + 优势 + 改进点都填完才能提交
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Tab 2: 收到反馈 (作为 subject 的聚合报告)
// =============================================================================
function ReceivedTab() {
  const ME = useCurrentUserId();
  const { cycles, submissions } = useReview360Store();
  const { people } = useOKRStore();

  const myReports = useMemo(() => {
    return submissions.filter((s) => s.subjectId === ME);
  }, [submissions, ME]);

  const byCycle = useMemo(() => {
    const map = new Map<string, Review360Submission[]>();
    for (const s of myReports) {
      const arr = map.get(s.cycleId) ?? [];
      arr.push(s);
      map.set(s.cycleId, arr);
    }
    return map;
  }, [myReports]);

  if (myReports.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-caption text-muted-foreground">
          还没有收到任何 360 反馈
          <div className="text-[11px] mt-1">等周期结束 + 各方提交后这里会出现聚合报告</div>
        </CardContent>
      </Card>
    );
  }

  const personById = new Map(people.map((p) => [p.id, p.name] as const));

  return (
    <div className="space-y-4">
      {Array.from(byCycle.entries()).map(([cid, subs]) => {
        const cycle = cycles.find((c) => c.id === cid);
        if (!cycle) return null;
        return (
          <Card key={cid}>
            <CardHeader>
              <CardTitle className="text-body">{cycle.name}</CardTitle>
              <p className="text-footnote text-muted-foreground">
                收到 {subs.length} 份反馈 · {cycle.anonymizePeers ? '🔒 平级匿名' : ''}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 维度聚合 */}
              <DimensionSummary subs={subs} questions={cycle.questions} />

              {/* 优势 + 改进点 */}
              <div className="grid md:grid-cols-2 gap-3">
                <div className="border rounded p-3 bg-emerald-50/30">
                  <div className="text-footnote font-semibold text-emerald-700 mb-2">
                    ✓ 大家点赞的优势 ({subs.length} 条)
                  </div>
                  <div className="space-y-1.5 text-footnote">
                    {subs.map((s, i) => (
                      <div key={s.id} className="border-b border-emerald-200/50 pb-1 last:border-b-0">
                        <span className="text-[10px] text-muted-foreground">
                          {cycle.anonymizePeers && s.raterType === 'peer'
                            ? '匿名平级'
                            : `${RATER_LABEL[s.raterType]} · ${personById.get(s.raterId) ?? s.raterId}`}:
                        </span>
                        <div>{s.strengths}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border rounded p-3 bg-rose-50/30">
                  <div className="text-footnote font-semibold text-rose-700 mb-2">
                    → 建设性改进点 ({subs.length} 条)
                  </div>
                  <div className="space-y-1.5 text-footnote">
                    {subs.map((s) => (
                      <div key={s.id} className="border-b border-rose-200/50 pb-1 last:border-b-0">
                        <span className="text-[10px] text-muted-foreground">
                          {cycle.anonymizePeers && s.raterType === 'peer'
                            ? '匿名平级'
                            : `${RATER_LABEL[s.raterType]} · ${personById.get(s.raterId) ?? s.raterId}`}:
                        </span>
                        <div>{s.improvements}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DimensionSummary({
  subs, questions,
}: { subs: Review360Submission[]; questions: Review360Question[] }) {
  const stats = questions
    .filter((q) => q.rated)
    .map((q) => {
      const scores: number[] = [];
      for (const s of subs) {
        const a = s.answers.find((x) => x.questionId === q.id);
        if (typeof a?.score === 'number') scores.push(a.score);
      }
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return { dim: q.dimension, prompt: q.prompt, avg, count: scores.length };
    });

  return (
    <div>
      <div className="text-footnote font-semibold mb-2">📊 维度评分</div>
      <div className="space-y-1.5">
        {stats.map((s) => {
          const pct = (s.avg / 5) * 100;
          const color = s.avg >= 4 ? 'bg-emerald-500' : s.avg >= 3 ? 'bg-warning' : 'bg-rose-500';
          return (
            <div key={s.dim} className="flex items-center gap-2 text-footnote">
              <span className="w-16 shrink-0">{s.dim}</span>
              <div className="flex-1 h-2.5 bg-slate-200 rounded overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="font-mono w-14 text-right">
                {s.avg.toFixed(1)} / 5
              </span>
              <span className="text-[10px] text-muted-foreground w-10 text-right">
                ({s.count} 票)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Tab 3: 周期管理
// =============================================================================
function CyclesTab() {
  const { cycles, assignments, addCycle, deleteCycle, addAssignment, removeAssignment } = useReview360Store();
  const { people } = useOKRStore();

  const [showNewCycle, setShowNewCycle] = useState(false);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);

  const personById = new Map(people.map((p) => [p.id, p.name] as const));
  const activeCycle = activeCycleId ? cycles.find((c) => c.id === activeCycleId) : null;
  const activeAssigns = activeCycleId ? assignments.filter((a) => a.cycleId === activeCycleId) : [];

  // 新建周期
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [anon, setAnon] = useState(true);

  // 加 assignment 表单
  const [subjId, setSubjId] = useState('');
  const [raterId, setRaterId] = useState('');
  const [raterType, setRaterType] = useState<Review360RaterType>('peer');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-caption font-semibold">评估周期 ({cycles.length})</h2>
        <Button size="sm" onClick={() => setShowNewCycle(!showNewCycle)}>
          <Plus className="h-3 w-3 mr-1" /> 新周期
        </Button>
      </div>

      {showNewCycle && (
        <Card className="border-warning/20">
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-footnote">名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="2026-Q3 360 评估" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-footnote">开始</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-footnote">结束</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-footnote">
              <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} className="accent-amber-600" />
              平级评分匿名 (推荐)
            </label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewCycle(false)}>取消</Button>
              <Button
                size="sm"
                disabled={!name.trim()}
                onClick={() => {
                  addCycle({
                    name: name.trim(),
                    startDate: new Date(startDate).getTime(),
                    endDate: new Date(endDate).getTime(),
                    status: 'active',
                    questions: DEFAULT_360_QUESTIONS,
                    anonymizePeers: anon,
                  });
                  setName(''); setShowNewCycle(false);
                }}
              >
                创建
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {cycles.length === 0 && (
          <div className="text-footnote text-muted-foreground text-center py-6">
            还没有评估周期 · 点上方「新周期」开始
          </div>
        )}
        {cycles.map((c) => {
          const ass = assignments.filter((a) => a.cycleId === c.id);
          const done = ass.filter((a) => a.submitted).length;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCycleId(activeCycleId === c.id ? null : c.id)}
              className={`w-full border rounded p-3 text-left transition ${
                activeCycleId === c.id ? 'bg-warning/5/40 border-warning/30' : 'hover:bg-muted/40'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-caption font-medium">{c.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(c.startDate).toLocaleDateString('zh-CN')} →{' '}
                    {new Date(c.endDate).toLocaleDateString('zh-CN')}
                    {c.anonymizePeers && ' · 🔒 平级匿名'}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline">
                    {done}/{ass.length} 完成
                  </Badge>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {activeCycle && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-caption">配置评估关系: {activeCycle.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <div>
                <Label className="text-[10px]">被评人</Label>
                <select
                  aria-label="被评估人"
                  value={subjId}
                  onChange={(e) => setSubjId(e.target.value)}
                  className="w-full h-8 rounded border bg-white px-2 text-footnote"
                >
                  <option value="">选择...</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[10px]">评估人</Label>
                <select
                  aria-label="评估人"
                  value={raterId}
                  onChange={(e) => setRaterId(e.target.value)}
                  className="w-full h-8 rounded border bg-white px-2 text-footnote"
                >
                  <option value="">选择...</option>
                  {people.filter((p) => p.id !== subjId).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[10px]">关系</Label>
                <select
                  aria-label="评估关系类型"
                  value={raterType}
                  onChange={(e) => setRaterType(e.target.value as Review360RaterType)}
                  className="w-full h-8 rounded border bg-white px-2 text-footnote"
                >
                  {(Object.keys(RATER_LABEL) as Review360RaterType[]).map((r) => (
                    <option key={r} value={r}>{RATER_LABEL[r]}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!subjId || !raterId || subjId === raterId}
                  onClick={() => {
                    addAssignment({
                      cycleId: activeCycle.id,
                      subjectId: subjId,
                      raterId,
                      raterType,
                    });
                    setSubjId(''); setRaterId('');
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> 添加
                </Button>
              </div>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {activeAssigns.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-footnote border rounded px-2 py-1.5 bg-white">
                  {a.submitted ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-warning shrink-0" />
                  )}
                  <span className="flex-1">
                    <strong>{personById.get(a.raterId) ?? a.raterId}</strong>
                    {' → '}
                    <span className="text-muted-foreground">评估</span>
                    {' '}
                    <strong>{personById.get(a.subjectId) ?? a.subjectId}</strong>
                  </span>
                  <Badge className={`text-[9px] ${RATER_COLOR[a.raterType]}`}>
                    {RATER_LABEL[a.raterType]}
                  </Badge>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeAssignment(a.id); }}
                    className="text-destructive opacity-50 hover:opacity-100"
                    aria-label="删除"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {activeAssigns.length === 0 && (
                <div className="text-[11px] text-muted-foreground text-center py-3">
                  还没有评估关系
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  if (confirm(`确认删除周期 "${activeCycle.name}" + 所有 assignment + submission?`)) {
                    deleteCycle(activeCycle.id);
                    setActiveCycleId(null);
                  }
                }}
              >
                删除整个周期
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

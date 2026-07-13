'use client';

/**
 * /persona/squad — 技能分身编队 (分身编队 B-037 · M4)
 *
 * 拿捏「建队」入口 (决策 1A): 从基础 Agent 模板市场 fork 技能分身, 管理我的编队名册。
 *   - 名册: 主分身(班长) + 技能分身 (stage / 专业域 / 被采纳数), 一键去训练台训练。
 *   - 市场: 本租户已发布模板, fork 成技能分身 (≤5 硬上限, 后端 forkSkillPersona 校验)。
 * 「用队」(召唤战斗小组起草) 在搭子工作台 /tandem, 不在此页。
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Bot, Users, Plus, GraduationCap, Loader2, Store, Crown, Sparkles } from 'lucide-react';

interface PersonaView {
  id: string;
  kind: string;
  specialty: string | null;
  templateId: string | null;
  stage: string;
  delegationLevel: string;
  adoptionCount: number;
  bossCaptureScore: number;
}
interface PersonasResp {
  ok: boolean;
  primary: PersonaView | null;
  skills: PersonaView[];
  cap: number;
  remaining: number;
}
interface TemplateView {
  id: string;
  name: string;
  specialty: string;
  origin: string;
  basePrompt: string;
  defaultKnowledgeTags: string[];
}

const STAGE_LABEL: Record<string, string> = {
  newborn: '新生', apprentice: '学徒', assistant: '助理', deputy: '副手', partner: '搭档',
};
const SPECIALTY_LABEL: Record<string, string> = {
  finance: '财务', tech: '技术', pm: '产品', marketing: '营销', legal: '法务',
  design: '设计', sales: '销售', hr: '人力', strategy: '战略',
};

function specialtyLabel(s: string | null): string {
  if (!s) return '通用';
  return SPECIALTY_LABEL[s] ?? s;
}

export default function SquadPage() {
  const { toast } = useToast();
  const [personas, setPersonas] = useState<PersonasResp | null>(null);
  const [templates, setTemplates] = useState<TemplateView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [forkingId, setForkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [pr, tr] = await Promise.all([
      fetch('/api/me/personas', { credentials: 'include', cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/agent-templates', { credentials: 'include', cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setPersonas(pr as PersonasResp | null);
    setTemplates((tr?.templates ?? []) as TemplateView[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remaining = personas?.remaining ?? 0;
  const cap = personas?.cap ?? 5;
  const atCap = remaining <= 0;

  async function fork(templateId: string) {
    if (atCap) return;
    setForkingId(templateId);
    try {
      const r = await fetch('/api/persona/fork', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error ?? 'fork 失败');
      toast({ title: '已加入编队', description: `${specialtyLabel(d.persona.specialty)} 技能分身已 fork` });
      await load();
    } catch (e) {
      toast({ title: 'fork 失败', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setForkingId(null);
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 正在载入你的编队…
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-4xl space-y-8 px-4 py-6">
      {/* 头部 */}
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-title-3 font-semibold">
          <Users className="h-5 w-5 text-primary" /> 技能分身编队
        </h1>
        <p className="text-caption text-muted-foreground">
          从模板市场 fork 专业技能分身, 组成你的战斗小组。召唤小组一起干活在
          <Link href="/tandem" className="mx-1 underline underline-offset-2">搭子工作台</Link>。
        </p>
      </header>

      {/* 名册 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-caption font-medium text-foreground">
            <Bot className="h-4 w-4" /> 我的编队名册
          </h2>
          <Badge variant="secondary">
            技能分身 {personas?.skills.length ?? 0} / {cap}（余 {remaining}）
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* 主分身(班长) */}
          {personas?.primary && (
            <Card className="border-primary/40">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Crown className="h-4 w-4 text-warning" /> 主分身（班长）
                  </div>
                  <div className="mt-1 text-footnote text-muted-foreground">
                    阶段 {STAGE_LABEL[personas.primary.stage] ?? personas.primary.stage} · 拿捏分 {personas.primary.bossCaptureScore}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/persona/training">去训练</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 技能分身 */}
          {personas?.skills.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Sparkles className="h-4 w-4 text-primary" /> {specialtyLabel(s.specialty)} 分身
                  </div>
                  <div className="mt-1 text-footnote text-muted-foreground">
                    阶段 {STAGE_LABEL[s.stage] ?? s.stage} · 被采纳 {s.adoptionCount} 次
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/persona/training?personaId=${encodeURIComponent(s.id)}`}>
                    <GraduationCap className="mr-1 h-3.5 w-3.5" /> 训练
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}

          {(personas?.skills.length ?? 0) === 0 && (
            <p className="text-caption text-muted-foreground sm:col-span-2">
              还没有技能分身。从下方市场 fork 一个专业分身开始组队。
            </p>
          )}
        </div>
      </section>

      {/* 模板市场 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-caption font-medium text-foreground">
          <Store className="h-4 w-4" /> 基础 Agent 模板市场
          {atCap && <span className="text-footnote font-normal text-warning">（已达上限, 先归档不用的分身再 fork）</span>}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {(templates ?? []).map((t) => (
            <Card key={t.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{t.name}</div>
                  <Badge variant="outline">{specialtyLabel(t.specialty)}</Badge>
                </div>
                <p className="line-clamp-2 text-footnote text-muted-foreground">{t.basePrompt}</p>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-wrap gap-1">
                    {t.defaultKnowledgeTags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    disabled={atCap || forkingId === t.id}
                    onClick={() => fork(t.id)}
                  >
                    {forkingId === t.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <><Plus className="mr-1 h-3.5 w-3.5" /> fork</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {(templates ?? []).length === 0 && (
            <p className="text-caption text-muted-foreground sm:col-span-2">
              市场暂无已发布模板。请联系管理员在后台策展模板。
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

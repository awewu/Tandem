'use client';

/**
 * PersonaConstitutionCard · 价值观锚管理 (B-027)
 *
 * 员工自助声明"不可妥协原则" — 在每次主分身 LLM 调用时硬前置 (防漂移层).
 * 跟 3+1 引擎注入闭环对应 (lib/decision-layer/three-plus-one-engine.ts).
 *
 * 能力:
 *   - 列出 active 规则 + 添加 (≤ MAX_ACTIVE_RULES, ≤ 200 字)
 *   - 归档 (软删, 保留历史) + 看归档历史
 *   - 写权限限本人 / admin (API 已 gate)
 *
 * 风格沿用 /persona/training 页 (shadcn Card/Button/Input + lucide).
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  MAX_ACTIVE_RULES,
  MAX_RULE_TEXT_LENGTH,
  type ConstitutionRule,
  type PersonaConstitution,
} from '@/lib/types/persona-constitution';
import { ShieldCheck, Plus, Archive, History, AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  userId: string;
  className?: string;
}

export function PersonaConstitutionCard({ userId, className }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<PersonaConstitution | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/persona/${encodeURIComponent(userId)}/constitution`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.constitution ?? null);
    } catch (e) {
      toast({ variant: 'destructive', title: '价值观锚加载失败', description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => { void load(); }, [load]);

  const active = (data?.rules ?? []).filter((r) => !r.archivedAt);
  const archived = (data?.rules ?? []).filter((r) => r.archivedAt);
  const atLimit = active.length >= MAX_ACTIVE_RULES;
  const overLength = input.trim().length > MAX_RULE_TEXT_LENGTH;

  async function handleAdd() {
    const text = input.trim();
    if (!text || submitting || atLimit || overLength) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/persona/${encodeURIComponent(userId)}/constitution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json.constitution);
      setInput('');
    } catch (e) {
      toast({ variant: 'destructive', title: '添加失败', description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(rule: ConstitutionRule) {
    if (!confirm(`归档原则「${rule.text}」? 归档后主分身不再受此约束 (历史保留).`)) return;
    try {
      const res = await fetch(
        `/api/persona/${encodeURIComponent(userId)}/constitution?ruleId=${encodeURIComponent(rule.id)}`,
        { method: 'DELETE' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json.constitution);
    } catch (e) {
      toast({ variant: 'destructive', title: '归档失败', description: (e as Error).message });
    }
  }

  return (
    <Card className={cn('border-indigo-200 bg-indigo-50/30', className)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-600" />
          <h2 className="text-caption font-semibold text-slate-800">价值观锚 · 不可妥协原则</h2>
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {active.length}/{MAX_ACTIVE_RULES}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          这里声明的硬规则会在主分身每次给 3+1 建议时<strong>硬前置到 system prompt 最前</strong>，
          防止它在长对话里漂走你的核心立场。越具体越好（如「永不向客户承诺无法兑现的交期」）。
        </p>

        {/* active 规则列表 */}
        {loading ? (
          <div className="flex items-center gap-2 text-footnote text-muted-foreground py-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            加载中…
          </div>
        ) : active.length === 0 ? (
          <div className="text-center py-5 text-[11px] text-muted-foreground border border-dashed rounded-lg">
            还没有价值观锚。添加第一条，让分身记住你的底线。
          </div>
        ) : (
          <ul className="space-y-1.5">
            {active.map((rule, idx) => (
              <li
                key={rule.id}
                className="flex items-start gap-2 rounded-lg border bg-white px-3 py-2 text-footnote"
              >
                <span className="font-bold tabular-nums text-indigo-600 mt-0.5">{idx + 1}.</span>
                <span className="flex-1 text-slate-800 leading-relaxed">{rule.text}</span>
                <button
                  type="button"
                  onClick={() => handleArchive(rule)}
                  className="p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors shrink-0"
                  title="归档此原则"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* 添加 */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAdd()}
              placeholder={atLimit ? '已达上限，请先归档' : '新增一条不可妥协原则…'}
              className="h-9 text-footnote"
              disabled={atLimit || submitting}
              maxLength={MAX_RULE_TEXT_LENGTH + 20}
            />
            <Button
              onClick={handleAdd}
              disabled={!input.trim() || atLimit || overLength || submitting}
              size="sm"
              className="h-9 shrink-0"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {overLength && (
            <p className="flex items-center gap-1 text-[10px] text-rose-600">
              <AlertTriangle className="h-3 w-3" />
              超长 ({input.trim().length}/{MAX_RULE_TEXT_LENGTH})，请精简
            </p>
          )}
        </div>

        {/* 归档历史 */}
        {archived.length > 0 && (
          <div className="pt-1 border-t">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-slate-700 transition-colors"
            >
              <History className="h-3 w-3" />
              归档历史 ({archived.length}) {showArchived ? '收起' : '展开'}
            </button>
            {showArchived && (
              <ul className="mt-2 space-y-1">
                {archived.map((rule) => (
                  <li key={rule.id} className="text-[11px] text-muted-foreground line-through px-1">
                    {rule.text}
                    {rule.archivedReason && (
                      <span className="ml-1 no-underline">· {rule.archivedReason}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

/**
 * 组织云盘 · 蒸馏候选审阅 (Phase D)
 *
 * AI 扫描共享工作文件产出候选草稿; 审阅人编辑后「提议入库」成为 proposer,
 * 走三级签批 promotion-flow。AI 永不作 proposer (宪章 Rule A)。
 */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Sparkles, Check, X } from 'lucide-react';

interface Candidate {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  suggestedType: 'sop' | 'case' | 'redline' | 'value' | 'lesson';
  suggestedTitle: string;
  suggestedBody: string;
  rationale: string;
  status: 'pending' | 'dismissed' | 'promoted';
}

const TYPE_LABELS: Record<Candidate['suggestedType'], string> = {
  sop: 'SOP/规范', case: '案例', redline: '红线', value: '价值观', lesson: '教训',
};

export default function DriveDistillationPage() {
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Partial<Candidate> & { level?: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/drive/distillation?status=pending', { credentials: 'include', cache: 'no-store' });
    const j = r.ok ? await r.json() : { candidates: [] };
    setItems(Array.isArray(j.candidates) ? j.candidates : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function scan() {
    setScanning(true);
    setMsg(null);
    try {
      const r = await fetch('/api/drive/distillation', { method: 'POST', credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? '扫描失败');
      setMsg(`扫描完成: 新增候选 ${j.created} · 扫描 ${j.scanned} · 跳过 ${j.skipped}`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '扫描失败');
    } finally {
      setScanning(false);
    }
  }

  function patchDraft(id: string, p: Partial<Candidate> & { level?: string }) {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }

  async function promote(c: Candidate) {
    const d = draft[c.id] ?? {};
    const r = await fetch(`/api/drive/distillation/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        action: 'promote',
        title: d.suggestedTitle ?? c.suggestedTitle,
        type: d.suggestedType ?? c.suggestedType,
        body: d.suggestedBody ?? c.suggestedBody,
        level: d.level ?? 'team',
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j?.error?.message ?? j?.error ?? '提议失败'); return; }
    setMsg(`已提议入库《${d.suggestedTitle ?? c.suggestedTitle}》→ 三级签批流程`);
    await load();
  }

  async function dismiss(c: Candidate) {
    const r = await fetch(`/api/drive/distillation/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'dismiss' }),
    });
    if (r.ok) await load();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto md:px-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-title-3 font-bold flex items-center gap-2">
          <Sparkles size={20} /> 云盘蒸馏候选
        </h1>
        <Button size="sm" onClick={scan} disabled={scanning}>
          <RefreshCw size={15} className={`mr-1 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? '扫描中…' : '扫描云盘'}
        </Button>
      </div>
      <p className="text-caption text-muted-foreground mb-4">
        中央 AI 只扫描【已共享】的工作文件并产出草稿建议; 你审阅编辑后「提议入库」成为 proposer, 走三级签批。AI 永不自动入库。
      </p>

      {msg && <div className="text-footnote text-info mb-3">{msg}</div>}

      {loading ? (
        <div className="text-ink-secondary py-8">加载中…</div>
      ) : items.length === 0 ? (
        <div className="text-center text-ink-tertiary py-12">暂无待审阅候选，点「扫描云盘」生成。</div>
      ) : (
        <div className="space-y-4">
          {items.map((c) => {
            const d = draft[c.id] ?? {};
            return (
              <div key={c.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">来源: {c.sourceFileName}</Badge>
                  <span className="text-footnote text-muted-foreground">{c.rationale}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-footnote text-muted-foreground">标题</label>
                    <Input className="mt-1" value={d.suggestedTitle ?? c.suggestedTitle}
                      onChange={(e) => patchDraft(c.id, { suggestedTitle: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-footnote text-muted-foreground">类型</label>
                    <Select value={d.suggestedType ?? c.suggestedType}
                      onValueChange={(v) => patchDraft(c.id, { suggestedType: v as Candidate['suggestedType'] })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-footnote text-muted-foreground">正文 (请补全后提议)</label>
                  <Textarea className="mt-1 font-mono text-footnote" rows={8}
                    value={d.suggestedBody ?? c.suggestedBody}
                    onChange={(e) => patchDraft(c.id, { suggestedBody: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-32">
                    <Select value={d.level ?? 'team'} onValueChange={(v) => patchDraft(c.id, { level: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team">团队级</SelectItem>
                        <SelectItem value="dept">部门级</SelectItem>
                        <SelectItem value="company">公司级</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" onClick={() => promote(c)}><Check size={14} className="mr-1" />提议入库</Button>
                  <Button size="sm" variant="outline" onClick={() => dismiss(c)}><X size={14} className="mr-1" />忽略</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

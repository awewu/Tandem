'use client';

import { useState } from 'react';
import { useOKRStore } from '@/lib/store/okr';
import { hydrateOkrFromApi } from '@/lib/store/okr-sync';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Target } from 'lucide-react';

interface OkrCheckinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kr: any;
  activeChannelId: string | null;
  onSuccess: () => void;
}

export function OkrCheckinDialog({
  open,
  onOpenChange,
  kr,
  activeChannelId,
  onSuccess,
}: OkrCheckinDialogProps) {
  const { toast } = useToast();
  const [checkinValue, setCheckinValue] = useState<number>(kr?.currentValue || 0);
  const [checkinConfidence, setCheckinConfidence] = useState<'on-track' | 'at-risk' | 'off-track'>('on-track');
  const [checkinAchievements, setCheckinAchievements] = useState('');
  const [checkinBlockers, setCheckinBlockers] = useState('');
  const [checkinNextSteps, setCheckinNextSteps] = useState('');
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);

  if (!kr) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!kr || checkinSubmitting) return;
    setCheckinSubmitting(true);
    try {
      // 1. 提交到 OKR checkins 端点
      const checkinRes = await fetch('/api/okr/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'kr',
          scopeId: kr.id,
          progressBefore: kr.currentValue,
          progressAfter: checkinValue,
          currentValue: checkinValue,
          confidenceAfter: checkinConfidence,
          achievements: checkinAchievements,
          blockers: checkinBlockers,
          nextSteps: checkinNextSteps,
          mood: 'neutral',
        }),
      });

      if (!checkinRes.ok) {
        const checkinData = await checkinRes.json();
        throw new Error(checkinData.error || 'Check-in 提交失败');
      }

      // 2. 刷新本地 OKR 缓存
      await hydrateOkrFromApi();

      // 3. 构建并广播 IM 消息 (OKR & IM Synergy)
      if (activeChannelId) {
        const confidenceEmojis: Record<string, string> = {
          'on-track': '🟢 正常',
          'at-risk': '🟡 有风险',
          'off-track': '🔴 严重偏离',
        };
        const confidenceText = confidenceEmojis[checkinConfidence] || checkinConfidence;
        
        const start = kr.startValue;
        const target = kr.targetValue;
        const progressPercent = Math.max(0, Math.min(100, Math.round(((checkinValue - start) / (target - start || 1)) * 100)));

        const body = `🎯 **OKR 进度更新报告**\n\n` +
          `指标：**${kr.title}** (${checkinValue}${kr.unit || ''} / ${target}${kr.unit || ''})\n` +
          `当前进度：**${progressPercent}%** (变动: ${kr.currentValue}${kr.unit || ''} ➔ ${checkinValue}${kr.unit || ''})\n` +
          `信心度：${confidenceText}\n\n` +
          `✨ **本阶段进展**：\n${checkinAchievements ? checkinAchievements.split('\n').map(l => `- ${l}`).join('\n') : '- 暂无描述'}\n\n` +
          `⚠️ **遇到的阻碍**：\n${checkinBlockers ? checkinBlockers.split('\n').map(l => `- ${l}`).join('\n') : '- 无明显阻碍'}\n\n` +
          `📅 **下一步计划**：\n${checkinNextSteps ? checkinNextSteps.split('\n').map(l => `- ${l}`).join('\n') : '- 未填写'}`;

        await fetch(`/api/im/channels/${activeChannelId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        });
      }

      toast({
        title: 'Check-in 提交成功！',
        description: 'OKR 指标已更新，且已成功广播至 IM 频道。',
      });

      // 重置状态与关闭
      setCheckinAchievements('');
      setCheckinBlockers('');
      setCheckinNextSteps('');
      onSuccess();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Check-in 失败',
        description: (err as Error).message || '未知错误',
      });
    } finally {
      setCheckinSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-3xl border-slate-200/80 bg-white p-6 shadow-soft-xl">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-slate-100">
          <DialogTitle className="text-title-3 font-bold text-slate-900 flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-500 shrink-0" />
            快速 OKR Check-in 与 IM 广播
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3.5">
          <div>
            <Label className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
              当前对齐的关键结果 (KR)
            </Label>
            <div className="mt-1 text-[13.5px] font-medium text-slate-800 leading-snug bg-slate-50 border border-slate-100 p-3 rounded-2xl">
              {kr.title}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
                最新进度数值 ({kr.unit || '无单位'})
              </Label>
              <div className="text-[10px] text-slate-400">
                值域: {kr.startValue} ~ {kr.targetValue}
              </div>
              <Input
                type="number"
                step="any"
                value={checkinValue}
                onChange={(e) => setCheckinValue(parseFloat(e.target.value) || 0)}
                required
                className="h-10 rounded-2xl border-slate-200 focus:border-warning/50 focus:ring-warning/10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
                信心度评准 (Confidence)
              </Label>
              <div className="text-[10px] text-slate-400">
                当前状态评级
              </div>
              <Select
                value={checkinConfidence}
                onValueChange={(val: any) => setCheckinConfidence(val)}
              >
                <SelectTrigger className="h-10 rounded-2xl border-slate-200">
                  <SelectValue placeholder="选择信心度" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-100">
                  <SelectItem value="on-track" className="rounded-md">🟢 正常 (On-track)</SelectItem>
                  <SelectItem value="at-risk" className="rounded-md">🟡 有风险 (At-risk)</SelectItem>
                  <SelectItem value="off-track" className="rounded-md">🔴 严重偏离 (Off-track)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
              ✨ 本阶段进展 (Achievements)
            </Label>
            <Textarea
              value={checkinAchievements}
              onChange={(e) => setCheckinAchievements(e.target.value)}
              placeholder="完成了哪些里程碑？达成了哪些合作？(建议分行填写...)"
              className="rounded-2xl border-slate-200 focus:border-warning/50 focus:ring-warning/10 min-h-[70px] text-[13px]"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
              ⚠️ 遇到哪些阻碍 & 困难 (Blockers)
            </Label>
            <Textarea
              value={checkinBlockers}
              onChange={(e) => setCheckinBlockers(e.target.value)}
              placeholder="是否需要团队/主管协调资源解决？无阻碍可不填。"
              className="rounded-2xl border-slate-200 focus:border-warning/50 focus:ring-warning/10 min-h-[60px] text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
              📅 下一步行动计划 (Next Steps)
            </Label>
            <Textarea
              value={checkinNextSteps}
              onChange={(e) => setCheckinNextSteps(e.target.value)}
              placeholder="接下来的工作方向或具体任务安排..."
              className="rounded-2xl border-slate-200 focus:border-warning/50 focus:ring-warning/10 min-h-[60px] text-[13px]"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={checkinSubmitting}
              onClick={() => onOpenChange(false)}
              className="h-10 px-5 rounded-full border-slate-200 font-medium text-slate-700"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={checkinSubmitting}
              className="h-10 px-6 rounded-full bg-slate-900 text-white hover:bg-slate-800 font-medium shadow-soft-sm gap-1.5"
            >
              {checkinSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  提交中
                </>
              ) : (
                '提交并广播'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

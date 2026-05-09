'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { MemoryPromotionRequest } from '@/lib/types/memory';

export interface StewardItem extends MemoryPromotionRequest {
  proposerName?: string;
}

export function StewardDashboard({
  pendingItems,
  onSign,
  onReject,
  currentStewardId,
}: {
  pendingItems: StewardItem[];
  onSign: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  currentStewardId: string;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            Steward 工作台
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            知识管家 - 守护 Memory 层质量, 防止劣币驱逐良币
          </p>
        </CardHeader>
      </Card>

      {pendingItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            ✨ 当前无待处理的 Memory 升级提议
          </CardContent>
        </Card>
      ) : (
        pendingItems.map((item) => (
          <PromotionCard
            key={item.id}
            item={item}
            onSign={() => onSign(item.id)}
            onReject={(reason) => onReject(item.id, reason)}
            currentStewardId={currentStewardId}
          />
        ))
      )}
    </div>
  );
}

function PromotionCard({
  item,
  onSign,
  onReject,
  currentStewardId,
}: {
  item: StewardItem;
  onSign: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  currentStewardId: string;
}) {
  const reviewExpiry = item.publicReviewUntil ? new Date(item.publicReviewUntil) : null;
  const reviewExpired = reviewExpiry ? reviewExpiry.getTime() < Date.now() : false;
  const stewardSigned = (item.signers as Record<string, { userId: string }>)?.steward?.userId === currentStewardId;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base">{item.proposedTitle}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{item.proposedType}</Badge>
              {item.isEmergencyTrack && (
                <Badge variant="destructive">紧急通道</Badge>
              )}
              <span className="text-muted-foreground">
                由 {item.proposerName ?? item.createdBy} 提议 · {formatDate(item.createdAt)}
              </span>
            </div>
          </div>
          <SignerStatus signers={item.signers as never} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded border bg-slate-50 p-3 text-sm whitespace-pre-wrap">
          {item.proposedBody}
        </div>

        {reviewExpiry && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            公示截止: {formatDate(reviewExpiry.toISOString())}
            {reviewExpired ? ' · 已结束' : ' · 进行中'}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const reason = prompt('请说明驳回理由:');
              if (reason) onReject(reason);
            }}
            disabled={stewardSigned}
          >
            <XCircle className="mr-1 h-4 w-4" /> 驳回
          </Button>
          <Button size="sm" onClick={onSign} disabled={stewardSigned}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            {stewardSigned ? '已签字' : 'Steward 签字'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SignerStatus({
  signers,
}: {
  signers: Record<'business_leader' | 'steward' | 'ceo', { userId: string; signedAt?: string }>;
}) {
  const roles = [
    { key: 'business_leader', label: '业务负责人' },
    { key: 'steward', label: 'Steward' },
    { key: 'ceo', label: 'CEO' },
  ] as const;
  return (
    <div className="flex flex-col gap-1 text-xs">
      {roles.map((r) => {
        const signed = signers?.[r.key]?.userId;
        return (
          <div
            key={r.key}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${
              signed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {signed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {r.label}
          </div>
        );
      })}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

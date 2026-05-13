"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTenant } from "@/hooks/use-tenant";
import { toast } from "@/hooks/use-toast";

function centsToYuan(cents: number) {
  return (cents / 100).toFixed(0);
}

async function fetchBilling(workspaceId: string) {
  const res = await fetch(`/api/billing?workspace=${workspaceId}`);
  if (!res.ok) throw new Error("Failed to load billing");
  return res.json();
}

export default function BillingPage() {
  const { workspaceId } = useTenant();
  const queryClient = useQueryClient();
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["billing", workspaceId],
    queryFn: () => fetchBilling(workspaceId),
    enabled: !!workspaceId,
  });

  async function handleUpgrade(planId: string) {
    setUpgrading(planId);
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, workspaceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upgrade failed');
      toast({ title: '升级成功', description: `已切换到 ${json.workspace.planName}` });
      queryClient.invalidateQueries({ queryKey: ['billing', workspaceId] });
    } catch (err: any) {
      toast({ title: '升级失败', description: err.message, variant: 'destructive' });
    } finally {
      setUpgrading(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-red-500">
        加载订阅信息失败，请重试
      </div>
    );
  }

  const { workspace, currentPlan, usage, plans } = data;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">订阅与用量</h1>
        <p className="text-sm text-muted-foreground">管理你的工作区订阅计划和用量配额</p>
      </div>

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>当前计划</CardTitle>
            <Badge variant={workspace.subscriptionStatus === "active" ? "default" : "secondary"}>
              {workspace.subscriptionStatus === "active" ? "已激活" : workspace.subscriptionStatus}
            </Badge>
          </div>
          <CardDescription>
            {currentPlan?.displayName ?? currentPlan?.name ?? "免费版"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UsageBar label="成员数" used={usage.users.used} limit={usage.users.limit} />
          <UsageBar label="频道数" used={usage.channels.used} limit={usage.channels.limit} />
          <UsageBar label="存储 (MB)" used={usage.storageMb.used} limit={usage.storageMb.limit} />
        </CardContent>
      </Card>

      {/* Plans Grid */}
      <div>
        <h2 className="mb-4 text-lg font-medium">升级计划</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan: any) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              current={plan.current}
              upgrading={upgrading === plan.id}
              onUpgrade={() => handleUpgrade(plan.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {used} / {limit} ({pct}%)
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function PlanCard({
  plan,
  current,
  upgrading,
  onUpgrade,
}: {
  plan: any;
  current: boolean;
  upgrading?: boolean;
  onUpgrade?: () => void;
}) {
  return (
    <Card className={current ? "border-primary ring-1 ring-primary" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{plan.displayName}</CardTitle>
        <CardDescription className="text-xs">{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-2xl font-bold">
          ¥{centsToYuan(plan.priceMonthCents)}
          <span className="text-sm font-normal text-muted-foreground">/ 月</span>
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>最多 {plan.maxUsers} 名成员</li>
          <li>最多 {plan.maxChannels} 个频道</li>
          <li>{plan.maxStorageMb} MB 存储</li>
          <li>{plan.apiRateLimitRpm} RPM</li>
        </ul>
        <Button
          size="sm"
          variant={current ? "secondary" : "default"}
          disabled={current || upgrading}
          onClick={onUpgrade}
          className="w-full"
        >
          {current ? "当前计划" : upgrading ? "升级中..." : "升级"}
        </Button>
      </CardContent>
    </Card>
  );
}

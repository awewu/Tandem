'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { DecisionCardView } from '@/components/decision-card/DecisionCardView';
import type { DecisionCard } from '@/lib/types';

export default function DecisionCardPage({ params }: { params: { id: string } }) {
  const [card, setCard] = useState<DecisionCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/convergence/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCard(data.card);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <main className="container mx-auto max-w-3xl py-6 px-4">
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />加载...
        </div>
      </main>
    );
  }

  if (error || !card) {
    return (
      <main className="container mx-auto max-w-3xl py-6 px-4">
        <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertTriangle className="mb-2 h-5 w-5" />加载失败: {error}
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl py-6 px-4">
      <DecisionCardView card={card} />
    </main>
  );
}

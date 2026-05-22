'use client';

import { use } from 'react';
import { ConvergenceRoom } from '@/components/convergence/ConvergenceRoom';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';

export default function ConvergenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Next.js 15 dynamic params 可能是 Promise; use() 同步解包
  const resolved = (params instanceof Promise ? use(params) : params) as { id: string };
  const currentUserId = useCurrentUserId();

  return (
    <main className="container mx-auto max-w-4xl py-6 px-4">
      <ConvergenceRoom cardId={resolved.id} currentUserId={currentUserId} />
    </main>
  );
}

import { ConvergenceRoom } from '@/components/convergence/ConvergenceRoom';

export default function ConvergenceDetailPage({ params }: { params: { id: string } }) {
  // V1 简化: 用固定 demo 用户. V2 接入 SSO 后改为 session.user.id.
  const currentUserId = 'demo-user';

  return (
    <main className="container mx-auto max-w-4xl py-6 px-4">
      <ConvergenceRoom cardId={params.id} currentUserId={currentUserId} />
    </main>
  );
}

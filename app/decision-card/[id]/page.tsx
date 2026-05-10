import { redirect } from 'next/navigation';

/**
 * Legacy alias - merged into /convergence/[id] in UI-IA §3.2.
 */
export default function Page({ params }: { params: { id: string } }) {
  redirect(`/convergence/${params.id}`);
}

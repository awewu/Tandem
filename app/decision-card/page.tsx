import { redirect } from 'next/navigation';

/**
 * Legacy alias - merged into /convergence in UI-IA §3.2.
 * Restore from git history if needed.
 */
export default function Page() {
  redirect('/convergence');
}

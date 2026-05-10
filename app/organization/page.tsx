import { redirect } from 'next/navigation';

/**
 * Legacy alias - merged into /admin/invite in UI-IA §3.5 (TBD).
 * Restore from git history if needed.
 */
export default function Page() {
  redirect('/admin/invite');
}

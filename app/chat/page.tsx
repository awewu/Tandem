import { redirect } from 'next/navigation';

/**
 * Page culled by UI-IA §3.4 (B step, commit @TODO).
 * Original Hermes-era functionality is either:
 *   - replaced by Tandem TAF (Skills/Agents/Workflows)
 *   - moved to /admin/* (Logs / MCP)
 *   - merged elsewhere (Knowledge → /memories)
 *   - retired (Chat → /im @persona, Design → docs only)
 *
 * Restore from git history if needed.
 */
export default function Page() {
  redirect('/');
}

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { getStore } from '@/lib/storage/repository';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { getChannelMessages, listMyChannels } from '@/lib/im/service';
import { buildWorkRiskBoard } from '@/lib/work-risk/board';
import { resolveWorkRiskPeople } from '@/lib/work-risk/scope';
import type { WorkRiskImChannelInput, WorkRiskImMessageInput } from '@/lib/work-risk/im-signals';

export const dynamic = 'force-dynamic';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const url = new URL(req.url);
  const scopeParam = url.searchParams.get('scope');
  const users = await store.auth.users.list({ tenantId: auth.tenantId });
  const resolved = resolveWorkRiskPeople({ auth, users, requestedScope: scopeParam });
  if (!resolved.ok) {
    return NextResponse.json(
      { ok: false, error: resolved.error, allowedScopes: resolved.allowedScopes },
      { status: resolved.status },
    );
  }

  const [cycles, objectives, keyResults, initiatives, approvals, calendarEvents] = await Promise.all([
    store.cycles.list(),
    store.objectives.list(),
    store.keyResults.list(),
    store.initiatives.list(),
    withTenantScope(store.approvals, auth.tenantId).list(),
    createAppContext().calendarRepo.list({ tenantId: auth.tenantId }),
  ]);

  const imChannels: WorkRiskImChannelInput[] = [];
  const imMessages: WorkRiskImMessageInput[] = [];
  const viewerChannelIds = new Set<string>();
  const viewerChannels = await listMyChannels(auth.userId, auth.tenantId);
  for (const channel of viewerChannels) {
    viewerChannelIds.add(channel.id);
    const messages = await getChannelMessages(channel.id, { limit: 80 });
    for (const message of messages) {
      imMessages.push({ channel, message });
    }
  }
  for (const person of resolved.people) {
    const channels = person.id === auth.userId ? viewerChannels : await listMyChannels(person.id, auth.tenantId);
    for (const channel of channels) {
      imChannels.push({
        subjectUserId: person.id,
        channel,
        unreadCount: channel.unread,
        hasUnreadMention: channel.membership.hasUnreadMention,
        viewerIsMember: viewerChannelIds.has(channel.id),
      });
    }
  }

  const board = buildWorkRiskBoard({
    viewerUserId: auth.userId,
    scope: resolved.scope,
    allowedScopes: resolved.allowedScopes,
    people: resolved.people,
    cycles,
    objectives,
    keyResults,
    initiatives,
    approvals,
    calendarEvents,
    imChannels,
    imMessages,
  });

  return NextResponse.json({ ok: true, board });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/work-risk' });

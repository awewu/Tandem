import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot, getStore as getBootStore } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { decrypt } from '@/lib/infra/crypto';
import { fetchInbox, fetchMessageByUid, type EmailCredentials } from '@/lib/integrations/email-tier1';
import { listMyChannels, getChannelMessages } from '@/lib/im/service';
import { withApiLog } from '@/lib/api-log/with-api-log';

type SourceKind = 'okr' | 'im' | 'mail';

interface DraftLine {
  krId: string;
  line: string;
  source: SourceKind;
}

function getKvRepo(collection: string) {
  const store = getStore();
  const proto = Object.getPrototypeOf(store.decisionCards);
  return new (proto.constructor as any)(collection);
}

function buildEmailCreds(userId: string, creds: any): EmailCredentials {
  return {
    userId,
    smtp: {
      host: creds.smtpHost,
      port: creds.smtpPort,
      secure: creds.smtpSecure,
      auth: {
        user: creds.smtpUser,
        pass: decrypt(creds.smtpPassEncrypted),
      },
    },
    imap: {
      host: creds.imapHost || inferImapHost(creds.smtpHost),
      port: creds.imapPort || 993,
      secure: creds.imapSecure ?? true,
      auth: {
        user: creds.imapUser || creds.smtpUser,
        pass: creds.imapPassEncrypted
          ? decrypt(creds.imapPassEncrypted)
          : decrypt(creds.smtpPassEncrypted),
      },
    },
  };
}

function inferImapHost(smtpHost: string): string {
  const map: Record<string, string> = {
    'smtp.gmail.com': 'imap.gmail.com',
    'smtp.exmail.qq.com': 'imap.exmail.qq.com',
    'smtp.qq.com': 'imap.qq.com',
    'smtp.163.com': 'imap.163.com',
    'smtp.office365.com': 'outlook.office365.com',
  };
  return map[smtpHost] || smtpHost.replace(/^smtp\./, 'imap.');
}

function toMs(value?: string | number | null): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compactText(text: string, max = 180): string {
  const normalized = text
    .replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function emailBodyText(textBody?: string, htmlBody?: string): string {
  if (textBody?.trim()) return textBody;
  if (htmlBody?.trim()) return htmlToPlainText(htmlBody);
  return '';
}

function stripNoise(text: string): string {
  return compactText(text, 240)
    .replace(/此邮件由[^，。；;]*发送/gi, '')
    .replace(/如有疑问[^。；;]*/gi, '')
    .replace(/请勿直接回复[^。；;]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function subjectTopic(subject: string): string {
  const cleaned = subject
    .replace(/^(\s*(re|fw|fwd)\s*[:：])+/i, '')
    .replace(/[【\[]?(通知|提醒|告警|预警|产品通知|系统通知|邮件通知)[】\]]?/g, '')
    .replace(/(产品通知|服务通知|到期提醒|续费提醒|过期提醒)$/g, '')
    .replace(/[「」《》]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || subject.trim() || '相关事项';
}

function summarizeWorkItem(input: {
  source: 'im' | 'mail';
  subject?: string;
  body: string;
  from?: string;
  channelName?: string;
}): string {
  const body = stripNoise(input.body);
  const subject = stripNoise(input.subject ?? '');
  const combined = `${subject} ${body}`;
  const topic = subjectTopic(subject || body).slice(0, 40);

  if (/(到期|即将到期|过期|续费|欠费|停用|失效|证书|certificate|expire|expired|renew)/i.test(combined)) {
    return `${topic}到期风险需跟进处理，确认续费、替换或延期方案。`;
  }
  if (/(告警|报警|异常|故障|失败|风险|漏洞|安全|阻断|error|fail|incident|alert)/i.test(combined)) {
    return `${topic}出现异常/风险信号，需排查原因并推进处理。`;
  }
  if (/(审批|批准|确认|review|approve|确认一下|麻烦确认|请确认)/i.test(combined)) {
    return `${topic}待确认/审批，需补充判断并推动闭环。`;
  }
  if (/(会议|评审|沟通|讨论|对齐|meeting|review|sync)/i.test(combined)) {
    return `${topic}相关事项已沟通对齐，需沉淀结论并跟进后续动作。`;
  }
  if (/(交付|上线|发布|部署|导入|迁移|集成|验收|delivery|release|deploy|launch)/i.test(combined)) {
    return `${topic}交付推进中，需跟进实施进展和验收结果。`;
  }
  if (/(客户|供应商|合同|报价|订单|采购|发票|回款|商务)/i.test(combined)) {
    return `${topic}涉及外部协作/商务事项，需跟进沟通和结果闭环。`;
  }

  const prefix = input.source === 'mail'
    ? `邮件${input.from ? `（${compactText(input.from, 30)}）` : ''}`
    : `IM${input.channelName ? `「${input.channelName}」` : ''}`;
  const summaryBase = topic && topic !== '相关事项' ? topic : body;
  return `${prefix}提到${compactText(summaryBase, 80)}，需确认是否形成待办并跟进。`;
}

function significantTerms(text: string): string[] {
  const normalized = text.toLowerCase();
  const ascii = normalized.match(/[a-z0-9]{2,}/g) ?? [];
  const chinese = Array.from(new Set((normalized.match(/[\u4e00-\u9fa5]{2,}/g) ?? []).flatMap((chunk) => {
    const terms: string[] = [];
    for (let i = 0; i < chunk.length - 1; i++) terms.push(chunk.slice(i, i + 2));
    return terms;
  })));
  return Array.from(new Set([...ascii, ...chinese])).filter((term) => !STOP_TERMS.has(term));
}

const STOP_TERMS = new Set([
  'kr',
  'okr',
  'objective',
  '目标',
  '关键',
  '结果',
  '完成',
  '推进',
  '今日',
  '今天',
  '系统',
  '项目',
]);

function pickBestKr(
  text: string,
  krs: Array<{ id: string; title: string; objectiveId: string }>,
  objectiveTitleById: Map<string, string>,
): string | null {
  const source = text.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const kr of krs) {
    const haystack = `${kr.title} ${objectiveTitleById.get(kr.objectiveId) ?? ''}`;
    const terms = significantTerms(haystack);
    let score = 0;
    for (const term of terms) {
      if (source.includes(term)) score += term.length > 2 ? 2 : 1;
    }
    if (!best || score > best.score) best = { id: kr.id, score };
  }
  return best && best.score > 0 ? best.id : null;
}

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getBootStore();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const startMs = todayStart.getTime();
  const endMs = startMs + 86_400_000;

  const cycles = await store.cycles.list();
  const activeCycle = cycles.find((cycle: any) => cycle.isActive) ?? cycles[0] ?? null;
  const objectives = (await store.objectives.list()).filter((objective: any) => !activeCycle || objective.cycleId === activeCycle.id);
  const objectiveTitleById = new Map(objectives.map((objective: any) => [objective.id, String(objective.title ?? '')]));
  const ownerAliases = new Set([auth.userId, `person:${auth.userId}`, 'me']);
  const myObjectiveIds = new Set(objectives.filter((objective: any) => ownerAliases.has(objective.ownerId)).map((objective: any) => objective.id));
  const krs = (await store.keyResults.list()).filter((kr: any) =>
    objectiveTitleById.has(kr.objectiveId) &&
    (ownerAliases.has(kr.ownerId) ||
      (Array.isArray(kr.collaborators) && kr.collaborators.some((id: string) => ownerAliases.has(id))) ||
      myObjectiveIds.has(kr.objectiveId))
  );

  const lines: DraftLine[] = [];
  const pushLine = (line: DraftLine) => {
    if (!line.krId || !line.line.trim()) return;
    if (lines.some((existing) => existing.krId === line.krId && existing.line === line.line)) return;
    lines.push(line);
  };

  const checkIns = await store.checkIns.list();
  for (const checkIn of checkIns as any[]) {
    if (checkIn.scope !== 'kr') continue;
    const t = toMs(checkIn.createdAt);
    if (t < startMs || t >= endMs || !ownerAliases.has(checkIn.authorId) || !krs.some((kr: any) => kr.id === checkIn.scopeId)) continue;
    const parts = [
      checkIn.achievements ? `成果：${compactText(String(checkIn.achievements))}` : '',
      checkIn.blockers ? `阻碍：${compactText(String(checkIn.blockers))}` : '',
      checkIn.nextSteps ? `下一步：${compactText(String(checkIn.nextSteps))}` : '',
    ].filter(Boolean);
    if (parts.length) pushLine({ krId: checkIn.scopeId, line: parts.join('\n'), source: 'okr' });
  }

  const initiatives = await store.initiatives.list().catch(() => []);
  for (const initiative of initiatives as any[]) {
    const updatedAt = toMs(initiative.updatedAt);
    const createdAt = toMs(initiative.createdAt);
    if (!ownerAliases.has(initiative.ownerId) || ((updatedAt < startMs || updatedAt >= endMs) && (createdAt < startMs || createdAt >= endMs))) continue;
    const krId = initiative.scope === 'kr'
      ? initiative.scopeId
      : krs.find((kr: any) => kr.objectiveId === initiative.scopeId)?.id;
    if (!krId) continue;
    const statusText =
      initiative.status === 'done' ? '完成'
      : initiative.status === 'in-progress' ? '推进中'
      : initiative.status === 'blocked' ? '受阻'
      : initiative.status === 'cancelled' ? '取消'
      : '待办';
    pushLine({ krId, line: `行动项「${compactText(String(initiative.title ?? ''))}」今日状态：${statusText}`, source: 'okr' });
  }

  try {
    const channels = await listMyChannels(auth.userId, auth.tenantId);
    for (const channel of channels.slice(0, 20)) {
      const messages = await getChannelMessages(channel.id, { limit: 80 });
      for (const message of messages) {
        const t = toMs(message.createdAt);
        if (t < startMs || t >= endMs) continue;
        const mentionsMe = (message.mentions ?? []).some((mention) => mention.userId === auth.userId);
        if (message.senderId !== auth.userId && !mentionsMe) continue;
        const body = compactText(message.body, 220);
        if (!body) continue;
        const krId = pickBestKr(`${channel.name} ${channel.topic ?? ''} ${body}`, krs as any[], objectiveTitleById);
        if (!krId) continue;
        const channelName = channel.type === 'dm' ? '私聊' : (channel.name || '群聊');
        pushLine({
          krId,
          line: summarizeWorkItem({ source: 'im', body, channelName }),
          source: 'im',
        });
      }
    }
  } catch {
    // IM source is best-effort; OKR and mail drafts should still work.
  }

  try {
    const creds = await getKvRepo('user_email_creds').get(auth.userId);
    if (creds?.smtpPassEncrypted) {
      const emailCreds = buildEmailCreds(auth.userId, creds);
      const folders = ['INBOX', 'sent'];
      for (const folder of folders) {
        const list = await fetchInbox(emailCreds, { folder, limit: 10 });
        for (const email of list.messages) {
          const t = toMs(email.date);
          if (t < startMs || t >= endMs) continue;
          const detail = await fetchMessageByUid(emailCreds, email.uid, folder).catch(() => null);
          const body = compactText(emailBodyText(detail?.textBody, detail?.htmlBody), 220);
          const from = email.from.map((item) => item.name || item.address).filter(Boolean).join(', ');
          const text = `${email.subject} ${from} ${body}`;
          const krId = pickBestKr(text, krs as any[], objectiveTitleById);
          if (!krId) continue;
          pushLine({
            krId,
            line: summarizeWorkItem({
              source: 'mail',
              subject: email.subject,
              body,
              from,
            }),
            source: 'mail',
          });
        }
      }
    }
  } catch {
    // Mail source is optional; users may not have configured IMAP.
  }

  const drafts: Record<string, string> = {};
  const sources: Record<SourceKind, number> = { okr: 0, im: 0, mail: 0 };
  for (const line of lines) {
    drafts[line.krId] = drafts[line.krId] ? `${drafts[line.krId]}\n${line.line}` : line.line;
    sources[line.source] += 1;
  }

  return NextResponse.json({ drafts, sources });
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/ai/daily-report-draft' });

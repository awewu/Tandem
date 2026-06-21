/**
 * POST /api/im/channels/:id/summary
 * 用最近 N 条消息生成 AI 智能总结 (TAF router → DeepSeek)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot, getRouter } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getChannelMessages, getChannelIfMember } from '@/lib/im/service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    // 访问控制: 仅频道成员可生成 AI 总结 (防跨频道/跨租户内容泄露).
    const channel = await getChannelIfMember(id, auth.userId, auth.tenantId);
    if (!channel) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const msgs = await getChannelMessages(id, { limit: 60 });
    if (!msgs.length) {
      return NextResponse.json({ summary: '暂无消息可总结。' });
    }

    const lines = msgs
      .filter((m) => !m.deletedAt && m.senderKind !== 'system')
      .slice(-50)
      .map((m) => `[${m.senderId}]: ${m.body}`)
      .join('\n');

    const router = getRouter();
    const resp = await router.chat({
      scenario: 'high_frequency',
      messages: [
        {
          role: 'system',
          content:
            '你是企业 IM 助手。请对以下群聊记录做简洁的中文结构化总结，输出格式：\n' +
            '**核心讨论**\n- ...\n\n**决定事项**\n- ...\n\n**待跟进**\n- ...\n\n' +
            '如无对应内容则省略该段。控制在 200 字以内。',
        },
        { role: 'user', content: lines },
      ],
      maxTokens: 400,
      temperature: 0.3,
    });

    const content = resp.message.content;
    const summary = (typeof content === 'string' ? content : '').trim() || '总结生成失败。';
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

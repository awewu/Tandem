/**
 * GET /api/me/export
 *
 * 宪章 §13.2 + §13.3 员工尊严铁律:
 *   「虽然数据归公司, 员工离职时仍可获得:
 *     - 个人成长报告 (PDF 摘要, 不含公司机密)
 *     - 述职记录摘要 (员工本人版本)
 *     - 拿捏老板使用统计 (匿名化, 用于个人简历)」
 *
 * 本端点返回员工个人 JSON bundle (V1 用 JSON; V2 追加 PDF 渲染).
 *
 * 鉴权: 需要登录 cookie (tandem_at). 只能导出自己的数据, 不能越权.
 *
 * 包含:
 *   - profile        : 基础账户信息 (不含密码/MFA secret)
 *   - persona        : 拿捏老板分身统计 (stage / decisionHistory / styleProfile / bossCaptureScore)
 *   - decisionCards  : 本人发起或拥有的议事卡
 *   - imMessagesSent : 本人发送的消息 (不含他人消息的频道上下文)
 *   - promotions     : 本人提交的 Material → Memory 升级申请
 *   - authHistory    : 本人登录/MFA 事件 (近 180 天)
 *   - growthReport   : 人读文本摘要 (适合贴进简历)
 *
 * 不包含 (公司资产):
 *   - 他人的决议 / 他人的 Persona / 他人的消息上下文
 *   - Memory 库 / Baseline 权重 / 红区审计
 *   - 同事的 TTI/KPI 数据
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { COOKIE_ACCESS, verifyAccessToken } from '@/lib/auth/session';
import { getStore } from '@/lib/storage/repository';
import { audit } from '@/lib/audit/log';

export async function GET(req: NextRequest) {
  await boot();

  // -------- 鉴权 --------
  const at = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = at ? verifyAccessToken(at) : null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }
  const userId = payload.sub;
  const store = getStore();

  // -------- profile --------
  const authUser = await store.auth.users.findById(userId);
  if (!authUser) {
    return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
  }
  const profile = {
    id: authUser.id,
    email: authUser.email,
    name: authUser.name,
    roles: authUser.roles ?? [],
    tenantId: authUser.tenantId ?? 'default',
    departmentId: authUser.departmentId ?? null,
    emailVerifiedAt: authUser.emailVerifiedAt ?? null,
    lastLoginAt: authUser.lastLoginAt ?? null,
  };

  // -------- persona (本人) --------
  const personasOfUser = await store.personas.list({ userId } as never);
  const persona = personasOfUser[0] ?? null;
  const personaView = persona
    ? {
        id: persona.id,
        stage: persona.stage,
        stageEnteredAt: persona.stageEnteredAt,
        delegationLevel: persona.delegationLevel,
        bossCaptureScore: persona.bossCaptureScore,
        decisionHistory: persona.decisionHistory,
        styleProfile: {
          decisionSpeed: persona.styleProfile.decisionSpeed,
          riskAppetite: persona.styleProfile.riskAppetite,
          communicationStyle: persona.styleProfile.communicationStyle,
          preferredOptions: persona.styleProfile.preferredOptions,
          // 沟通示例属于涉他人的上下文 — 默认裁掉. 员工如要完整版需要额外 consent.
          communicationExamplesCount: persona.styleProfile.communicationExamples.length,
        },
        growthAreas: persona.growthAreas.map((g) => ({
          category: g.category,
          description: g.description,
          status: g.status,
          identifiedAt: g.identifiedAt,
        })),
      }
    : null;

  // -------- 议事卡 (本人发起/owner) --------
  const allDCs = await store.decisionCards.list();
  const myDCs = allDCs
    .filter((dc) => dc.createdBy === userId)
    .map((dc) => ({
      id: dc.id,
      title: dc.title,
      createdAt: dc.createdAt,
      convergenceState: dc.convergenceState,
      selected: dc.selected ?? null,
      selectedAt: dc.selectedAt ?? null,
      elapsedSeconds: dc.elapsedSeconds ?? null,
      // 不导出 options 详情 (可能涉他人或敏感 Memory 引用)
    }));

  // -------- IM 发出的消息 --------
  const allChannels = await store.imChannels.list();
  const myMessages: Array<{
    channelId: string;
    channelType: string;
    messageId: string;
    createdAt: string;
    body: string;
  }> = [];
  for (const ch of allChannels) {
    const msgs = await store.imMessages.list({ channelId: ch.id } as never);
    for (const m of msgs) {
      if (m.senderId === userId && m.senderKind !== 'system') {
        myMessages.push({
          channelId: ch.id,
          channelType: ch.type,
          messageId: m.id,
          createdAt: m.createdAt,
          body: m.body,
        });
      }
    }
  }

  // -------- 本人提交的 Memory 升级申请 --------
  const allPromotions = await store.promotions.list();
  const myPromotions = allPromotions
    .filter((p) => p.createdBy === userId)
    .map((p) => ({
      id: p.id,
      proposedTitle: p.proposedTitle,
      proposedType: p.proposedType,
      status: p.status,
      level: p.level ?? null,
      createdAt: p.createdAt,
    }));

  // -------- 本人登录/MFA 历史 (近 180 天) --------
  const sinceMs = Date.now() - 180 * 86400000;
  const authHistoryRaw = await store.auth.events.list({ userId, sinceMs });
  const authHistory = authHistoryRaw
    .filter((e) =>
      ['register', 'login', 'logout', 'mfa_enrolled', 'mfa_verified', 'login_failed'].includes(
        e.eventType
      )
    )
    .map((e) => ({
      eventType: e.eventType,
      createdAt: e.createdAt,
      ip: e.ip ?? null,
      userAgent: e.userAgent ?? null,
      metadata: e.metadata ?? {},
    }));

  // -------- 人读成长报告 (可贴简历) --------
  const dRateNum =
    myDCs.length > 0
      ? myDCs.filter((d) => d.selected === 'D').length / myDCs.length
      : 0;
  const growthReport = persona
    ? [
        `Tandem 个人成长报告 · 生成于 ${new Date().toLocaleString()}`,
        ``,
        `员工: ${authUser.name}`,
        `当前阶段: ${persona.stage} (已在此阶段 ${Math.floor(
          (Date.now() - new Date(persona.stageEnteredAt).getTime()) / 86400000
        )} 天)`,
        `拿捏度: ${Math.round(persona.bossCaptureScore * 100)} / 100`,
        ``,
        `决议统计 (${myDCs.length} 条):`,
        `  - 本人拍板 (D 原创选项): ${(dRateNum * 100).toFixed(1)}% (宪章 §2 反 AI 欺诈核心指标)`,
        `  - 总否决率 (veto): ${(persona.decisionHistory.vetoRate * 100).toFixed(1)}%`,
        `  - AI 辅助: ${persona.decisionHistory.aiAssisted}`,
        ``,
        `沟通风格: ${persona.styleProfile.communicationStyle} / ${persona.styleProfile.decisionSpeed}`,
        `风险偏好: ${(persona.styleProfile.riskAppetite * 100).toFixed(0)}%`,
        ``,
        `本文基于 Tandem 决议数据自动生成, 不含公司机密.`,
        `宪章 §13.3: 员工离职时可获得本报告; 数据归公司, 尊严归员工.`,
      ].join('\n')
    : `尚未生成 persona — 完成至少 1 次议事室决议后可重新导出.`;

  // -------- 审计: 员工行使了导出权 (§13.3 "员工的合理获得物") --------
  await audit('data.export_origin', userId, {
    targetId: userId,
    targetType: 'user',
    metadata: {
      scope: 'self_export_bundle',
      dcCount: myDCs.length,
      messageCount: myMessages.length,
      promotionCount: myPromotions.length,
      authEventCount: authHistory.length,
    },
  });

  const bundle = {
    schemaVersion: 'tandem.export.v1',
    exportedAt: new Date().toISOString(),
    source: 'tandem',
    manifestoReference: 'section 13.2 + 13.3 (employee dignity floor)',
    profile,
    persona: personaView,
    decisionCards: myDCs,
    imMessagesSent: myMessages,
    promotions: myPromotions,
    authHistory,
    growthReport,
  };

  // Content-Disposition: 让浏览器触发下载
  const filename = `tandem-export-${authUser.email.replace(/[^a-z0-9]+/gi, '_')}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}

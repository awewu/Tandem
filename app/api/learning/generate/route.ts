/**
 * POST /api/learning/generate · AI 课程生成器 (P2 MVP stub)
 *
 * 输入: { sourceId, sourceType, userId, category }
 * 输出: { lecture, questions[5], summaryCard[] }
 *
 * P2 接入策略 (混合 · C3 决策):
 *   1. AI 起草 (LLM 生成讲解 + 题目)
 *   2. 人工审核 (HR/Steward 在 /admin/learning 校对)
 *
 * 当前 stub: 返回 mock 内容, 真 LLM 接入时:
 *   - scenario='reasoning_complex'
 *   - 必经 Skill Gateway 4 道闸 (P4 加固)
 *   - 课程内容是 Material 衍生包 (§7), 不入 Memory
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import type { GenerateLessonInput, GeneratedLesson } from '@/lib/learning/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, [...DATA_STEWARD_ROLES, 'champion']);
  if (forbidden) return forbidden;

  let input: GenerateLessonInput;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  if (!input.sourceId) {
    return NextResponse.json({ error: 'sourceId + userId required' }, { status: 400 });
  }

  // P2 stub: 返回示意内容
  // P3 真接入: 调 router.chatGuarded({ scenario: 'reasoning_complex', ... }) 走 4 道闸
  const generated: GeneratedLesson = {
    lecture: `[P2 MVP stub · 来源 ${input.sourceType}:${input.sourceId}]

本节将带你了解 ${input.category} 类别下的核心要点.

**第一节: 概念**
(占位文本, P3 接入 LLM 后此处由 router 流式生成 lecture 内容)

**第二节: 实操要点**
(占位文本)

**第三节: 边界与注意事项**
(占位文本)`,
    questions: [
      {
        id: 1,
        question: '在你日常工作中, 什么场景下应该召唤主分身?',
        options: [
          '需要 3+1 决策建议时',
          '所有日常工作',
          '只有 OKR 起草时',
          '只有议事室时',
        ],
        correctAnswerIdx: 0,
        explanation: '主分身的核心场景是给 3+1 决策建议. 不替员工拍板, 给员工选项.',
      },
      {
        id: 2,
        question: '主分身代行你的工作时, 你的否决窗口是多久?',
        options: ['12 小时', '24 小时', '48 小时', '永久不可否决'],
        correctAnswerIdx: 1,
        explanation: 'MANIFESTO §9.3 规定: 24 小时否决窗.',
      },
      {
        id: 3,
        question: '红区会议是否允许分身代参?',
        options: ['允许', '禁止', '需要审批后允许', '看公司政策'],
        correctAnswerIdx: 1,
        explanation: '客户/招聘/绩效/合规 类红区会议严禁分身代参 (§9.2).',
      },
      {
        id: 4,
        question: '员工与主分身的对话, 谁有权检索?',
        options: ['只有员工本人', '员工 + 上级', '员工 + Steward', '员工 + Admin'],
        correctAnswerIdx: 0,
        explanation: '默认 100% 私有 (SUMMON-AND-NURTURE § 二 4 / MANIFESTO §13.2).',
      },
      {
        id: 5,
        question: '事半板块每项任务的强制要求是?',
        options: [
          '可回溯到当前 OKR',
          '关联到一个项目',
          '指定优先级',
          '设置截止日期',
        ],
        correctAnswerIdx: 0,
        explanation: '立项 §4: 事半每项必可回溯到当前 OKR.',
      },
    ],
    summaryCard: [
      '主分身唯一身份 + 5 种技能模式 (披外套, 不切实体)',
      '关键决策必给 3+1 选项, 24h 否决窗',
      '红区会议禁止代参, 黄区需签批',
      '隐私默认私有, 沉淀公域必经签批',
      '事半每项必回溯 OKR',
    ],
  };

  return NextResponse.json({ generated, isStub: true });
}

/**
 * Anti-regression tests — Learning content integrity & progress API
 *
 * 锁死本轮"让学院活起来"的修复:
 *   - 每门 fixture 课都有真实正文 (contentMarkdown 非占位符)
 *   - 每门课都有专属题库, 每题 correctIdx 合法且选项不重复
 *   - 题库不再是 7 门课共用的同一道假题
 *   - /api/learning/progress 返回本人已完成课 + 有效认证数 (反"硬编码 0")
 */

import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { FIXTURE_LESSONS } from '@/lib/learning/fixtures';

// ── 内容完整性 (纯数据, 无需 mock) ──────────────────────────────────────────

describe('Academy fixtures · 内容完整性', () => {
  it('7 门课全部存在', () => {
    expect(FIXTURE_LESSONS.length).toBe(7);
  });

  it('每门课都有真实正文 (contentMarkdown), 不含开发占位符', () => {
    for (const l of FIXTURE_LESSONS) {
      expect(l.contentMarkdown, `${l.id} 缺正文`).toBeTruthy();
      expect(l.contentMarkdown!.length).toBeGreaterThan(80);
      // 反占位符: 旧 mock 文案不得残留
      expect(l.contentMarkdown).not.toContain('P1 mock');
      expect(l.contentMarkdown).not.toContain('待录入');
      expect(l.contentMarkdown).not.toContain('占位');
    }
  });

  it('每门课都有专属题库, 每题 correctIdx 合法、选项≥2 且无重复', () => {
    for (const l of FIXTURE_LESSONS) {
      expect(l.questions, `${l.id} 缺题库`).toBeTruthy();
      expect(l.questions!.length).toBeGreaterThanOrEqual(2);
      for (const q of l.questions!) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.correctIdx).toBeGreaterThanOrEqual(0);
        expect(q.correctIdx).toBeLessThan(q.options.length);
        expect(q.prompt.length).toBeGreaterThan(4);
        expect(q.explanation.length).toBeGreaterThan(4);
        expect(new Set(q.options).size, `${l.id} 选项重复`).toBe(q.options.length);
      }
    }
  });

  it('题库不再是所有课共用的同一道假题', () => {
    const firstPrompts = FIXTURE_LESSONS.map((l) => l.questions![0].prompt);
    expect(new Set(firstPrompts).size).toBe(firstPrompts.length);
  });

  it('每门课都设了 rewardMode (训练搭子主修闭环)', () => {
    for (const l of FIXTURE_LESSONS) {
      expect(l.rewardMode, `${l.id} 缺 rewardMode`).toBeTruthy();
      expect(l.rewardScore, `${l.id} 缺 rewardScore`).toBeGreaterThan(0);
    }
  });
});

// ── 进度 API ────────────────────────────────────────────────────────────────

const { mockStore } = vi.hoisted(() => {
  const store = {
    learningEnrollments: {
      get: vi.fn().mockResolvedValue({
        id: 'enroll_user-a',
        userId: 'user-a',
        lessonsCompleted: ['l_onboarding_culture', 'l_compliance_ethics'],
        tenantId: 'default',
        enrolledAt: '2024-01-01T00:00:00Z',
      }),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    learningCertifications: {
      list: vi.fn().mockResolvedValue([
        { id: 'c1', userId: 'user-a', lessonId: 'l1', earnedAt: '2024-01-01T00:00:00Z', tenantId: 'default' },
        { id: 'c2', userId: 'user-a', lessonId: 'l2', earnedAt: '2024-01-01T00:00:00Z', expiresAt: '2000-01-01T00:00:00Z', tenantId: 'default' },
        { id: 'c3', userId: 'user-b', lessonId: 'l3', earnedAt: '2024-01-01T00:00:00Z', tenantId: 'default' },
      ]),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockStore: store };
});

vi.mock('@/lib/boot', () => ({
  boot: vi.fn().mockResolvedValue(undefined),
  getStore: vi.fn().mockReturnValue(mockStore),
}));

vi.mock('@/lib/multi-tenant/with-tenant-scope', () => ({
  withTenantScope: vi.fn().mockImplementation((repo) => repo),
}));

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from '@/lib/auth/require-auth';
import { GET as progressGET } from '@/app/api/learning/progress/route';

function makeRequest(url: string) {
  return new NextRequest(new Request(url, { method: 'GET' }));
}

describe('/api/learning/progress', () => {
  it('返回本人已完成课 + 总认证数 + 有效认证数 (过期不计入有效)', async () => {
    vi.mocked(requireAuth).mockReturnValue({ userId: 'user-a', tenantId: 'default' } as never);
    const res = await progressGET(makeRequest('http://localhost/api/learning/progress'));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.completedLessonIds).toEqual(['l_onboarding_culture', 'l_compliance_ethics']);
    expect(json.certificationCount).toBe(2); // user-a 的 2 张 (c3 属 user-b)
    expect(json.certificationCountValid).toBe(1); // c2 已过期, 仅 c1 有效
  });

  it('未登录返回 401', async () => {
    const { NextResponse } = await import('next/server');
    vi.mocked(requireAuth).mockReturnValue(
      NextResponse.json({ error: 'unauthorized' }, { status: 401 }) as never,
    );
    const res = await progressGET(makeRequest('http://localhost/api/learning/progress'));
    expect(res.status).toBe(401);
  });
});

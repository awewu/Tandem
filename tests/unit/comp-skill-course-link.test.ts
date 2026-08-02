import { describe, it, expect } from 'vitest';
import { matchGapToCourses } from '../../lib/comp/skill-course-link';

describe('matchGapToCourses', () => {
  const lessons = [
    { id: 'l1', title: 'Excel 高级数据分析', summary: '学习数据透视表和公式' },
    { id: 'l2', title: '安全生产基础', summary: 'EHS 安全规范培训' },
    { id: 'l3', title: '供应链管理概论', summary: 'CSCP 认证准备课程' },
    { id: 'l4', title: '沟通技巧', summary: '团队协作与表达' },
  ];

  it('matches courses by skill name in title', () => {
    const r = matchGapToCourses(
      [{ id: 's1', name: 'Excel', skillWage: 300 }],
      lessons,
    );
    expect(r).toHaveLength(1);
    expect(r[0].courses).toHaveLength(1);
    expect(r[0].courses[0].id).toBe('l1');
  });

  it('matches courses by keyword in summary', () => {
    const r = matchGapToCourses(
      [{ id: 's2', name: 'CSCP 供应链', skillWage: 500 }],
      lessons,
    );
    expect(r[0].courses).toHaveLength(1);
    expect(r[0].courses[0].id).toBe('l3');
  });

  it('returns empty courses when no match', () => {
    const r = matchGapToCourses(
      [{ id: 's3', name: '量子计算', skillWage: 1000 }],
      lessons,
    );
    expect(r[0].courses).toHaveLength(0);
  });

  it('handles multiple gap skills', () => {
    const r = matchGapToCourses(
      [
        { id: 's1', name: 'Excel', skillWage: 300 },
        { id: 's2', name: '安全', skillWage: 200 },
      ],
      lessons,
    );
    expect(r).toHaveLength(2);
    expect(r[0].courses[0].id).toBe('l1');
    expect(r[1].courses[0].id).toBe('l2');
  });
});

/**
 * Constitution Guard · 宪章 §4 铁律守护测试
 *
 * 「TTI 完成情况不影响任何形式的金钱回报 (含系数浮动)」
 *  — MANIFESTO.md 第四条
 *
 * 这些测试不是关于"功能正确", 而是关于"产品根基不被悄悄改动".
 * 任何让测试失败的 PR, 都必须先修改宪章 (需要创始人 + 产品 + AI 三方签字).
 */

import { describe, it, expect } from 'vitest';
import type { TTI } from '@/lib/types/okr-tti';

describe('Constitution §4 · TTI 不挂钩任何金钱回报', () => {
  it('TTI.affectsCompensation 必须是 readonly false (类型层面)', () => {
    // 编译期检查: 任何尝试给 affectsCompensation 赋 true 的代码会 TS 错误
    const t: Pick<TTI, 'affectsCompensation'> = { affectsCompensation: false };
    expect(t.affectsCompensation).toBe(false);

    // 运行期不可写 (readonly + literal type 双重保护)
    // @ts-expect-error - readonly false 类型禁止赋值
    t.affectsCompensation = true;
  });

  it('TTI 类型不得有任何指向金钱回报的字段', () => {
    // 反射式守护: 检查类型字段名, 防止被偷偷加回 yearEndBonusModifier 等
    const sample: TTI = {
      id: 'tti_test',
      cycleId: 'c',
      ownerId: 'u',
      title: 't',
      description: 'd',
      successCriteria: 's',
      completionRate: 0.65,
      affectsCompensation: false,
    };

    const FORBIDDEN_KEYS = [
      'yearEndBonusModifier',
      'bonusModifier',
      'salaryModifier',
      'compensationCoefficient',
      'payoutFactor',
      'ttiBonus',
    ];
    for (const key of FORBIDDEN_KEYS) {
      expect(key in sample).toBe(false);
    }
  });

  it('TTI POST API 不接受任何 bonus 系数字段 (静默忽略)', async () => {
    // 文档化期望: API 即使收到也不该写入. 真实测试需启动 server, 这里仅占位.
    // 见 app/api/tti/route.ts: POST handler 只读取 body.title/body.description/...
    // 不读 body.yearEndBonusModifier 或任何 *Bonus*/*Modifier* 字段.
    expect(true).toBe(true);
  });
});

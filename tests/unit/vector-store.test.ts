/**
 * A3 · vector-store 纯逻辑 + 降级路径
 *
 * 测试环境无 DATABASE_URL 且 EMBEDDING_PROVIDER=none:
 *   - isVectorStoreEnabled() 必须 false (不触碰 DB)
 *   - searchEmbeddings() 必须返回 null (信号: 调用方回退内存 cosine/Jaccard)
 *   - upsertEmbedding()/deleteEmbedding() 必须静默 no-op, 不抛错
 * 保证: embedding 未配时全站零回归 (承 megaplan A3 验收 a)。
 */
import { describe, it, expect } from 'vitest';
import {
  formatVectorLiteral,
  distanceToSim,
  isVectorStoreEnabled,
  searchEmbeddings,
  upsertEmbedding,
  deleteEmbedding,
  __resetVectorStoreProbe,
} from '@/lib/infra/vector-store';

describe('formatVectorLiteral', () => {
  it('数组转 pgvector 字面量', () => {
    expect(formatVectorLiteral([1, 2, 3])).toBe('[1,2,3]');
    expect(formatVectorLiteral([0.5, -0.25])).toBe('[0.5,-0.25]');
    expect(formatVectorLiteral([])).toBe('[]');
  });
});

describe('distanceToSim', () => {
  it('cosine 距离转相似度 (1 - d)', () => {
    expect(distanceToSim(0)).toBe(1);
    expect(distanceToSim(1)).toBe(0);
    expect(distanceToSim(0.3)).toBeCloseTo(0.7, 5);
  });
});

describe('降级路径 (embedding 未配)', () => {
  it('isVectorStoreEnabled=false 且不抛错', async () => {
    __resetVectorStoreProbe();
    await expect(isVectorStoreEnabled()).resolves.toBe(false);
  });

  it('searchEmbeddings 返回 null (触发调用方回退)', async () => {
    const r = await searchEmbeddings({
      queryText: '年假政策',
      tenantId: 'default',
      entityType: 'shouchao_note',
      ownerId: 'u1',
    });
    expect(r).toBeNull();
  });

  it('upsertEmbedding / deleteEmbedding 静默 no-op, 不抛错', async () => {
    await expect(
      upsertEmbedding({
        entityType: 'shouchao_note',
        entityId: 'n1',
        tenantId: 'default',
        ownerId: 'u1',
        text: 'hello',
      }),
    ).resolves.toBeUndefined();
    await expect(deleteEmbedding('shouchao_note', 'n1')).resolves.toBeUndefined();
  });
});

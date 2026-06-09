/**
 * Launchpad Service · PRD §3.7
 *
 * - Visibility filter (department + role)
 * - Click recording + stats
 * - AI today recommendation: match user's active KRs/Initiatives keywords against
 *   each app's recommendKeywords + name + description (embedding cosine, jaccard fallback).
 * - Credential vault: AES-256-GCM encrypt/decrypt for stored credentials.
 *   Requires LAUNCHPAD_VAULT_KEY env (32-byte hex). Without it, vault stores cleartext+warning.
 */

import crypto from 'node:crypto';
import type { ApplicationContext } from '@/lib/repositories/app-context';
import type {
  LaunchpadApp,
  LaunchpadAppWithBadge,
  LaunchpadCategory,
  LaunchpadStats,
} from '@/lib/types/launchpad';
import { embed, cosineSim, isEmbeddingConfigured } from '@/lib/infra/embedding';
import { logger } from '@/lib/infra/logger';
import { getStore } from '@/lib/boot';
import { isAppVisibleTo, type ViewerCtx } from './launchpad-visibility';

const RECOMMEND_TOP_N = 3;
const RECOMMEND_MIN_SCORE = 0.18;

// ---------------------------------------------------------------------------
// Visibility (纯逻辑已抽到 launchpad-visibility.ts, 此处 re-export 保持向后兼容)
// ---------------------------------------------------------------------------

export { isAppVisibleTo, type ViewerCtx };

// ---------------------------------------------------------------------------
// Credential vault (AES-256-GCM)
// ---------------------------------------------------------------------------

function vaultKey(): Buffer | null {
  const raw = process.env.LAUNCHPAD_VAULT_KEY;
  if (!raw) return null;
  try {
    const buf = Buffer.from(raw, 'hex');
    if (buf.length !== 32) return null;
    return buf;
  } catch {
    return null;
  }
}

export function encryptCredential(plain: string): { ciphertext: string; iv: string; tag: string; encrypted: boolean } {
  const key = vaultKey();
  if (!key) {
    logger.warn({ msg: 'launchpad.vault.no_key', hint: 'set LAUNCHPAD_VAULT_KEY to 32-byte hex' });
    return { ciphertext: plain, iv: '', tag: '', encrypted: false };
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: enc.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64'), encrypted: true };
}

export function decryptCredential(blob: { ciphertext: string; iv: string; tag: string; encrypted: boolean }): string | null {
  if (!blob.encrypted) return blob.ciphertext;
  const key = vaultKey();
  if (!key) return null;
  try {
    const iv = Buffer.from(blob.iv, 'base64');
    const tag = Buffer.from(blob.tag, 'base64');
    const ct = Buffer.from(blob.ciphertext, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch (err) {
    logger.error({ msg: 'launchpad.vault.decrypt_failed', err: String(err) });
    return null;
  }
}

// ---------------------------------------------------------------------------
// AI recommendation
// ---------------------------------------------------------------------------

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  return inter / (a.size + b.size - inter);
}

async function buildUserIntentText(userId: string): Promise<string> {
  try {
    const store = getStore();
    const [krs, inits] = await Promise.all([
      store.keyResults.list(),
      store.initiatives.list(),
    ]);
    const myKrs = krs.filter((k) => k.ownerId === userId).slice(0, 10);
    const myInits = inits.filter((i) => i.ownerId === userId && i.status !== 'done').slice(0, 10);
    const text = [
      ...myKrs.map((k) => k.title ?? ''),
      ...myInits.map((i) => i.title ?? ''),
    ]
      .filter(Boolean)
      .join(' · ');
    return text;
  } catch (err) {
    logger.warn({ msg: 'launchpad.recommend.intent_failed', err: String(err) });
    return '';
  }
}

function appCorpus(app: LaunchpadApp): string {
  return [app.name, app.description ?? '', ...app.recommendKeywords].join(' ');
}

export async function recommendApps(
  apps: LaunchpadApp[],
  userId: string,
): Promise<Map<string, { score: number; reason: string }>> {
  const out = new Map<string, { score: number; reason: string }>();
  const intent = await buildUserIntentText(userId);
  if (!intent) return out;

  // Try embedding first
  if (isEmbeddingConfigured()) {
    try {
      const intentVec = await embed(intent);
      if (intentVec) {
        const scored = await Promise.all(
          apps.map(async (a) => {
            const v = await embed(appCorpus(a));
            const score = v ? cosineSim(intentVec, v) : 0;
            return { id: a.id, score, name: a.name };
          }),
        );
        scored
          .filter((s) => s.score >= RECOMMEND_MIN_SCORE)
          .sort((a, b) => b.score - a.score)
          .slice(0, RECOMMEND_TOP_N)
          .forEach((s) =>
            out.set(s.id, { score: s.score, reason: `与你当前 OKR 高度相关 · 语义相似度 ${(s.score * 100).toFixed(0)}%` }),
          );
        if (out.size > 0) return out;
      }
    } catch (err) {
      logger.warn({ msg: 'launchpad.recommend.embed_failed', err: String(err) });
    }
  }

  // Fallback: jaccard
  const intentTokens = tokenize(intent);
  apps
    .map((a) => ({ id: a.id, score: jaccard(intentTokens, tokenize(appCorpus(a))) }))
    .filter((s) => s.score >= RECOMMEND_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, RECOMMEND_TOP_N)
    .forEach((s) => out.set(s.id, { score: s.score, reason: `关键词命中 · 与 OKR/AP 共享 ${(s.score * 100).toFixed(0)}% 词汇` }));

  return out;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LaunchpadService {
  constructor(private ctx: ApplicationContext) {}

  async listAdmin(filter?: { tenantId?: string; category?: LaunchpadCategory }): Promise<LaunchpadApp[]> {
    return this.ctx.launchpadRepo.listApps({ ...filter, status: 'any' });
  }

  /** 为用户构建可见的卡片列表 + 推荐分数 + 角标 */
  async listForViewer(viewer: ViewerCtx): Promise<LaunchpadAppWithBadge[]> {
    const all = await this.ctx.launchpadRepo.listApps({ tenantId: viewer.tenantId, status: 'active' });
    const visible = all.filter((a) => isAppVisibleTo(a, viewer));
    const recommendations = await recommendApps(visible, viewer.userId);
    return visible.map((app) => {
      const rec = recommendations.get(app.id);
      return {
        ...app,
        recommendScore: rec?.score,
        recommendReason: rec?.reason,
      };
    });
  }

  async create(draft: Omit<LaunchpadApp, 'id' | 'createdAt' | 'updatedAt'>): Promise<LaunchpadApp> {
    return this.ctx.launchpadRepo.createApp(draft);
  }

  async update(id: string, patch: Partial<Omit<LaunchpadApp, 'id' | 'createdAt'>>): Promise<LaunchpadApp> {
    return this.ctx.launchpadRepo.updateApp(id, patch);
  }

  async delete(id: string): Promise<void> {
    return this.ctx.launchpadRepo.deleteApp(id);
  }

  async reorder(orderMap: Array<{ id: string; order: number }>): Promise<void> {
    return this.ctx.launchpadRepo.reorderApps(orderMap);
  }

  /** Record click; return target URL (for SSO substitution later) */
  async click(appId: string, viewer: ViewerCtx, source = 'home'): Promise<{ url: string } | null> {
    const app = await this.ctx.launchpadRepo.findAppById(appId);
    if (!app) return null;
    if (!isAppVisibleTo(app, viewer)) return null;
    await this.ctx.launchpadRepo.recordClick({
      appId: app.id,
      userId: viewer.userId,
      source,
      tenantId: viewer.tenantId,
    });
    return { url: app.url };
  }

  async stats(tenantId?: string): Promise<LaunchpadStats[]> {
    return this.ctx.launchpadRepo.statsAll(tenantId);
  }
}

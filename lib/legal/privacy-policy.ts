import fs from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import { getStore } from '@/lib/storage/repository';
import type { LegalDocument } from '@/lib/types/legal-document';

export const PRIVACY_POLICY_ID = 'legal_default_privacy_policy';
export const LEGAL_DOCUMENT_TENANT = 'default';

const LOCAL_POLICY_PATH = ['docs', 'PRIVACY-POLICY.md'];
const DEFAULT_REMOTE_TIMEOUT_MS = 5000;

export interface EffectivePrivacyPolicy {
  title: string;
  contentMarkdown: string;
  source: 'database' | 'remote' | 'local' | 'empty';
  updatedAt?: string;
}

function trimMarkdown(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isProbablyMojibake(text: string): boolean {
  const sample = text.slice(0, 4000);
  const replacementCount = (sample.match(/\uFFFD/g) ?? []).length;
  const mojibakeCount = (sample.match(/[ÃÂ]|(?:å|æ|ç|é|è|ä|ã)[\u0080-\u00ff]/g) ?? []).length;
  return replacementCount >= 2 || mojibakeCount >= 8;
}

function decodePolicyBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('gb18030').decode(bytes);
  }
}

async function loadLocalPrivacyPolicy(): Promise<string | null> {
  const filePath = path.join(process.cwd(), ...LOCAL_POLICY_PATH);
  try {
    const bytes = await fs.readFile(filePath);
    const text = decodePolicyBytes(bytes);
    return trimMarkdown(text) || null;
  } catch {
    return null;
  }
}

async function loadRemotePrivacyPolicy(): Promise<string | null> {
  const sourceUrl = process.env.PRIVACY_POLICY_SOURCE_URL?.trim();
  if (!sourceUrl) return null;

  try {
    const url = new URL(sourceUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;

    const configuredTimeout = Number(process.env.PRIVACY_POLICY_SOURCE_TIMEOUT_MS ?? DEFAULT_REMOTE_TIMEOUT_MS);
    const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : DEFAULT_REMOTE_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { Accept: 'text/markdown,text/plain,*/*' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return trimMarkdown(await res.text()) || null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

async function getStoredPrivacyPolicy(): Promise<LegalDocument | null> {
  try {
    const doc = await getStore().legalDocuments.get(PRIVACY_POLICY_ID);
    const content = trimMarkdown(doc?.contentMarkdown);
    return content && !isProbablyMojibake(content) ? doc : null;
  } catch {
    return null;
  }
}

export async function getEffectivePrivacyPolicy(): Promise<EffectivePrivacyPolicy> {
  const stored = await getStoredPrivacyPolicy();
  if (stored) {
    return {
      title: stored.title || '隐私政策',
      contentMarkdown: stored.contentMarkdown,
      source: 'database',
      updatedAt: stored.updatedAt,
    };
  }

  const remote = await loadRemotePrivacyPolicy();
  if (remote) {
    return { title: '隐私政策', contentMarkdown: remote, source: 'remote' };
  }

  const local = await loadLocalPrivacyPolicy();
  if (local) {
    return { title: '隐私政策', contentMarkdown: local, source: 'local' };
  }

  return {
    title: '隐私政策',
    contentMarkdown: '# 隐私政策\n\n隐私政策文件暂不可读, 请联系管理员.',
    source: 'empty',
  };
}

export async function getAdminPrivacyPolicy(): Promise<EffectivePrivacyPolicy & { id: string }> {
  const effective = await getEffectivePrivacyPolicy();
  return { id: PRIVACY_POLICY_ID, ...effective };
}

export async function upsertPrivacyPolicy(
  input: { title?: unknown; contentMarkdown?: unknown },
  updatedBy: string,
): Promise<LegalDocument> {
  const title = typeof input.title === 'string' && input.title.trim()
    ? input.title.trim()
    : '隐私政策';
  const contentMarkdown = trimMarkdown(input.contentMarkdown);
  if (!contentMarkdown) {
    throw new Error('隐私政策内容不能为空');
  }

  const store = getStore();
  const now = new Date().toISOString();
  const existing = await store.legalDocuments.get(PRIVACY_POLICY_ID);
  const patch = {
    tenantId: LEGAL_DOCUMENT_TENANT,
    slug: 'privacy-policy' as const,
    title,
    contentMarkdown,
    updatedBy,
    updatedAt: now,
    publishedAt: now,
  };

  if (existing) {
    return store.legalDocuments.update(PRIVACY_POLICY_ID, patch);
  }

  return store.legalDocuments.create({
    id: PRIVACY_POLICY_ID,
    ...patch,
    createdAt: now,
  });
}

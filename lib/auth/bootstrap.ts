/**
 * Bootstrap · 首次启动初始化
 *
 * 1. 若 store 内无 owner 用户, 创建一个 (基于 .env.local TANDEM_BOOTSTRAP_*).
 * 2. 用于自托管部署: 客户拿到 binary 第一次起来就有 owner.
 *
 * 安全:
 *   - 仅当 owner 不存在才创建 (幂等)
 *   - 默认密码强制下次登录改密
 *   - 无 env 时跳过 (生产手动初始化)
 */

import { getStore } from '../storage/repository';
import { hashPassword } from './password';
import { audit } from '../audit/log';
import { OWNER_BOOTSTRAP_ROLES } from './roles';
import { ANCHOR_ORG_ID } from '../types/organization';

/**
 * 幂等创建上游本部组织 (anchor) · 企业微信「上下游」模型的根节点.
 * 固定 id (ANCHOR_ORG_ID) → 可重入 + 历史 default 租户用户回填时确定性引用.
 * 任何启动路径 (有/无 bootstrap owner env) 都应保证 anchor 存在.
 */
export async function ensureAnchorOrg(): Promise<void> {
  try {
    const store = getStore();
    if (!store.organizations) return;
    const existing = await store.organizations.get(ANCHOR_ORG_ID);
    if (existing) return;
    const name = process.env.TANDEM_BOOTSTRAP_ORG_NAME ?? process.env.TANDEM_BOOTSTRAP_OWNER_NAME ?? '本部';
    await store.organizations.create({
      id: ANCHOR_ORG_ID,
      name,
      type: 'anchor',
      parentOrgId: null,
      tenantId: 'default',
      status: 'active',
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[bootstrap] 初始化 anchor 组织失败:', err);
  }
}

export async function bootstrapOwnerIfMissing(): Promise<void> {
  try {
    // 先确保上游本部组织存在 (与是否创建 owner 无关)
    await ensureAnchorOrg();

    const email = process.env.TANDEM_BOOTSTRAP_OWNER_EMAIL;
    const password = process.env.TANDEM_BOOTSTRAP_OWNER_PASSWORD;
    const name = process.env.TANDEM_BOOTSTRAP_OWNER_NAME ?? 'Owner';
    if (!email || !password) return;

    const store = getStore();
    if (!store.auth) return;

    // 已存在任意 owner → 跳过
    const existing = await store.auth.users.findByEmail(email);
    if (existing) return;

    const user = await store.auth.users.create({
      email,
      name,
      roles: [...OWNER_BOOTSTRAP_ROLES],
      tenantId: 'default',
      orgId: ANCHOR_ORG_ID,
      membershipType: 'internal',
      emailVerifiedAt: new Date().toISOString(),
    });
    await store.auth.users.savePasswordHash(user.id, hashPassword(password));

    await store.auth.events.append({
      userId: user.id,
      email: user.email,
      eventType: 'bootstrap_owner_created',
    });

    await audit('system.provider_switch', 'system', {
      targetType: 'auth',
      metadata: { event: 'bootstrap_owner_created', email: user.email },
    });

    // eslint-disable-next-line no-console
    console.warn(`[bootstrap] 已创建 owner: ${email}. 强烈建议: 首次登录后立即改密 + 启用 MFA.`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[bootstrap] 初始化 owner 失败:', err);
  }
}

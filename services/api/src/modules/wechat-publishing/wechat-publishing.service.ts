import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { DataSource, In, Repository } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { FileArtifactService } from '../file-artifact/file-artifact.service';
import {
  WechatContentReviewVersionEntity,
  WechatDraftSyncTaskEntity,
  WechatOfficialAccountEntity,
  WechatPublishAuditEventEntity,
} from './wechat-publishing.entity';

const REVIEW_STATUSES = new Set(['pending_review', 'changes_requested', 'approved', 'voided']);
const WECHAT_API_BASE = 'https://api.weixin.qq.com/cgi-bin';
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ALLOWED_HTML_TAGS = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li',
  'blockquote', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

function text(value: unknown, fallback = '') {
  return String(value ?? fallback).trim();
}

function nullableText(value: unknown) {
  const result = text(value);
  return result ? result : null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashJson(value: unknown) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function maskAppId(appId: string) {
  if (appId.length <= 8) return `${appId.slice(0, 2)}****`;
  return `${appId.slice(0, 4)}****${appId.slice(-4)}`;
}

function encryptSecret(secret: string) {
  return `local:v1:${Buffer.from(secret, 'utf8').toString('base64')}`;
}

function decryptSecret(ciphertext: string) {
  if (!ciphertext.startsWith('local:v1:')) {
    throw new BadRequestException('unsupported app secret storage format');
  }
  return Buffer.from(ciphertext.slice('local:v1:'.length), 'base64').toString('utf8');
}

function mapWechatTokenError(errcode: number, errmsg: string) {
  if ([40013, 40125, 41002, 41004].includes(errcode)) {
    return { status: 'credential_error' as const, message: 'AppID or AppSecret is invalid. Reset AppSecret in WeChat Developer Platform and retry.' };
  }
  if (errcode === 40164) {
    return { status: 'ip_whitelist_error' as const, message: 'Backend public IP is not in WeChat API IP whitelist. Add it in WeChat Developer Platform and retry.' };
  }
  if ([48001, 50001].includes(errcode)) {
    return { status: 'permission_error' as const, message: 'Official Account API permission is unavailable for this account.' };
  }
  return { status: 'temporary_error' as const, message: `WeChat API returned ${errcode || 'an error'}: ${errmsg || 'unknown error'}` };
}

function assertAllowedHtml(html: string) {
  const tags = Array.from(html.matchAll(/<\/?\s*([a-zA-Z0-9-]+)/g)).map((match) => match[1].toLowerCase());
  const unsupported = tags.filter((tag) => !ALLOWED_HTML_TAGS.has(tag));
  if (unsupported.length) {
    throw new BadRequestException(`unsupported html tags: ${Array.from(new Set(unsupported)).join(', ')}`);
  }
  if (/javascript:/i.test(html) || /<\s*(script|iframe|style|video|audio|form)\b/i.test(html)) {
    throw new BadRequestException('content contains unsupported interactive or unsafe structure');
  }
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>> : [];
}

@Injectable()
export class WechatPublishingService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(WechatOfficialAccountEntity) private readonly accounts: Repository<WechatOfficialAccountEntity>,
    @InjectRepository(WechatContentReviewVersionEntity) private readonly versions: Repository<WechatContentReviewVersionEntity>,
    @InjectRepository(WechatDraftSyncTaskEntity) private readonly tasks: Repository<WechatDraftSyncTaskEntity>,
    @InjectRepository(WechatPublishAuditEventEntity) private readonly audit: Repository<WechatPublishAuditEventEntity>,
    private readonly files: FileArtifactService,
  ) {}

  async listAccounts(user: JwtPayload) {
    const items = await this.accounts.find({ where: { tenantId: user.tenantId }, order: { createdAt: 'DESC' } });
    return { items: items.map((item) => this.accountDto(item)) };
  }

  async createAccount(user: JwtPayload, body: any) {
    const displayName = text(body.displayName);
    const brandId = text(body.brandId);
    const appId = text(body.appId);
    const appSecret = text(body.appSecret);
    const originalId = nullableText(body.originalId);
    if (!displayName || !brandId || !appId || !appSecret) {
      throw new BadRequestException('displayName, brandId, appId and appSecret are required');
    }
    const account = await this.accounts.save(this.accounts.create({
      tenantId: user.tenantId,
      brandId,
      displayName,
      appId,
      originalId,
      appSecretCiphertext: encryptSecret(appSecret),
      status: 'disabled',
      connectionStatus: 'untested',
      connectionErrorSummary: null,
      createdBy: user.userId,
      updatedBy: user.userId,
    }));
    await this.record(user, 'wechat_account.created', 'wechat_official_account', account.id, null, this.accountDto(account));
    return { account: this.accountDto(account) };
  }

  async updateSecret(user: JwtPayload, id: string, body: any) {
    const account = await this.getAccount(user, id);
    const appSecret = text(body.appSecret);
    if (!appSecret) throw new BadRequestException('appSecret is required');
    const before = this.accountDto(account);
    account.appSecretCiphertext = encryptSecret(appSecret);
    account.status = 'disabled';
    account.connectionStatus = 'untested';
    account.connectionErrorSummary = null;
    account.lastTestedAt = null;
    account.updatedBy = user.userId;
    const saved = await this.accounts.save(account);
    await this.record(user, 'wechat_account.secret_updated', 'wechat_official_account', saved.id, before, this.accountDto(saved));
    return { account: this.accountDto(saved) };
  }

  async updateAccount(user: JwtPayload, id: string, body: any) {
    const account = await this.getAccount(user, id);
    const displayName = text(body.displayName);
    const brandId = text(body.brandId);
    const originalId = nullableText(body.originalId);
    if (!displayName || !brandId) throw new BadRequestException('displayName and brandId are required');
    const before = this.accountDto(account);
    account.displayName = displayName;
    account.brandId = brandId;
    account.originalId = originalId;
    account.updatedBy = user.userId;
    const saved = await this.accounts.save(account);
    await this.record(user, 'wechat_account.updated', 'wechat_official_account', saved.id, before, this.accountDto(saved));
    return { account: this.accountDto(saved) };
  }

  async updateStatus(user: JwtPayload, id: string, body: any) {
    const account = await this.getAccount(user, id);
    const status = text(body.status);
    if (!['enabled', 'disabled'].includes(status)) throw new BadRequestException('status must be enabled or disabled');
    if (status === 'enabled' && account.connectionStatus !== 'normal') {
      throw new BadRequestException('connection test must be normal before enabling account');
    }
    const before = this.accountDto(account);
    account.status = status as 'enabled' | 'disabled';
    account.updatedBy = user.userId;
    const saved = await this.accounts.save(account);
    await this.record(user, `wechat_account.${status}`, 'wechat_official_account', saved.id, before, this.accountDto(saved));
    return { account: this.accountDto(saved) };
  }

  async testConnection(user: JwtPayload, id: string) {
    const account = await this.getAccount(user, id);
    const before = this.accountDto(account);
    const result = await this.testWechatAccessToken(account.appId, decryptSecret(account.appSecretCiphertext));
    account.connectionStatus = result.status;
    account.connectionErrorSummary = result.status === 'normal' ? null : result.message;
    account.lastTestedAt = new Date();
    account.updatedBy = user.userId;
    const saved = await this.accounts.save(account);
    await this.record(user, 'wechat_account.connection_tested', 'wechat_official_account', saved.id, before, this.accountDto(saved));
    return {
      status: saved.connectionStatus,
      message: result.message,
      account: this.accountDto(saved),
    };
  }

  async availableAccounts(user: JwtPayload, brandId: string) {
    const items = await this.accounts.find({
      where: { tenantId: user.tenantId, brandId, status: 'enabled', connectionStatus: 'normal' },
      order: { displayName: 'ASC' },
    });
    return { items: items.map((item) => this.accountDto(item)) };
  }

  async createReviewVersion(user: JwtPayload, body: any) {
    const account = await this.getAccount(user, text(body.accountId));
    if (account.status !== 'enabled' || account.connectionStatus !== 'normal') {
      throw new BadRequestException('selected account is not enabled and normal');
    }
    const payload = this.normalizeWechatPayload(body);
    if (text(body.brandId) !== account.brandId) throw new BadRequestException('brand and account binding mismatch');
    const pending = await this.versions
      .createQueryBuilder('version')
      .where('version.tenantId = :tenantId', { tenantId: user.tenantId })
      .andWhere('version.sourceContentId = :sourceContentId', { sourceContentId: text(body.sourceContentId) })
      .andWhere('version.reviewStatus = :status', { status: 'pending_review' })
      .andWhere("version.targetSnapshot ->> 'accountId' = :accountId", { accountId: account.id })
      .getOne();
    if (pending) return { version: this.versionDto(pending), duplicate: true };
    const last = await this.versions.findOne({
      where: { tenantId: user.tenantId, sourceContentId: text(body.sourceContentId) },
      order: { versionNo: 'DESC' },
    });
    const targetSnapshot = {
      brandId: account.brandId,
      brandName: text(body.brandName, account.brandId),
      accountId: account.id,
      accountName: account.displayName,
      maskedAppId: maskAppId(account.appId),
    };
    const version = await this.versions.save(this.versions.create({
      tenantId: user.tenantId,
      sourceContentId: text(body.sourceContentId),
      versionNo: (last?.versionNo || 0) + 1,
      reviewStatus: 'pending_review',
      wechatPayload: payload,
      reviewContentHash: hashJson(payload),
      wechatPayloadHash: hashJson(payload),
      assetSnapshots: asArray(body.assetSnapshots),
      targetSnapshot,
      submitterId: user.userId,
      reviewerId: null,
      reviewComment: null,
      submittedAt: new Date(),
    }));
    await this.record(user, 'content_review.submitted', 'wechat_content_review_version', version.id, null, this.versionDto(version));
    return { version: this.versionDto(version) };
  }

  async listPending(user: JwtPayload, query: any = {}) {
    const items = await this.versions.find({
      where: { tenantId: user.tenantId, reviewStatus: 'pending_review' },
      order: { submittedAt: 'DESC' },
    });
    const filtered = items.filter((item) => {
      const target = item.targetSnapshot || {};
      if (query.brandId && target.brandId !== query.brandId) return false;
      if (query.accountId && target.accountId !== query.accountId) return false;
      if (query.submitterId && item.submitterId !== query.submitterId) return false;
      return true;
    });
    return { items: filtered.map((item) => this.versionDto(item)) };
  }

  async getVersion(user: JwtPayload, id: string) {
    const version = await this.versions.findOne({ where: { tenantId: user.tenantId, id } });
    if (!version) throw new NotFoundException('review version not found');
    return { version: this.versionDto(version) };
  }

  async approve(user: JwtPayload, id: string, body: any) {
    return this.ds.transaction(async (manager) => {
      const repo = manager.getRepository(WechatContentReviewVersionEntity);
      const taskRepo = manager.getRepository(WechatDraftSyncTaskEntity);
      const version = await repo.findOne({ where: { tenantId: user.tenantId, id } });
      if (!version) throw new NotFoundException('review version not found');
      if (version.reviewStatus !== 'pending_review') throw new BadRequestException('review version is not pending');
      const currentPayloadHash = hashJson(version.wechatPayload);
      if (version.reviewContentHash !== currentPayloadHash) {
        if (process.env.WECHAT_REVIEW_STRICT_HASH === 'true') {
          throw new BadRequestException('review content hash mismatch');
        }
        version.reviewContentHash = currentPayloadHash;
        version.wechatPayloadHash = currentPayloadHash;
      }
      const target = version.targetSnapshot as any;
      const account = await manager.getRepository(WechatOfficialAccountEntity).findOne({
        where: { tenantId: user.tenantId, id: target.accountId },
      });
      if (!account || account.status !== 'enabled' || account.brandId !== target.brandId) {
        throw new BadRequestException('target account is unavailable');
      }
      version.reviewStatus = 'approved';
      version.reviewerId = user.userId;
      version.reviewComment = nullableText(body.comment);
      version.reviewedAt = new Date();
      const saved = await repo.save(version);
      const task = await taskRepo.save(taskRepo.create({
        tenantId: user.tenantId,
        reviewVersionId: saved.id,
        accountId: account.id,
        idempotencyKey: `wechat-draft:${saved.id}`,
        syncStatus: 'queued',
        attempts: 0,
        materialMapping: {},
      }));
      await manager.getRepository(WechatPublishAuditEventEntity).save({
        tenantId: user.tenantId,
        actorId: user.userId,
        eventType: 'content_review.approved',
        objectType: 'wechat_content_review_version',
        objectId: saved.id,
        beforeState: { reviewStatus: 'pending_review' },
        afterState: { reviewStatus: 'approved', taskId: task.id },
        metadata: {},
      });
      return { version: this.versionDto(saved), task: this.taskDto(task) };
    });
  }

  async requestChanges(user: JwtPayload, id: string, body: any) {
    return this.finishReview(user, id, 'changes_requested', 'content_review.changes_requested', body.reason);
  }

  async voidVersion(user: JwtPayload, id: string, body: any) {
    return this.finishReview(user, id, 'voided', 'content_review.voided', body.reason);
  }

  async listTasks(user: JwtPayload) {
    const tasks = await this.tasks.find({ where: { tenantId: user.tenantId }, order: { createdAt: 'DESC' } });
    const visibleTasks = tasks.filter((task) => task.syncStatus !== 'superseded');
    const versionIds = visibleTasks.map((task) => task.reviewVersionId);
    const versions = versionIds.length ? await this.versions.find({ where: { tenantId: user.tenantId, id: In(versionIds) } }) : [];
    const versionMap = new Map(versions.map((version) => [version.id, version]));
    return { items: visibleTasks.map((task) => this.taskDto(task, versionMap.get(task.reviewVersionId))) };
  }

  async getTask(user: JwtPayload, id: string) {
    const task = await this.tasks.findOne({ where: { tenantId: user.tenantId, id } });
    if (!task) throw new NotFoundException('sync task not found');
    const version = await this.versions.findOne({ where: { tenantId: user.tenantId, id: task.reviewVersionId } });
    return { task: this.taskDto(task, version || undefined) };
  }

  async addTaskNote(user: JwtPayload, id: string, body: any) {
    const task = await this.tasks.findOne({ where: { tenantId: user.tenantId, id } });
    if (!task) throw new NotFoundException('sync task not found');
    task.manualHandlerId = user.userId;
    task.manualHandledAt = new Date();
    task.manualNote = text(body.note);
    const saved = await this.tasks.save(task);
    await this.record(user, 'draft_sync.manual_note', 'wechat_draft_sync_task', saved.id, null, { note: saved.manualNote });
    return { task: this.taskDto(saved) };
  }

  async processQueuedTasks(user: JwtPayload, limit = 10) {
    const queued = await this.tasks
      .createQueryBuilder('task')
      .where('task.tenantId = :tenantId', { tenantId: user.tenantId })
      .andWhere("(task.syncStatus IN (:...statuses) OR task.wechatDraftId LIKE 'mock-draft-%')", {
        statuses: ['queued', 'unconfirmed'],
      })
      .orderBy('task.createdAt', 'ASC')
      .take(limit)
      .getMany();
    const results: Array<Record<string, unknown>> = [];
    for (const task of queued) {
      results.push(await this.processTask(task));
    }
    return { processed: results.length, results };
  }

  private async processTask(task: WechatDraftSyncTaskEntity) {
    task.syncStatus = 'syncing';
    task.startedAt = new Date();
    task.attempts += 1;
    await this.tasks.save(task);
    const version = await this.versions.findOne({ where: { tenantId: task.tenantId, id: task.reviewVersionId } });
    if (!version) {
      task.syncStatus = 'failed';
      task.errorType = 'content';
      task.errorSummary = '审核版本不存在';
    } else {
      const account = await this.accounts.findOne({ where: { tenantId: task.tenantId, id: task.accountId } });
      if (!account || account.status !== 'enabled' || account.connectionStatus !== 'normal') {
        task.syncStatus = 'failed';
        task.errorType = 'account';
        task.errorSummary = '目标公众号不可用，请先测试连接并启用账号';
      } else {
        try {
          const result = await this.createWechatDraft(task.tenantId, account, version.wechatPayload as any);
          task.syncStatus = 'succeeded';
          task.wechatDraftId = result.draftMediaId;
          task.materialMapping = result.materialMapping;
          task.errorType = null;
          task.errorSummary = null;
        } catch (error) {
          task.syncStatus = 'failed';
          task.errorType = 'wechat_api';
          task.errorSummary = (error as Error).message || '微信草稿同步失败';
        }
      }
    }
    task.finishedAt = new Date();
    const saved = await this.tasks.save(task);
    if (saved.syncStatus === 'succeeded') {
      await this.accounts.update({ tenantId: saved.tenantId, id: saved.accountId }, { lastSuccessfulSyncAt: new Date() });
    }
    await this.audit.save({
      tenantId: saved.tenantId,
      actorId: null,
      eventType: `draft_sync.${saved.syncStatus}`,
      objectType: 'wechat_draft_sync_task',
      objectId: saved.id,
      beforeState: { syncStatus: 'syncing' },
      afterState: { syncStatus: saved.syncStatus, wechatDraftId: saved.wechatDraftId },
      metadata: { traceId: saved.traceId },
    });
    return this.taskDto(saved, version || undefined);
  }

  private async finishReview(user: JwtPayload, id: string, status: 'changes_requested' | 'voided', eventType: string, reason: unknown) {
    const version = await this.versions.findOne({ where: { tenantId: user.tenantId, id } });
    if (!version) throw new NotFoundException('review version not found');
    if (version.reviewStatus !== 'pending_review') throw new BadRequestException('review version is not pending');
    const comment = text(reason);
    if (!comment) throw new BadRequestException('reason is required');
    const before = this.versionDto(version);
    version.reviewStatus = status;
    version.reviewerId = user.userId;
    version.reviewComment = comment;
    version.reviewedAt = new Date();
    const saved = await this.versions.save(version);
    await this.record(user, eventType, 'wechat_content_review_version', saved.id, before, this.versionDto(saved));
    return { version: this.versionDto(saved) };
  }

  private normalizeWechatPayload(body: any) {
    const sourceContentId = text(body.sourceContentId);
    const title = text(body.title);
    const digest = text(body.digest);
    const contentHtml = text(body.contentHtml);
    const coverImage = body.coverImage && typeof body.coverImage === 'object' ? body.coverImage : null;
    if (!sourceContentId || !title || !digest || !contentHtml || !coverImage) {
      throw new BadRequestException('sourceContentId, title, digest, contentHtml and coverImage are required');
    }
    assertAllowedHtml(contentHtml);
    return {
      title,
      digest,
      author: text(body.author, 'Rhautt Comfort'),
      contentHtml,
      sourceUrl: nullableText(body.sourceUrl),
      coverImage,
      bodyImages: asArray(body.bodyImages),
    };
  }

  private async getAccount(user: JwtPayload, id: string) {
    const account = await this.accounts.findOne({ where: { tenantId: user.tenantId, id } });
    if (!account) throw new NotFoundException('wechat account not found');
    return account;
  }

  private syncUser(tenantId: string): JwtPayload {
    return {
      tenantId,
      userId: '00000000-0000-4000-8000-000000000000',
      dealerId: null,
      storeId: null,
      customerId: null,
      role: 'system',
      permissions: [],
      roles: ['system'],
    };
  }

  private async createWechatDraft(tenantId: string, account: WechatOfficialAccountEntity, payload: any) {
    const token = await this.fetchWechatAccessToken(account.appId, decryptSecret(account.appSecretCiphertext));
    const coverAssetId = text(payload.coverImage?.assetId);
    const cover = UUID_RE.test(coverAssetId) ? await this.files.getReadableById(this.syncUser(tenantId), coverAssetId) : null;
    const coverUpload = cover && String(cover.row.mimeType || '').toLowerCase().startsWith('image/')
      ? {
          filename: String(cover.row.originalName || 'cover.png'),
          mimeType: String(cover.row.mimeType || 'image/png').toLowerCase(),
          buffer: cover.buffer,
          source: 'file_artifact',
        }
      : {
          filename: 'wechat-mvp-cover.png',
          mimeType: 'image/png',
          buffer: await this.generateFallbackCover(text(payload.title)),
          source: 'generated_fallback',
        };

    const thumb = await this.uploadWechatPermanentMaterial(token, {
      type: 'thumb',
      filename: coverUpload.filename,
      mimeType: coverUpload.mimeType,
      buffer: coverUpload.buffer,
    });
    const draft = await this.addWechatDraft(token, {
      title: text(payload.title),
      author: text(payload.author, 'Rhautt Comfort'),
      digest: text(payload.digest),
      content: text(payload.contentHtml),
      contentSourceUrl: nullableText(payload.sourceUrl),
      thumbMediaId: thumb.mediaId,
    });
    return {
      draftMediaId: draft.mediaId,
      materialMapping: {
        coverAssetId,
        coverSource: coverUpload.source,
        thumbMediaId: thumb.mediaId,
        draftMediaId: draft.mediaId,
      },
    };
  }

  private async generateFallbackCover(title: string) {
    const safeTitle = title || '微信公众号草稿';
    const lines = safeTitle.match(/.{1,18}/g)?.slice(0, 3) || ['微信公众号草稿'];
    const escapedLines = lines.map((line) => line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;'));
    const svg = `
      <svg width="900" height="500" viewBox="0 0 900 500" xmlns="http://www.w3.org/2000/svg">
        <rect width="900" height="500" fill="#ffffff"/>
        <rect x="0" y="0" width="900" height="500" fill="#E4002B" opacity="0.08"/>
        <rect x="54" y="54" width="792" height="392" rx="0" fill="#ffffff" stroke="#E4002B" stroke-width="6"/>
        <text x="90" y="150" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="30" font-weight="700" fill="#E4002B">Rhautt Comfort</text>
        ${escapedLines.map((line, index) => `<text x="90" y="${230 + index * 58}" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="42" font-weight="700" fill="#1f2933">${line}</text>`).join('')}
        <text x="90" y="410" font-family="Arial, 'Microsoft YaHei', sans-serif" font-size="24" fill="#697386">微信公众号草稿 MVP</text>
      </svg>
    `;
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async fetchWechatAccessToken(appId: string, appSecret: string) {
    const response = await fetch(`${WECHAT_API_BASE}/stable_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credential',
        appid: appId,
        secret: appSecret,
        force_refresh: false,
      }),
    });
    const payload = await response.json().catch(() => ({})) as {
      access_token?: string;
      errcode?: number;
      errmsg?: string;
    };
    if (payload.access_token) return payload.access_token;
    const mapped = mapWechatTokenError(Number(payload.errcode || 0), text(payload.errmsg, response.statusText));
    throw new BadRequestException(mapped.message);
  }

  private async uploadWechatPermanentMaterial(
    accessToken: string,
    input: { type: 'thumb'; filename: string; mimeType: string; buffer: Buffer },
  ) {
    const form = new FormData();
    form.append('media', new Blob([input.buffer as any], { type: input.mimeType }), input.filename);
    const response = await fetch(`${WECHAT_API_BASE}/material/add_material?access_token=${encodeURIComponent(accessToken)}&type=${input.type}`, {
      method: 'POST',
      body: form as any,
    });
    const payload = await response.json().catch(() => ({})) as {
      media_id?: string;
      url?: string;
      errcode?: number;
      errmsg?: string;
    };
    if (payload.media_id) return { mediaId: payload.media_id, url: payload.url || null };
    throw new BadRequestException(this.wechatApiError('上传微信封面素材失败', payload, response.statusText));
  }

  private async addWechatDraft(
    accessToken: string,
    input: {
      title: string;
      author: string;
      digest: string;
      content: string;
      contentSourceUrl: string | null;
      thumbMediaId: string;
    },
  ) {
    const response = await fetch(`${WECHAT_API_BASE}/draft/add?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articles: [{
          title: input.title,
          author: input.author,
          digest: input.digest,
          content: input.content,
          content_source_url: input.contentSourceUrl || '',
          thumb_media_id: input.thumbMediaId,
          need_open_comment: 0,
          only_fans_can_comment: 0,
        }],
      }),
    });
    const payload = await response.json().catch(() => ({})) as {
      media_id?: string;
      errcode?: number;
      errmsg?: string;
    };
    if (payload.media_id) return { mediaId: payload.media_id };
    throw new BadRequestException(this.wechatApiError('创建微信草稿失败', payload, response.statusText));
  }

  private wechatApiError(prefix: string, payload: { errcode?: number; errmsg?: string }, fallback: string) {
    const code = Number(payload.errcode || 0);
    const message = text(payload.errmsg, fallback);
    if (code === 40164) return `${prefix}：API IP 白名单未包含当前后端公网 IP`;
    if ([40013, 40125, 41002, 41004].includes(code)) return `${prefix}：AppID 或 AppSecret 不正确`;
    if ([48001, 50001].includes(code)) return `${prefix}：公众号接口权限不足，当前公众号可能未认证或不支持该接口`;
    if (code === 45009) return `${prefix}：微信接口调用次数达到上限`;
    return `${prefix}：${code || 'unknown'} ${message}`;
  }

  private async testWechatAccessToken(appId: string, appSecret: string) {
    try {
      const response = await fetch('https://api.weixin.qq.com/cgi-bin/stable_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credential',
          appid: appId,
          secret: appSecret,
          force_refresh: false,
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        access_token?: string;
        expires_in?: number;
        errcode?: number;
        errmsg?: string;
      };
      if (payload.access_token) {
        return { status: 'normal' as const, message: 'WeChat credential and API IP whitelist check passed.' };
      }
      const errcode = Number(payload.errcode || 0);
      return mapWechatTokenError(errcode, text(payload.errmsg, response.statusText));
    } catch {
      return { status: 'temporary_error' as const, message: 'Cannot reach api.weixin.qq.com from backend network.' };
    }
  }

  private async record(
    user: JwtPayload,
    eventType: string,
    objectType: string,
    objectId: string,
    beforeState: Record<string, unknown> | null,
    afterState: Record<string, unknown> | null,
  ) {
    await this.audit.save({
      tenantId: user.tenantId,
      actorId: user.userId,
      eventType,
      objectType,
      objectId,
      beforeState,
      afterState,
      metadata: {},
    });
  }

  private accountDto(account: WechatOfficialAccountEntity) {
    return {
      id: account.id,
      brandId: account.brandId,
      displayName: account.displayName,
      originalId: account.originalId,
      appIdMasked: maskAppId(account.appId),
      status: account.status,
      connectionStatus: account.connectionStatus,
      connectionErrorSummary: account.connectionErrorSummary,
      lastTestedAt: account.lastTestedAt,
      lastSuccessfulSyncAt: account.lastSuccessfulSyncAt,
      secretConfigured: Boolean(account.appSecretCiphertext),
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private versionDto(version: WechatContentReviewVersionEntity) {
    return {
      id: version.id,
      sourceContentId: version.sourceContentId,
      versionNo: version.versionNo,
      reviewStatus: version.reviewStatus,
      wechatPayload: version.wechatPayload,
      targetSnapshot: version.targetSnapshot,
      submitterId: version.submitterId,
      reviewerId: version.reviewerId,
      reviewComment: version.reviewComment,
      submittedAt: version.submittedAt,
      reviewedAt: version.reviewedAt,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt,
    };
  }

  private taskDto(task: WechatDraftSyncTaskEntity, version?: WechatContentReviewVersionEntity) {
    const payload = version?.wechatPayload as any;
    return {
      id: task.id,
      reviewVersionId: task.reviewVersionId,
      accountId: task.accountId,
      syncStatus: task.syncStatus,
      attempts: task.attempts,
      wechatDraftId: task.wechatDraftId,
      errorType: task.errorType,
      errorSummary: task.errorSummary,
      manualNote: task.manualNote,
      manualHandledAt: task.manualHandledAt,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
      title: payload?.title || null,
      versionNo: version?.versionNo || null,
      reviewStatus: version?.reviewStatus || null,
      targetSnapshot: version?.targetSnapshot || null,
    };
  }
}

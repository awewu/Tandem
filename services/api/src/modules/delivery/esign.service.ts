import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// 契约锁 Open API 客户端
// 文档：https://open.qiyuesuo.com/document
// 鉴权：请求头 Authorization = "Signature " + base64(appId:timestamp:nonce:sign)
// sign = HMAC-SHA256(appSecret, appId + "\n" + timestamp + "\n" + nonce)
// ─────────────────────────────────────────────────────────────────────────────

interface QysConfig {
  appId: string;
  appSecret: string;
  baseUrl: string;
  /** 企业签署印章 ID（在契约锁后台「印章管理」获取） */
  companySealId: string;
  /** 企业法人章 ID（可选，部分合同需要） */
  legalSealId?: string;
  /** 合同签署完成后接收 webhook 的回调地址（公网可达） */
  webhookUrl: string;
}

/** 契约锁合同状态枚举（对照官方文档） */
export const QYS_CONTRACT_STATUS = {
  DRAFT:     0,   // 草稿
  SIGNING:   1,   // 签署中
  COMPLETE:  2,   // 已完成
  REVOKED:   3,   // 已撤回
  REFUSED:   4,   // 已拒签
  EXPIRED:   5,   // 已过期
} as const;

@Injectable()
export class EsignService {
  private readonly logger = new Logger(EsignService.name);

  private get cfg(): QysConfig {
    const appId     = process.env.QIYUESUO_APP_ID;
    const appSecret = process.env.QIYUESUO_APP_SECRET;
    const baseUrl   = process.env.QIYUESUO_BASE_URL ?? 'https://openapi.qiyuesuo.com';
    const companySealId = process.env.QIYUESUO_COMPANY_SEAL_ID;
    const webhookUrl    = process.env.QIYUESUO_WEBHOOK_URL;

    if (!appId || !appSecret || !companySealId || !webhookUrl) {
      throw new BadRequestException(
        '电子签章服务未配置：请在 .env.nestjs 中设置 QIYUESUO_APP_ID / QIYUESUO_APP_SECRET / ' +
        'QIYUESUO_COMPANY_SEAL_ID / QIYUESUO_WEBHOOK_URL',
      );
    }
    return {
      appId,
      appSecret,
      baseUrl,
      companySealId,
      legalSealId: process.env.QIYUESUO_LEGAL_SEAL_ID,
      webhookUrl,
    };
  }

  // ── 签名构造 ──────────────────────────────────────────────────────────────

  private buildAuthHeader(cfg: QysConfig): string {
    const timestamp = String(Date.now());
    const nonce     = crypto.randomBytes(8).toString('hex');
    const message   = `${cfg.appId}\n${timestamp}\n${nonce}`;
    const sign      = crypto
      .createHmac('sha256', cfg.appSecret)
      .update(message)
      .digest('base64');
    const token = Buffer.from(`${cfg.appId}:${timestamp}:${nonce}:${sign}`).toString('base64');
    return `Signature ${token}`;
  }

  // ── 底层 HTTP ─────────────────────────────────────────────────────────────

  private async request<T = unknown>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const cfg = this.cfg;
    const url = `${cfg.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: this.buildAuthHeader(cfg),
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json() as { code: number; message?: string; data?: T };

    if (!res.ok || json.code !== 0) {
      this.logger.error(`契约锁 API 错误 ${method} ${path}: code=${json.code} msg=${json.message}`);
      throw new BadRequestException(`契约锁 API 错误：${json.message ?? res.statusText}`);
    }
    return json.data as T;
  }

  // ── 业务方法 ──────────────────────────────────────────────────────────────

  /**
   * 1. 创建合同草稿
   * POST /v2/contract/draft
   * 返回 qiyuesuo contractId
   */
  async createDraft(params: {
    subject: string;
    /** 客户姓名（个人签署方） */
    signerName: string;
    /** 客户手机号（接收签署短信通知） */
    signerMobile: string;
    /** 我方业务分类 ID（契约锁后台「业务分类」获取） */
    categoryId?: string;
  }): Promise<string> {
    const cfg = this.cfg;
    const body = {
      subject: params.subject,
      send: false,  // 先不发起，等上传文档后再发起
      signatories: [
        {
          // 发起方（我方公司）
          tenantType: 'COMPANY',
          receiverType: 'INITIATOR',
          actions: [
            { actionType: 'CORPORATE_SEAL', sealId: cfg.companySealId },
            ...(cfg.legalSealId
              ? [{ actionType: 'LP_SEAL', sealId: cfg.legalSealId }]
              : []),
          ],
        },
        {
          // 接收方（客户个人）
          tenantType: 'PERSONAL',
          receiverType: 'RECEIVER',
          contact: {
            name:   params.signerName,
            mobile: params.signerMobile,
          },
        },
      ],
      ...(params.categoryId ? { category: params.categoryId } : {}),
    };

    const data = await this.request<{ contractId: string }>('POST', '/v2/contract/draft', body);
    return data.contractId;
  }

  /**
   * 2. 用文件（PDF base64）添加合同文档
   * POST /v2/contract/document/file
   */
  async uploadDocument(params: {
    qysContractId: string;
    /** 文件名（含 .pdf 后缀） */
    fileName: string;
    /** PDF 文件的 base64 编码 */
    fileBase64: string;
  }): Promise<void> {
    await this.request('POST', '/v2/contract/document/file', {
      contractId: params.qysContractId,
      fileName:   params.fileName,
      fileBase64: params.fileBase64,
    });
  }

  /**
   * 3. 发起合同（同时触发发起方自动盖章 + 向客户发送签署通知）
   * POST /v2/contract/initiate
   */
  async initiateContract(params: {
    qysContractId: string;
    /** 签署区域坐标（可选，若业务分类已配置则不必传） */
    stampers?: Array<{
      signatoryId?: string;
      actionId?:    string;
      page:         number;
      x:            number;
      y:            number;
      width?:       number;
      height?:      number;
    }>;
    /** 合同到期时间（ISO 8601，默认 30 天） */
    expireTime?: string;
  }): Promise<void> {
    const expireTime = params.expireTime
      ?? new Date(Date.now() + 30 * 86_400_000).toISOString();

    await this.request('POST', '/v2/contract/initiate', {
      contractId:  params.qysContractId,
      expireTime,
      ...(params.stampers?.length ? { stampers: params.stampers } : {}),
    });
  }

  /**
   * 4. 获取客户 H5 签署页面链接
   * POST /v2/contract/sign/url
   * 返回带 token 的 H5 链接，有效期 30 分钟，可嵌入 iframe 或直接发给客户
   */
  async getSignUrl(params: {
    qysContractId: string;
    signerMobile:  string;
    /** 签署完成后跳转地址（可选） */
    redirectUrl?:  string;
  }): Promise<{ signUrl: string; expiresAt: string }> {
    const data = await this.request<{ shortUrl: string }>('POST', '/v2/contract/sign/url', {
      contractId:   params.qysContractId,
      mobile:       params.signerMobile,
      ...(params.redirectUrl ? { redirectUrl: params.redirectUrl } : {}),
    });
    return {
      signUrl:   data.shortUrl,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), // 30 分钟
    };
  }

  /**
   * 5. 查询合同状态（用于主动轮询或 webhook 核验）
   * GET /v2/contract/detail?contractId=xxx
   */
  async getContractDetail(qysContractId: string): Promise<{
    status: number;
    subject: string;
    completeTime?: string;
  }> {
    return this.request('GET', `/v2/contract/detail?contractId=${encodeURIComponent(qysContractId)}`);
  }

  /**
   * 6. 下载已签署合同 PDF（返回 base64 字符串）
   * GET /v2/contract/download?contractId=xxx
   */
  async downloadSignedPdf(qysContractId: string): Promise<string> {
    const data = await this.request<{ fileBase64: string }>(
      'GET',
      `/v2/contract/download?contractId=${encodeURIComponent(qysContractId)}`,
    );
    return data.fileBase64;
  }

  /**
   * 7. 撤回合同（合同签署前可撤回）
   * POST /v2/contract/revoke
   */
  async revokeContract(qysContractId: string, reason: string): Promise<void> {
    await this.request('POST', '/v2/contract/revoke', {
      contractId: qysContractId,
      revokeReason: reason,
    });
  }

  // ── Webhook 验签 ──────────────────────────────────────────────────────────

  /**
   * 验证契约锁 webhook 签名
   * 契约锁在 header 中传 X-Qys-Signature，值为 HMAC-SHA256(appSecret, body)
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    try {
      const cfg = this.cfg;
      const expected = crypto
        .createHmac('sha256', cfg.appSecret)
        .update(rawBody)
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signature),
      );
    } catch {
      return false;
    }
  }
}

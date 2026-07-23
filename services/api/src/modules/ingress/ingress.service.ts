import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventBusService } from '../mdm/event-bus.service';
import { CrmService } from '../crm/crm.service';
import { ComplianceService } from '../compliance/compliance.service';
import { ConsentPurpose } from '../compliance/consent.entity';
import { withRlsTransaction } from '../common/rls';

const VALID_CONSENT_PURPOSES: ConsentPurpose[] = [
  'diagnosis_intake', 'lead_to_dealer', 'marketing', 'service_followup', 'data_cross_border',
];

/**
 * v-next 公域接入层（Public Ingress）· 底座/非视觉骨架。匿名、限流、PIPL 同意前置。
 *
 * PIPL 加固（本次）：手机号等 PII **不进 outbox**。Ingress 在获客暂存租户
 * (INGRESS_CAPTURE_TENANT_ID) 的单个 RLS 事务内，经 CrmService.createLeadInTx 直接落库
 * （PII 只落 customers.phone_encrypted，单一可治理副本），并同事务发射 **不含 PII** 的
 * lead.captured（仅 customerId + audience/source/campaign）供归因/通知等下游消费。
 *
 * 依赖方向合规：应用(营销站) → 非视觉骨架(Ingress) → 领域服务(CRM) → 数据（单向向下）。
 */
@Injectable()
export class IngressService {
  private readonly logger = new Logger('Ingress');
  private static readonly CAPTURE_ACTOR = 'system:public-ingress';
  private readonly captureTenant = process.env.INGRESS_CAPTURE_TENANT_ID || 'rhautt-acquisition-pool';

  // 极简内存限流（滑动窗口）——切片1 基线；生产由边缘层/Redis 承担。
  private readonly hits = new Map<string, number[]>();
  private readonly windowMs = 60_000;
  private readonly maxPerWindow = Number(process.env.INGRESS_RATE_LIMIT || 5);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
    private readonly crm: CrmService,
    private readonly compliance: ComplianceService,
  ) {}

  private rateLimit(ip: string): void {
    const now = Date.now();
    const recent = (this.hits.get(ip) || []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.maxPerWindow) {
      throw new HttpException('请求过于频繁，请稍后再试', HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.hits.set(ip, recent);
  }

  /**
   * 公域留资/线索捕获。同事务：建 lead（PII 落库）+ 发 PII-free 的 lead.captured。
   */
  async captureLead(
    ip: string,
    dto: {
      phone?: string; name?: string; audience?: string; source?: string; city?: string; campaign?: string;
      consent?: boolean;
      consentMeta?: { purpose?: string; policyVersion?: string; surface?: string };
    },
    userAgent?: string,
  ): Promise<{ captured: true; duplicate: boolean }> {
    this.rateLimit(ip || 'unknown');
    if (!dto?.phone || !dto?.name) throw new BadRequestException('phone and name required');
    if (dto.consent !== true) throw new BadRequestException('PIPL consent required');

    const audience = String(dto.audience || 'homeowners');
    const source = dto.source || `web:${audience}`;
    // PIPL 同意用途：以前端上报为准，仅接受合法枚举，默认「问诊需求采集」
    const purpose: ConsentPurpose = VALID_CONSENT_PURPOSES.includes(dto.consentMeta?.purpose as ConsentPurpose)
      ? (dto.consentMeta!.purpose as ConsentPurpose)
      : 'diagnosis_intake';
    const policyVersion = dto.consentMeta?.policyVersion || 'rysnova-privacy-v1';
    const duplicate = await withRlsTransaction(
      this.ds,
      async (em) => {
        // 领域写：PII 只落 customers（唯一可治理副本），并串联 lifecycle + 发 lead.created
        const res = await this.crm.createLeadInTx(em, {
          tenantId: this.captureTenant,
          phone: dto.phone!, name: dto.name!, source, city: dto.city ?? null,
          profile: { audience, campaign: dto.campaign ?? null, origin: 'public-ingress' },
        });
        // PIPL 存证：同事务写 pipl_consents（subjectId=customerId，不含明文 PII；
        // 采集行为与知情同意原子落库，满足可追溯要求）。
        await this.compliance.recordConsentInTx(em, {
          tenantId: this.captureTenant,
          subjectId: res.customer.id,
          subjectType: 'consumer',
          purpose,
          policyVersion,
          granted: true,
          channel: dto.consentMeta?.surface || 'web',
          ip,
          userAgent,
          ttlDays: 365,
        });
        // 漏斗事件：不含 PII，仅引用 customerId + 归因维度
        await this.eventBus.publishInTx(em, {
          tenantId: this.captureTenant,
          eventType: 'lead.captured',
          aggregateType: 'customer',
          aggregateId: res.customer.id,
          payload: { customerId: res.customer.id, audience, source, campaign: dto.campaign ?? null, duplicate: res.duplicate },
        });
        return res.duplicate;
      },
      { tenantId: this.captureTenant, actorId: IngressService.CAPTURE_ACTOR },
    );
    this.logger.log(`lead.captured audience=${audience} duplicate=${duplicate} tenant=${this.captureTenant}`);
    return { captured: true, duplicate };
  }
}

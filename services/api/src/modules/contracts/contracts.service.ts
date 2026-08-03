import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ContractEntity } from './contracts.entity';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { JwtPayload } from '../auth/auth.service';

const DEFAULT_PAYMENT_PLAN = [
  { key: 'deposit', label: '签约首付款', ratio: 0.3, dueStage: 'contract_signed' },
  { key: 'mobilization', label: '进场/设备到场款', ratio: 0.5, dueStage: 'construction_planning' },
  { key: 'acceptance', label: '验收尾款', ratio: 0.2, dueStage: 'acceptance' },
];

@Injectable()
export class ContractsService {
  private readonly logger = new Logger('Contracts');

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async createFromQuotation(
    user: JwtPayload,
    body: {
      quotationId?: string;
      customerId?: string;
      dealerId?: string;
      storeId?: string;
      contractNo?: string;
      totalAmount?: number;
      terms?: Record<string, unknown>;
    },
  ) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ContractEntity);
      const customerId = body.customerId;
      if (!customerId) throw new BadRequestException('customerId is required');

      const contractNo =
        body.contractNo ||
        `CT-${user.tenantId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

      const existing = await repo.findOne({ where: { contractNo } });
      if (existing) throw new ConflictException('contract_no already exists');

      const contract = repo.create({
        tenantId: user.tenantId,
        customerId,
        quotationId: body.quotationId ?? null,
        contractNo,
        status: 'draft',
        totalAmount: body.totalAmount ?? null,
        dealerId: body.dealerId ?? user.dealerId ?? null,
        terms: body.terms ?? {},
      });
      await repo.save(contract);
      this.logger.log(`contract ${contractNo} created from quotation ${body.quotationId ?? '(none)'}`);
      return contract;
    }, this.scopeOf(user));
  }

  async list(
    user: JwtPayload,
    query?: { customerId?: string; status?: string; dealerId?: string },
  ) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ContractEntity);
      const qb = repo
        .createQueryBuilder('c')
        .where('c.tenant_id = :tid', { tid: user.tenantId });

      if (query?.customerId) qb.andWhere('c.customer_id = :cid', { cid: query.customerId });
      if (query?.status) qb.andWhere('c.status = :status', { status: query.status });
      if (query?.dealerId) qb.andWhere('c.dealer_id = :did', { did: query.dealerId });

      qb.orderBy('c.updated_at', 'DESC').limit(100);
      return qb.getMany();
    }, this.scopeOf(user));
  }

  async getByContractId(user: JwtPayload, contractNo: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const contract = await em
        .getRepository(ContractEntity)
        .findOne({ where: { contractNo } });
      if (!contract) throw new NotFoundException('contract not found');
      return contract;
    }, this.scopeOf(user));
  }

  async markSigned(
    user: JwtPayload,
    contractNo: string,
    body: { method?: string; signedAt?: string; evidenceUrl?: string },
  ) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ContractEntity);
      const contract = await repo.findOne({ where: { contractNo } });
      if (!contract) throw new NotFoundException('contract not found');

      if (contract.status === 'pending_approval') {
        throw new ConflictException('contract approval is required before signature');
      }
      if (['cancelled', 'voided'].includes(contract.status)) {
        throw new ConflictException('cancelled or voided contract cannot be signed');
      }

      const signedAt = body.signedAt ? new Date(body.signedAt) : new Date();
      contract.status = 'signed';
      contract.signedAt = signedAt;
      contract.terms = {
        ...contract.terms,
        signatureMethod: body.method || 'customer_portal_confirmation',
        signatureEvidenceUrl: body.evidenceUrl,
        signedBy: user.userId,
      };
      await repo.save(contract);
      this.logger.log(`contract ${contractNo} signed by ${user.userId}`);
      return contract;
    }, this.scopeOf(user));
  }

  async decideApproval(
    user: JwtPayload,
    contractNo: string,
    body: { decision: 'approved' | 'rejected'; reason?: string },
  ) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ContractEntity);
      const contract = await repo.findOne({ where: { contractNo } });
      if (!contract) throw new NotFoundException('contract not found');

      const decision = body.decision;
      if (!['approved', 'rejected'].includes(decision)) {
        throw new BadRequestException('approval decision must be approved or rejected');
      }

      if (contract.status !== 'pending_approval') {
        throw new ConflictException('contract approval has already been decided or is not required');
      }

      contract.status = decision === 'approved' ? 'pending_signature' : 'voided';
      contract.terms = {
        ...contract.terms,
        approvalStatus: decision,
        approvalReason: body.reason,
        approvedBy: decision === 'approved' ? user.userId : null,
        rejectedBy: decision === 'rejected' ? user.userId : null,
      };
      await repo.save(contract);
      this.logger.log(`contract ${contractNo} approval ${decision} by ${user.userId}`);
      return contract;
    }, this.scopeOf(user));
  }

  async recordPayment(
    user: JwtPayload,
    contractNo: string,
    body: { amount: number; method?: string; receiptNo?: string; note?: string },
  ) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ContractEntity);
      const contract = await repo.findOne({ where: { contractNo } });
      if (!contract) throw new NotFoundException('contract not found');

      const amount = Number(body.amount || 0);
      if (amount <= 0) throw new BadRequestException('payment amount must be greater than zero');

      const schedule = (contract.terms?.paymentSchedule as any[]) || DEFAULT_PAYMENT_PLAN;
      const updatedSchedule = schedule.map((item) => ({
        ...item,
        paidAmount: item.paidAmount || 0,
      }));

      const terms = {
        ...contract.terms,
        paymentSchedule: updatedSchedule,
        lastPayment: {
          amount,
          method: body.method,
          receiptNo: body.receiptNo,
          note: body.note,
          recordedBy: user.userId,
          recordedAt: new Date().toISOString(),
        },
      };
      contract.terms = terms;
      await repo.save(contract);
      this.logger.log(`payment ${amount} recorded for contract ${contractNo}`);
      return contract;
    }, this.scopeOf(user));
  }

  async startDelivery(
    user: JwtPayload,
    contractNo: string,
    body: { projectAddress?: string; systems?: string[] },
  ) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ContractEntity);
      const contract = await repo.findOne({ where: { contractNo } });
      if (!contract) throw new NotFoundException('contract not found');

      if (!['signed', 'delivery_started'].includes(contract.status)) {
        throw new ConflictException('contract must be signed before delivery can start');
      }

      contract.status = 'delivery_started';
      contract.terms = {
        ...contract.terms,
        deliveryStartedAt: new Date().toISOString(),
        deliveryStartedBy: user.userId,
        projectAddress: body.projectAddress,
        systems: body.systems,
      };
      await repo.save(contract);
      this.logger.log(`delivery started for contract ${contractNo}`);
      return contract;
    }, this.scopeOf(user));
  }

  private scopeOf(user: JwtPayload): TenantScope {
    return { tenantId: user.tenantId, actorId: user.userId };
  }
}

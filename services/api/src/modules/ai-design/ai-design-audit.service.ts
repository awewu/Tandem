import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiDesignAuditEntity } from './ai-design-audit.entity';

export interface AuditEntry {
  tenantId: string;
  projectId: string;
  userId?: string;
  userRole?: string;
  actionType: 'propose' | 'verify' | 'review' | 'select-quote';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  trustState?: string;
  modelVersion?: string;
  kernelVersion?: string;
  gateStatus?: string;
}

@Injectable()
export class AiDesignAuditService {
  constructor(
    @InjectRepository(AiDesignAuditEntity)
    private readonly repo: Repository<AiDesignAuditEntity>,
  ) {}

  async log(entry: AuditEntry) {
    const row = this.repo.create({
      tenantId: entry.tenantId,
      projectId: entry.projectId,
      userId: entry.userId ?? null,
      userRole: entry.userRole ?? null,
      actionType: entry.actionType,
      input: entry.input,
      output: entry.output,
      trustState: entry.trustState ?? null,
      modelVersion: entry.modelVersion ?? 'stub-1.0',
      kernelVersion: entry.kernelVersion ?? null,
      gateStatus: entry.gateStatus ?? null,
    });
    return this.repo.save(row);
  }

  async listForProject(tenantId: string, projectId: string, limit = 50) {
    return this.repo.find({
      where: { tenantId, projectId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { BcfTopicEntity } from './bcf.entity';
import { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { ownershipScope } from '../common/scope';
import { EventBusService } from '../mdm/event-bus.service';

const STATUSES = ['open', 'resolved', 'closed'];

/**
 * BCF 协同审图服务：议题创建/列表/评论/状态流转/指派，全程 RLS + dealer/store 归属。
 * 支持设计-工程-经销商多方对同一 BIM 项目挑错→复核→关闭的端到端闭环。
 */
@Injectable()
export class BcfService {
  private readonly logger = new Logger(BcfService.name);
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  private scope(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('缺少租户上下文');
    return user.tenantId;
  }
  private rls(user: JwtPayload): TenantScope {
    return { tenantId: this.scope(user), actorId: user.userId, role: user.role };
  }

  async createTopic(user: JwtPayload, dto: {
    title?: string; description?: string; topicType?: string; priority?: string;
    designProjectId?: string; bimProjectId?: string; relatedIfcGuids?: string[];
  }) {
    if (!dto.title) throw new BadRequestException('title required');
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BcfTopicEntity);
      const topic = await repo.save(repo.create({
        tenantId,
        dealerId: user.dealerId ?? null,
        storeId: user.storeId ?? null,
        topicGuid: crypto.randomUUID(),
        title: dto.title,
        description: dto.description ?? '',
        topicType: dto.topicType ?? 'issue',
        status: 'open',
        priority: dto.priority ?? 'normal',
        creationAuthor: user.userId ?? 'unknown',
        designProjectId: dto.designProjectId ?? null,
        bimProjectId: dto.bimProjectId ?? null,
        relatedIfcGuids: Array.isArray(dto.relatedIfcGuids) ? dto.relatedIfcGuids : [],
        comments: [],
        viewpoints: [],
      }));
      await this.eventBus.publishInTx(em, {
        tenantId, eventType: 'bcf.topic.created', aggregateType: 'bcf_topic', aggregateId: topic.id,
        payload: { topicId: topic.id, bimProjectId: topic.bimProjectId, topicType: topic.topicType },
      });
      this.logger.log(`[bcf.create] tenant=${tenantId} topic=${topic.id} type=${topic.topicType}`);
      return topic;
    }, this.rls(user));
  }

  listTopics(user: JwtPayload, query: Record<string, string> = {}) {
    return withRlsTransaction(this.ds, (em) => {
      const qb = em.getRepository(BcfTopicEntity).createQueryBuilder('t').where('t.tenantId = :t', { t: this.scope(user) });
      if (user.storeId) qb.andWhere('t.storeId = :s', { s: user.storeId });
      else if (user.dealerId) qb.andWhere('t.dealerId = :d', { d: user.dealerId });
      if (query.status) qb.andWhere('t.status = :st', { st: query.status });
      if (query.bimProjectId) qb.andWhere('t.bimProjectId = :b', { b: query.bimProjectId });
      return qb.orderBy('t.updatedAt', 'DESC').limit(Math.min(Number(query.limit || 50), 200)).getManyAndCount()
        .then(([items, total]) => ({ items, total }));
    }, this.rls(user));
  }

  getTopic(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const t = await em.getRepository(BcfTopicEntity).findOneBy({ id, tenantId: this.scope(user), ...ownershipScope(user, { hasStore: true }) });
      if (!t) throw new NotFoundException('BCF 议题不存在');
      return t;
    }, this.rls(user));
  }

  async addComment(user: JwtPayload, id: string, dto: { comment?: string; status?: string }) {
    if (!dto.comment) throw new BadRequestException('comment required');
    return this.mutate(user, id, (t) => {
      t.comments = [...(t.comments || []), {
        guid: crypto.randomUUID(), date: new Date().toISOString(),
        author: user.userId ?? 'unknown', comment: dto.comment,
        status: dto.status && STATUSES.includes(dto.status) ? dto.status : undefined,
      }];
      if (dto.status && STATUSES.includes(dto.status)) t.status = dto.status;
    }, 'bcf.topic.commented');
  }

  async updateStatus(user: JwtPayload, id: string, status: string) {
    if (!STATUSES.includes(status)) throw new BadRequestException(`非法状态：${status}（open/resolved/closed）`);
    return this.mutate(user, id, (t) => { t.status = status; }, 'bcf.topic.status');
  }

  async assign(user: JwtPayload, id: string, assignedTo: string) {
    if (!assignedTo) throw new BadRequestException('assignedTo required');
    return this.mutate(user, id, (t) => { t.assignedTo = assignedTo; }, 'bcf.topic.assigned');
  }

  private async mutate(user: JwtPayload, id: string, apply: (t: BcfTopicEntity) => void, eventType: string) {
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BcfTopicEntity);
      const topic = await repo.findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) });
      if (!topic) throw new NotFoundException('BCF 议题不存在');
      apply(topic);
      const saved = await repo.save(topic);
      await this.eventBus.publishInTx(em, {
        tenantId, eventType, aggregateType: 'bcf_topic', aggregateId: id,
        payload: { topicId: id, status: saved.status, assignedTo: saved.assignedTo },
      });
      return saved;
    }, this.rls(user));
  }
}

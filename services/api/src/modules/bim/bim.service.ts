import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BimProjectEntity, RysnovaBimArtifactEntity, BcfTopicEntity } from './bim.entity';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { JwtPayload } from '../auth/auth.service';

@Injectable()
export class BimService {
  private readonly logger = new Logger('Bim');

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async listProjects(user: JwtPayload, query?: { status?: string; search?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BimProjectEntity);
      const qb = repo.createQueryBuilder('b').where('b.tenant_id = :tid', { tid: user.tenantId });
      if (query?.status && query.status !== 'all') {
        qb.andWhere('b.status = :status', { status: query.status });
      }
      if (query?.search) {
        qb.andWhere('(b.customer_name ILIKE :q OR b.city ILIKE :q)', { q: `%${query.search}%` });
      }
      qb.orderBy('b.updatedAt', 'DESC').limit(100);
      return qb.getMany();
    }, this.scopeOf(user));
  }

  async getProject(user: JwtPayload, projectId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const proj = await em.getRepository(BimProjectEntity).findOne({ where: { id: projectId } });
      if (!proj) throw new NotFoundException('bim project not found');
      return proj;
    }, this.scopeOf(user));
  }

  async createProject(user: JwtPayload, body: { customerId: string; quotationId?: string; quotationNo?: string; customerName?: string; city?: string; systemFamilies?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BimProjectEntity);
      const project = repo.create({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        storeId: user.storeId ?? null,
        customerId: body.customerId,
        quotationId: body.quotationId ?? null,
        quotationNo: body.quotationNo ?? null,
        customerName: body.customerName ?? null,
        city: body.city ?? null,
        status: 'inherited',
        systemFamilies: body.systemFamilies ?? '',
      });
      return repo.save(project);
    }, this.scopeOf(user));
  }

  async updateProject(user: JwtPayload, projectId: string, patch: Partial<BimProjectEntity>) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BimProjectEntity);
      const existing = await repo.findOne({ where: { id: projectId } });
      if (!existing) throw new NotFoundException('bim project not found');
      Object.assign(existing, patch);
      return repo.save(existing);
    }, this.scopeOf(user));
  }

  async acceptProject(user: JwtPayload, projectId: string, checklist?: unknown[]) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BimProjectEntity);
      const existing = await repo.findOne({ where: { id: projectId } });
      if (!existing) throw new NotFoundException('bim project not found');
      existing.status = 'accepted';
      existing.acceptedAt = new Date();
      existing.acceptedBy = user.userId;
      if (checklist) existing.acceptanceChecklist = checklist;
      return repo.save(existing);
    }, this.scopeOf(user));
  }

  async deleteProject(user: JwtPayload, projectId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BimProjectEntity);
      const existing = await repo.findOne({ where: { id: projectId } });
      if (!existing) throw new NotFoundException('bim project not found');
      await repo.remove(existing);
      return { id: projectId, deleted: true };
    }, this.scopeOf(user));
  }

  async listArtifacts(user: JwtPayload, query?: { projectId?: string; projectKey?: string; status?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(RysnovaBimArtifactEntity);
      const qb = repo.createQueryBuilder('a').where('a.tenant_id = :tid', { tid: user.tenantId });
      if (query?.projectId) qb.andWhere('a.project_id = :pid', { pid: query.projectId });
      if (query?.projectKey) qb.andWhere('a.project_key = :pk', { pk: query.projectKey });
      if (query?.status) qb.andWhere('a.status = :status', { status: query.status });
      qb.orderBy('a.updatedAt', 'DESC').limit(100);
      return qb.getMany();
    }, this.scopeOf(user));
  }

  async getArtifact(user: JwtPayload, artifactId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const artifact = await em.getRepository(RysnovaBimArtifactEntity).findOne({ where: { id: artifactId } });
      if (!artifact) throw new NotFoundException('artifact not found');
      return artifact;
    }, this.scopeOf(user));
  }

  async createArtifact(user: JwtPayload, body: { projectId?: string; projectKey?: string; name: string; artifactType?: string; fileKey?: string; bimData?: Record<string, unknown>; artifactDoc?: Record<string, unknown> }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(RysnovaBimArtifactEntity);
      const artifact = repo.create({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        projectId: body.projectId ?? null,
        projectKey: body.projectKey ?? null,
        name: body.name,
        artifactType: body.artifactType ?? 'bim_model',
        fileKey: body.fileKey ?? null,
        bimData: body.bimData ?? {},
        artifactDoc: body.artifactDoc ?? {},
        status: 'draft',
      });
      return repo.save(artifact);
    }, this.scopeOf(user));
  }

  async updateArtifact(user: JwtPayload, artifactId: string, patch: Partial<RysnovaBimArtifactEntity>) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(RysnovaBimArtifactEntity);
      const existing = await repo.findOne({ where: { id: artifactId } });
      if (!existing) throw new NotFoundException('artifact not found');
      Object.assign(existing, patch);
      return repo.save(existing);
    }, this.scopeOf(user));
  }

  async deleteArtifact(user: JwtPayload, artifactId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(RysnovaBimArtifactEntity);
      const existing = await repo.findOne({ where: { id: artifactId } });
      if (!existing) throw new NotFoundException('artifact not found');
      await repo.remove(existing);
      return { id: artifactId, deleted: true };
    }, this.scopeOf(user));
  }

  async listBcfTopics(user: JwtPayload, query?: { bimProjectId?: string; status?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BcfTopicEntity);
      const qb = repo.createQueryBuilder('t').where('t.tenant_id = :tid', { tid: user.tenantId });
      if (query?.bimProjectId) qb.andWhere('t.bim_project_id = :pid', { pid: query.bimProjectId });
      if (query?.status) qb.andWhere('t.status = :status', { status: query.status });
      qb.orderBy('t.updatedAt', 'DESC').limit(100);
      return qb.getMany();
    }, this.scopeOf(user));
  }

  async createBcfTopic(user: JwtPayload, body: { title: string; description?: string; topicType?: string; priority?: string; bimProjectId?: string; designProjectId?: string; relatedIfcGuids?: unknown[] }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BcfTopicEntity);
      const topicGuid = `bcf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const topic = repo.create({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        storeId: user.storeId ?? null,
        topicGuid,
        title: body.title,
        description: body.description ?? '',
        topicType: (body.topicType as any) ?? 'issue',
        priority: body.priority ?? 'normal',
        creationAuthor: user.userId,
        bimProjectId: body.bimProjectId ?? null,
        designProjectId: body.designProjectId ?? null,
        relatedIfcGuids: body.relatedIfcGuids ?? [],
      });
      return repo.save(topic);
    }, this.scopeOf(user));
  }

  async addBcfComment(user: JwtPayload, topicId: string, body: { content: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BcfTopicEntity);
      const topic = await repo.findOne({ where: { id: topicId } });
      if (!topic) throw new NotFoundException('bcf topic not found');
      const comments = Array.isArray(topic.comments) ? topic.comments : [];
      comments.push({
        id: `cmt-${Date.now()}`,
        author: user.userId,
        content: body.content,
        createdAt: new Date().toISOString(),
      });
      topic.comments = comments;
      return repo.save(topic);
    }, this.scopeOf(user));
  }

  async updateBcfTopicStatus(user: JwtPayload, topicId: string, status: 'open' | 'resolved' | 'closed') {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(BcfTopicEntity);
      const topic = await repo.findOne({ where: { id: topicId } });
      if (!topic) throw new NotFoundException('bcf topic not found');
      topic.status = status;
      return repo.save(topic);
    }, this.scopeOf(user));
  }

  private scopeOf(user: JwtPayload): TenantScope {
    return { tenantId: user.tenantId, actorId: user.userId };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { NotificationEntity } from './notification.entity';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';

export interface NotificationCreate {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: user.tenantId, actorId: user.userId ?? undefined, role: user.role };
  }

  /** 当前用户的站内通知（租户 + 用户维度，RLS 约束，未读优先）。 */
  async list(user: JwtPayload): Promise<NotificationEntity[]> {
    return withRlsTransaction(this.ds, (em) =>
      em.getRepository(NotificationEntity).find({
        where: { tenantId: user.tenantId, userId: user.userId },
        order: { readAt: 'ASC', createdAt: 'DESC' },
        take: 100,
      }),
    this.rls(user));
  }

  /** 标记已读（限本租户本人，防越权）。 */
  async markRead(user: JwtPayload, id: string): Promise<{ ok: boolean }> {
    const res = await withRlsTransaction(this.ds, (em) =>
      em.getRepository(NotificationEntity).update(
        { id, tenantId: user.tenantId, userId: user.userId },
        { readAt: new Date() },
      ),
    this.rls(user));
    return { ok: (res.affected ?? 0) > 0 };
  }

  /** 事务内创建站内通知（供 event-consumers 在投递事件时落库，受 RLS 约束）。 */
  async createInTx(em: EntityManager, dto: NotificationCreate): Promise<NotificationEntity> {
    const repo = em.getRepository(NotificationEntity);
    return repo.save(repo.create({
      tenantId: dto.tenantId, userId: dto.userId, type: dto.type,
      title: dto.title, body: dto.body ?? null, payload: dto.payload ?? {},
    }));
  }
}

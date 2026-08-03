import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.service';

@Injectable()
export class ProjectsCandidateService {
  async stats(user: JwtPayload) {
    return { active: 0, quoted: 0, delivered: 0 };
  }

  async list(user: JwtPayload, query: { status?: string; search?: string }) {
    return [];
  }

  async create(user: JwtPayload, body: Record<string, unknown>) {
    return {
      id: `PRJ-${Date.now()}`,
      tenantId: user.tenantId,
      status: (body.status as string) || 'draft',
      ownerUserId: user.userId,
      ...body,
    };
  }

  async get(user: JwtPayload, id: string) {
    return null;
  }

  async update(user: JwtPayload, id: string, data: Record<string, unknown>) {
    return { id, ...data };
  }

  async delete(user: JwtPayload, id: string) {
    return { id, deleted: true };
  }
}

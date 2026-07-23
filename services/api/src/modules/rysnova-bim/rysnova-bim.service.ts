import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TARGET_API_BOOT_SMOKE } from '../boot-smoke';
import { createRysnovaBootSmokeArtifactService } from './rysnova-bim.boot-smoke';
import { RysnovaArtifactPgRepository, RysnovaOutboxPgService } from './rysnova-artifact.pg-store';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RysnovaArtifactService = require('../../../../../server/modules/rysnova-bim/rysnova-bim-artifact.service');

function toScope(user: Record<string, unknown>) {
  return {
    tenantId: user['tenantId'],
    dealerId: user['dealerId'],
    storeId: user['storeId'],
    userId: user['sub'] ?? user['userId'],
    customerId: user['customerId'],
    role: user['role'],
  };
}

@Injectable()
export class RysnovaService {
  private readonly svc: InstanceType<typeof RysnovaArtifactService> | Promise<InstanceType<typeof RysnovaArtifactService>>;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    this.svc = TARGET_API_BOOT_SMOKE
      ? createRysnovaBootSmokeArtifactService()
      : new RysnovaArtifactService({
          // MongoDB 下线：持久化与事件走 Postgres 适配器，领域计算逻辑保持不变。
          artifactRepo: new RysnovaArtifactPgRepository(this.dataSource),
          outboxService: new RysnovaOutboxPgService(this.dataSource),
        });
  }

  private async artifactService() {
    return this.svc;
  }

  async createArtifact(user: Record<string, unknown>, body: unknown) {
    return (await this.artifactService()).createArtifact(toScope(user), body);
  }

  async listArtifacts(user: Record<string, unknown>, query: unknown) {
    return (await this.artifactService()).listArtifacts(toScope(user), query);
  }

  async approveArtifact(user: Record<string, unknown>, artifactId: string, body: unknown) {
    return (await this.artifactService()).approveArtifact(toScope(user), artifactId, body);
  }

  async verifyArtifactIntegrity(user: Record<string, unknown>, artifactId: string) {
    return (await this.artifactService()).verifyArtifactIntegrity(toScope(user), artifactId);
  }

  async prepareArtifactDownload(user: Record<string, unknown>, artifactId: string) {
    return (await this.artifactService()).prepareArtifactDownload(toScope(user), artifactId);
  }

  async downloadArtifactContent(user: Record<string, unknown>, artifactId: string) {
    return (await this.artifactService()).downloadArtifactContent(toScope(user), artifactId);
  }

  async buildCustomerPackage(user: Record<string, unknown>, projectId: string) {
    return (await this.artifactService()).buildCustomerPackage(toScope(user), projectId);
  }

  async generateVisualArtifacts(user: Record<string, unknown>, projectId: string, body: unknown) {
    return (await this.artifactService()).generateVisualArtifacts(toScope(user), projectId, body);
  }

  async generateDeliverableArtifacts(user: Record<string, unknown>, projectId: string, body: unknown) {
    return (await this.artifactService()).generateDeliverableArtifacts(toScope(user), projectId, body);
  }

  async generateSignoffPackage(user: Record<string, unknown>, projectId: string, body: unknown) {
    return (await this.artifactService()).generateSignoffPackage(toScope(user), projectId, body);
  }

  async confirmCustomerSignoff(user: Record<string, unknown>, projectId: string, body: unknown) {
    return (await this.artifactService()).confirmCustomerSignoff(toScope(user), projectId, body);
  }

  async buildDeepeningPackage(user: Record<string, unknown>, projectId: string) {
    return (await this.artifactService()).buildDeepeningPackage(toScope(user), projectId);
  }
}

import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowInstanceEntity } from './workflow.entity';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([WorkflowInstanceEntity])]),
    AuthModule
  ],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    ...(TARGET_API_BOOT_SMOKE ? [bootSmokeRepositoryProvider(WorkflowInstanceEntity)] : [])
  ],
})
export class WorkflowModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class WorkflowBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('workflow');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('workflow')
export class WorkflowBoundaryController {
  constructor(private readonly s: WorkflowBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}

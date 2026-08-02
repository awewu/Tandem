import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.service';

@Injectable()
export class WorkflowService {
  async listWorkflows(user: JwtPayload) {
    return {
      platform: 'Rhautt Nexus',
      tenantId: user.tenantId,
      runtimeBoundary: 'target-workflow-facade-not-temporal-runtime-proof',
      temporalRuntimeProof: false,
      workflows: [],
    };
  }
}

import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.service';

const RYSNOVA_SIGNOFF_TYPES = [
  'principle-diagram',
  'construction-drawing',
  'bim-model',
  'bom',
  'quantity-takeoff',
  'standards-check',
  'customer-report',
] as const;

type WorkflowStatus = 'ready-for-worker' | 'waiting-external-runtime';

@Injectable()
export class WorkflowService {
  async listWorkflows(user: JwtPayload) {
    return {
      platform: 'Rhautt Nexus / 瑞合数智枢纽',
      tenantId: user.tenantId,
      runtimeBoundary: 'target-workflow-facade-not-temporal-runtime-proof',
      temporalRuntimeProof: false,
      iotBoundary: 'lifecycle_handoff_only',
      workflows: [
        this.rysnovaBimDrawingExportWorkflow(user, 'rysnova-bim-default-project'),
        this.rysnovaBimCustomerSignoffWorkflow(user, 'rysnova-bim-default-project'),
      ],
    };
  }

  async getRysnovaProjectWorkflow(user: JwtPayload, projectId: string) {
    const drawingExport = this.rysnovaBimDrawingExportWorkflow(user, projectId);
    const customerSignoff = this.rysnovaBimCustomerSignoffWorkflow(user, projectId);
    const allRequiredArtifacts = [...new Set([
      ...drawingExport.requiredArtifacts,
      ...customerSignoff.requiredArtifacts,
    ])];

    return {
      platform: 'Rhautt Nexus / 瑞合数智枢纽',
      module: 'Rysnova',
      projectId,
      tenantId: user.tenantId,
      moduleNamespace: 'rysnova-bim',
      dataNamespace: 'rysnova-bim',
      status: 'ready-for-worker' as WorkflowStatus,
      temporalRuntimeProof: false,
      workerRuntimeProof: false,
      outboxRequired: true,
      iotBoundary: 'lifecycle_handoff_only',
      realtimeControl: false,
      workflows: [drawingExport, customerSignoff],
      requiredArtifacts: allRequiredArtifacts,
      signoffPackage: {
        requiredTypes: RYSNOVA_SIGNOFF_TYPES,
        minItems: RYSNOVA_SIGNOFF_TYPES.length,
        maxItems: RYSNOVA_SIGNOFF_TYPES.length,
        customerVisible: true,
      },
      handoff: {
        targetPlatform: 'external-iot-lifecycle-platform',
        status: 'handoff-ready-not-bound',
        realtimeControl: false,
      },
      nonCompletionRule:
        'This target workflow facade proves Rysnova workflow shape and boundaries only; final production proof still requires Temporal runtime worker evidence.',
    };
  }

  private rysnovaBimDrawingExportWorkflow(user: JwtPayload, projectId: string) {
    return {
      id: `rysnova-bim-drawing-export:${user.tenantId}:${projectId}`,
      workflowType: 'drawing-export-workflow',
      status: 'ready-for-worker' as WorkflowStatus,
      businessKey: `${user.tenantId}:rysnova-bim:${projectId}:drawing-export`,
      idempotencyKey: `${user.tenantId}:rysnova-bim:${projectId}:drawing-export:v1`,
      tenantId: user.tenantId,
      aggregateType: 'rysnova-bim-project',
      aggregateId: projectId,
      requiredArtifacts: RYSNOVA_SIGNOFF_TYPES,
      outboxEvents: [
        'rysnova-bim.visual_artifacts.generated',
        'rysnova-bim.deliverable_artifacts.generated',
        'rysnova-bim.artifact.integrity.verified',
      ],
      temporal: {
        taskQueue: 'rhautt-nexus-workflows',
        runtimeRequired: true,
        runtimeProof: false,
      },
      retries: {
        maxAttempts: 3,
        backoff: 'exponential',
      },
    };
  }

  private rysnovaBimCustomerSignoffWorkflow(user: JwtPayload, projectId: string) {
    return {
      id: `rysnova-bim-customer-signoff:${user.tenantId}:${projectId}`,
      workflowType: 'rysnova-bim-customer-signoff-workflow',
      status: 'ready-for-worker' as WorkflowStatus,
      businessKey: `${user.tenantId}:rysnova-bim:${projectId}:customer-signoff`,
      idempotencyKey: `${user.tenantId}:rysnova-bim:${projectId}:customer-signoff:v1`,
      tenantId: user.tenantId,
      aggregateType: 'rysnova-bim-customer-package',
      aggregateId: projectId,
      requiredArtifacts: RYSNOVA_SIGNOFF_TYPES,
      outboxEvents: [
        'rysnova-bim.signoff_package.ready',
        'rysnova-bim.customer_package.ready',
        'rysnova-bim.customer_signoff.confirmed',
        'rysnova-bim.lifecycle_handoff.ready',
      ],
      customerVisibility: {
        scope: 'customer-visible',
        hiddenFields: [
          'tenantId',
          'dealerId',
          'storeId',
          'permissions',
          'metadata',
          'dealerMargin',
          'costBaseline',
          'internalApprovalNotes',
          'costBreakdown',
          'marginGuard',
        ],
      },
      iot: {
        handoffBoundary: 'lifecycle_handoff_only',
        targetPlatform: 'external-iot-lifecycle-platform',
        realtimeControl: false,
      },
      temporal: {
        taskQueue: 'rhautt-nexus-workflows',
        runtimeRequired: true,
        runtimeProof: false,
      },
    };
  }
}

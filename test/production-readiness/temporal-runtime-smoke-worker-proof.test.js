const {
  buildWorkerProof,
  hashProofValue
} = require('../../scripts/release/temporal-runtime-smoke');

describe('Temporal runtime worker proof semantics', () => {
  test('accepts only sanitized Rysnova worker execution proof', () => {
    const env = {
      TEMPORAL_WORKER_PROOF: 'passed',
      TEMPORAL_WORKER_PROOF_WORKFLOW_ID: 'rysnova-bim-workflow-123',
      TEMPORAL_WORKER_PROOF_RUN_ID: 'run-abc-456',
      TEMPORAL_WORKER_PROOF_TASK_QUEUE: 'rhautt-nexus-workflows',
      TEMPORAL_WORKER_PROOF_WORKFLOW_TYPE: 'rysnova-bim-customer-signoff-workflow',
      TEMPORAL_WORKER_PROOF_EVENT_TYPE: 'rysnova-bim.customer_signoff.confirmed',
      TEMPORAL_WORKER_PROOF_TENANT_ID: 'tenant-secret-value',
      TEMPORAL_WORKER_PROOF_PROJECT_ID: 'project-secret-value'
    };

    const proof = buildWorkerProof({
      env,
      taskQueue: 'rhautt-nexus-workflows',
      workflowDescribe: {
        attempted: true,
        passed: true,
        stdoutSha256: hashProofValue('temporal describe output'),
        stderrSha256: null,
        stdoutBytes: 24,
        stderrBytes: 0
      }
    });

    expect(proof.workerRuntimeProof).toBe(true);
    expect(proof.proof).toEqual(expect.objectContaining({
      status: 'passed',
      mode: 'passed',
      rawIdentifiersPersisted: false,
      taskQueue: 'rhautt-nexus-workflows',
      workflowType: 'rysnova-bim-customer-signoff-workflow',
      eventType: 'rysnova-bim.customer_signoff.confirmed',
      workflowIdSha256: hashProofValue('rysnova-bim-workflow-123'),
      runIdSha256: hashProofValue('run-abc-456'),
      tenantSha256: hashProofValue('tenant-secret-value'),
      projectSha256: hashProofValue('project-secret-value'),
      missing: []
    }));
    expect(proof.proof.workflowIdSha256).not.toContain('rysnova-bim-workflow-123');
    expect(proof.proof.runIdSha256).not.toContain('run-abc-456');
    expect(proof.proof.semantic).toEqual(expect.objectContaining({
      platform: 'Rhautt Nexus / 瑞合数智枢纽',
      module: 'Rysnova',
      iotBoundary: 'lifecycle_handoff_only',
      proofModeAccepted: true,
      taskQueueMatches: true,
      workflowTypeAccepted: true,
      eventTypeAccepted: true,
      tenantScoped: true,
      projectScoped: true
    }));
  });

  test('rejects generic or mismatched worker proof without final claim', () => {
    const proof = buildWorkerProof({
      env: {
        TEMPORAL_WORKER_PROOF: 'passed',
        TEMPORAL_WORKER_PROOF_WORKFLOW_ID: 'workflow-1',
        TEMPORAL_WORKER_PROOF_RUN_ID: 'run-1',
        TEMPORAL_WORKER_PROOF_TASK_QUEUE: 'wrong-queue',
        TEMPORAL_WORKER_PROOF_WORKFLOW_TYPE: 'generic-workflow',
        TEMPORAL_WORKER_PROOF_EVENT_TYPE: 'workflow.done',
        TEMPORAL_WORKER_PROOF_TENANT_SHA256: hashProofValue('tenant-a'),
        TEMPORAL_WORKER_PROOF_PROJECT_SHA256: hashProofValue('project-a')
      },
      taskQueue: 'rhautt-nexus-workflows',
      workflowDescribe: {
        attempted: true,
        passed: true
      }
    });

    expect(proof.workerRuntimeProof).toBe(false);
    expect(proof.proof.status).toBe('incomplete-or-invalid');
    expect(proof.proof.missing).toEqual(expect.arrayContaining([
      'TEMPORAL_WORKER_PROOF_TASK_QUEUE must equal rhautt-nexus-workflows',
      'TEMPORAL_WORKER_PROOF_WORKFLOW_TYPE must be one of rysnova-bim-customer-signoff-workflow',
      'TEMPORAL_WORKER_PROOF_EVENT_TYPE must be rysnova-bim.customer_signoff.confirmed'
    ]));
  });
});

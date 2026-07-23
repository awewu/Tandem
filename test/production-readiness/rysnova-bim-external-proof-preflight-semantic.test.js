const {
  PROOF_REQUIREMENTS,
  buildReport,
  isPlaceholder,
  isLocalHostName
} = require('../../scripts/release/rysnova-bim-external-proof-preflight');
const {
  validateCapacityEnv,
  validateObjectStorageEnv,
  validatePostgresStagingEnv,
  validateRedisRuntimeEnv,
  validateTemporalRuntimeEnv
} = require('../../scripts/release/external-proof-validation');

const ORIGINAL_ENV = process.env;

function withEnv(overrides, run) {
  process.env = {
    ...ORIGINAL_ENV,
    ...overrides
  };
  try {
    return run();
  } finally {
    process.env = ORIGINAL_ENV;
  }
}

describe('Rysnova external proof preflight semantic validation', () => {
  test('defines machine-readable production proof requirements for every external gate', () => {
    expect(Object.keys(PROOF_REQUIREMENTS).sort()).toEqual([
      'browser-visual',
      'external-object-storage',
      'postgres-staging',
      'redis-runtime',
      'staging-capacity',
      'temporal-runtime'
    ]);

    for (const requirement of Object.values(PROOF_REQUIREMENTS)) {
      expect(requirement).toEqual(expect.objectContaining({
        owner: expect.any(String),
        evidencePath: expect.any(String),
        requiredStatus: expect.any(String),
        finalProofField: expect.any(String),
        acceptanceCriteria: expect.any(Array),
        cannotBeReplacedBy: expect.any(Array),
        failureImpact: expect.any(String)
      }));
      expect(requirement.acceptanceCriteria.length).toBeGreaterThanOrEqual(3);
      expect(requirement.cannotBeReplacedBy.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('rejects placeholder and local infrastructure even when all required env names are present', () => {
    const report = withEnv({
      VISUAL_BASE_URL: 'http://localhost:3100',
      NODE_ENV: 'development',
      MONGODB_URI: 'mongodb://localhost:27017/rhautt-dev',
      CAPACITY_BASE_URL: 'http://127.0.0.1:3100',
      OBJECT_STORAGE_EXTERNAL_PROVIDER: 'filesystem',
      OBJECT_STORAGE_ENDPOINT: 'http://localhost:9000',
      OBJECT_STORAGE_BUCKET: '<bucket>',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'fake-key',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'fake-secret',
      POSTGRES_STAGING_URL: 'postgres://user:pass@localhost:5432/rhautt_test',
      REDIS_STAGING_URL: 'redis://localhost:6379',
      TEMPORAL_ADDRESS: 'localhost:7233',
      TEMPORAL_WORKER_PROOF: 'placeholder',
      TEMPORAL_WORKER_PROOF_WORKFLOW_ID: 'workflow-1',
      TEMPORAL_WORKER_PROOF_RUN_ID: 'run-1',
      TEMPORAL_WORKER_PROOF_TASK_QUEUE: 'rysnova-bim',
      TEMPORAL_WORKER_PROOF_WORKFLOW_TYPE: 'RysnovaWorkflow',
      TEMPORAL_WORKER_PROOF_EVENT_TYPE: 'WorkflowCompleted',
      TEMPORAL_WORKER_PROOF_TENANT_ID: 'tenant-1',
      TEMPORAL_WORKER_PROOF_PROJECT_ID: 'project-1'
    }, () => buildReport());

    expect(report.readyForExternalProofRun).toBe(false);
    expect(report.status).toBe('missing-external-proof-configuration');
    expect(report.summary).toEqual(expect.objectContaining({
      checks: 6,
      ready: 0,
      blocked: 6
    }));
    expect(report.proofRequirements['external-object-storage']).toEqual(expect.objectContaining({
      owner: 'rysnova-bim-artifact-platform',
      evidencePath: 'evidence/object-storage/rysnova-bim-object-storage-smoke.json',
      finalProofField: 'finalLaunchObjectStorageProof',
      cannotBeReplacedBy: expect.arrayContaining(['local filesystem adapter'])
    }));
    for (const check of report.checks) {
      expect(check).toEqual(expect.objectContaining({
        owner: expect.any(String),
        evidencePath: expect.any(String),
        requiredStatus: expect.any(String),
        finalProofField: expect.any(String),
        acceptanceCriteria: expect.any(Array),
        cannotBeReplacedBy: expect.any(Array),
        failureImpact: expect.any(String)
      }));
    }
    for (const blocker of report.blockers) {
      expect(blocker).toEqual(expect.objectContaining({
        owner: expect.any(String),
        evidencePath: expect.any(String),
        requiredStatus: expect.any(String),
        finalProofField: expect.any(String),
        acceptanceCriteria: expect.any(Array),
        cannotBeReplacedBy: expect.any(Array),
        failureImpact: expect.any(String)
      }));
    }

    const semanticText = report.checks
      .flatMap(check => check.semanticFailures)
      .join('\n');
    expect(semanticText).toContain('NODE_ENV must be production');
    expect(semanticText).toContain('MONGODB_URI must target non-local production/staging infrastructure');
    expect(semanticText).toContain('CAPACITY_BASE_URL must be a non-local production/staging URL');
    expect(semanticText).toContain('OBJECT_STORAGE_EXTERNAL_PROVIDER must be one of: s3, oss, minio, s3-compatible');
    expect(semanticText).toContain('OBJECT_STORAGE_BUCKET must not be a placeholder/example value');
    expect(semanticText).toContain('POSTGRES_STAGING_URL must target non-local production/staging infrastructure');
    expect(semanticText).toContain('REDIS_STAGING_URL must target non-local production/staging infrastructure');
    expect(semanticText).toContain('TEMPORAL_ADDRESS must target non-local production/staging infrastructure');
    expect(semanticText).toContain('TEMPORAL_WORKER_PROOF must not be a placeholder/example value');
    expect(semanticText).toContain('TEMPORAL_WORKER_PROOF must be passed');
    expect(semanticText).toContain('TEMPORAL_WORKER_PROOF_WORKFLOW_TYPE must be rysnova-bim-customer-signoff-workflow');
    expect(semanticText).toContain('TEMPORAL_WORKER_PROOF_EVENT_TYPE must be rysnova-bim.customer_signoff.confirmed');
  });

  test('helper classifiers catch obvious local and placeholder values', () => {
    expect(isPlaceholder('<staging-url>')).toBe(true);
    expect(isPlaceholder('example-bucket')).toBe(true);
    expect(isPlaceholder('prod-rhautt-bucket')).toBe(false);
    expect(isLocalHostName('localhost')).toBe(true);
    expect(isLocalHostName('127.0.0.1')).toBe(true);
    expect(isLocalHostName('192.168.1.8')).toBe(true);
    expect(isLocalHostName('capacity.rhautt.example.net')).toBe(false);
  });

  test('shared validators reject direct smoke runs with local or placeholder launch proof configuration', () => {
    const env = {
      NODE_ENV: 'development',
      MONGODB_URI: 'mongodb://localhost:27017/rhautt-dev',
      CAPACITY_BASE_URL: 'http://127.0.0.1:3100',
      OBJECT_STORAGE_EXTERNAL_PROVIDER: 'filesystem',
      OBJECT_STORAGE_ENDPOINT: 'http://localhost:9000',
      OBJECT_STORAGE_BUCKET: '<bucket>',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'fake-key',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'fake-secret',
      POSTGRES_STAGING_URL: 'postgres://user:pass@localhost:5432/rhautt_test',
      REDIS_STAGING_URL: 'redis://localhost:6379',
      TEMPORAL_ADDRESS: 'localhost:7233',
      TEMPORAL_WORKER_PROOF: 'placeholder',
      TEMPORAL_WORKER_PROOF_WORKFLOW_ID: 'workflow-1',
      TEMPORAL_WORKER_PROOF_RUN_ID: 'run-1',
      TEMPORAL_WORKER_PROOF_TASK_QUEUE: 'rysnova-bim',
      TEMPORAL_WORKER_PROOF_WORKFLOW_TYPE: 'RysnovaWorkflow',
      TEMPORAL_WORKER_PROOF_EVENT_TYPE: 'WorkflowCompleted',
      TEMPORAL_WORKER_PROOF_TENANT_ID: 'tenant-1',
      TEMPORAL_WORKER_PROOF_PROJECT_ID: 'project-1'
    };

    for (const validation of [
      validateCapacityEnv(env),
      validateObjectStorageEnv(env),
      validatePostgresStagingEnv(env),
      validateRedisRuntimeEnv(env),
      validateTemporalRuntimeEnv(env)
    ]) {
      expect(validation.passed).toBe(false);
      expect(validation.invalidEnv.length).toBeGreaterThan(0);
      expect(validation.semanticFailures.length).toBeGreaterThan(0);
    }

    expect(validateCapacityEnv(env).semanticFailures.join('\n')).toContain('CAPACITY_BASE_URL must be a non-local production/staging URL');
    expect(validateObjectStorageEnv(env).semanticFailures.join('\n')).toContain('OBJECT_STORAGE_EXTERNAL_PROVIDER must be one of: s3, oss, minio, s3-compatible');
    expect(validatePostgresStagingEnv(env).semanticFailures.join('\n')).toContain('POSTGRES_STAGING_URL must target non-local production/staging infrastructure');
    expect(validateRedisRuntimeEnv(env).semanticFailures.join('\n')).toContain('REDIS_STAGING_URL must target non-local production/staging infrastructure');
    expect(validateTemporalRuntimeEnv(env).semanticFailures.join('\n')).toContain('TEMPORAL_ADDRESS must target non-local production/staging infrastructure');
    expect(validateTemporalRuntimeEnv(env).semanticFailures.join('\n')).toContain('TEMPORAL_WORKER_PROOF_WORKFLOW_TYPE must be rysnova-bim-customer-signoff-workflow');
    expect(validateTemporalRuntimeEnv(env).semanticFailures.join('\n')).toContain('TEMPORAL_WORKER_PROOF_EVENT_TYPE must be rysnova-bim.customer_signoff.confirmed');
  });
});

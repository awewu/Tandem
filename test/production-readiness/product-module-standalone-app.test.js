const request = require('./helpers/in-process-request');
const {
  createProductModuleStandaloneApp
} = require('../../server/modules/productModules/product-module-app-factory');

describe('product module standalone app factory', () => {
  test('瑞诺瓦 can boot as a standalone module app with independent metadata and entry routes', async () => {
    const { app, meta, entryRoutes } = createProductModuleStandaloneApp('rysnova');

    expect(meta).toEqual(expect.objectContaining({
      moduleId: 'rysnova-consumer-system',
      displayName: '瑞诺瓦',
      moduleDeploymentMode: 'standalone',
      moduleNamespace: 'rysnova',
      dataNamespace: 'rysnova',
      apiNamespace: '/api/v2/diagnosis',
      productBoundary: 'independent-product-domain',
      productIndependenceLevel: 'portal-embedded-and-standalone-extractable',
      targetApp: 'apps/consumer-diagnosis',
      standaloneAppShellMode: 'independent-product-app-shell',
      standaloneDomainStrategy: 'dedicated-domain-or-subdomain-required',
      objectStoragePrefix: 'rysnova/',
      analyticsNamespace: 'rysnova',
      futureDatabaseStrategy: 'namespace-extractable-shared-ledger',
      standalonePostgresSchema: 'rysnova',
      standaloneMongoDatabase: 'rysnova_documents',
      standaloneObjectStorageBucket: 'rysnova-product-artifacts',
      databaseIndependence: expect.objectContaining({
        currentDataMode: 'shared-foundation-product-domain-partitioned',
        futureDataMode: 'standalone-database-extractable',
        ownedPostgresTables: expect.arrayContaining(['customers', 'opportunities', 'quotations']),
        ownedMongoNamespaces: expect.arrayContaining(['DiagnosisReport.moduleNamespace=rysnova']),
        standalonePostgresSchema: 'rysnova',
        standaloneMongoDatabase: 'rysnova_documents',
        standaloneObjectStorageBucket: 'rysnova-product-artifacts',
        standaloneDatabaseTarget: 'rysnova-owned-postgres-schema-plus-mongodb-namespace',
        extractionPlan: 'extract-by-product_data_namespace-moduleNamespace-dataNamespace-objectStoragePrefix',
        extractionProofRequired: true,
        futureStandaloneProductReady: true
      }),
      portalIntegration: expect.objectContaining({
        embeddedInRhauttPortal: true,
        embeddedEntry: '/pain-diagnosis.html'
      }),
      standaloneProductization: expect.objectContaining({
        launchable: true,
        targetApp: 'apps/consumer-diagnosis',
        appShellMode: 'independent-product-app-shell',
        domainStrategy: 'dedicated-domain-or-subdomain-required',
        standaloneDomainTargets: expect.arrayContaining(['pending-dedicated-rysnova-domain-or-subdomain']),
        externalDomainProofRequired: true,
        databaseExtractionReady: true
      }),
      dataBoundary: expect.objectContaining({
        postgresRegistry: 'rhautt_nexus.product_modules',
        deploymentRegistry: 'rhautt_nexus.product_module_deployments',
        dataPartitionRegistry: 'rhautt_nexus.product_module_data_partitions',
        dataNamespace: 'rysnova',
        productIndependenceLevel: 'portal-embedded-and-standalone-extractable',
        standaloneDomainStrategy: 'dedicated-domain-or-subdomain-required',
        standaloneAppShellMode: 'independent-product-app-shell',
        objectStoragePrefix: 'rysnova/',
        currentDataMode: 'shared-foundation-product-domain-partitioned',
        futureDataMode: 'standalone-database-extractable',
        standalonePostgresSchema: 'rysnova',
        standaloneMongoDatabase: 'rysnova_documents',
        standaloneObjectStorageBucket: 'rysnova-product-artifacts',
        standaloneDatabaseTarget: 'rysnova-owned-postgres-schema-plus-mongodb-namespace',
        extractionPlan: 'extract-by-product_data_namespace-moduleNamespace-dataNamespace-objectStoragePrefix',
        extractionProofRequired: true,
        futureStandaloneProductReady: true,
        independentDatabaseReady: true
      }),
      iotBoundary: 'lifecycle_handoff_only'
    }));
    expect(entryRoutes).toContain('/rysnova-ai');

    await request(app)
      .get('/health')
      .expect(200)
      .expect(res => {
        expect(res.body.success).toBe(true);
        expect(res.body.standalone).toBe(true);
        expect(res.body.moduleId).toBe('rysnova-consumer-system');
        expect(res.body.moduleDeploymentMode).toBe('standalone');
      });

    await request(app)
      .get('/api/v2/diagnosis/module-meta')
      .expect(200)
      .expect(res => {
        expect(res.body.moduleNamespace).toBe('rysnova');
        expect(res.body.dataNamespace).toBe('rysnova');
        expect(res.body.poweredBy).toBe('Powered by Rhautt Comfort');
      });

    await request(app)
      .get('/rysnova-ai')
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('瑞诺瓦 AI 问诊');
        expect(res.text).toContain('Powered by Rhautt Comfort');
        expect(res.text).toContain('diag-rheem-wordmark');
        expect(res.text).not.toContain('/images/rheem-logo.svg');
        expect(res.text).not.toContain('/images/rhautt-comfort-wordmark.svg');
      });
  });

  test('Rysnova can boot as a standalone module app with independent metadata and entry routes', async () => {
    const { app, meta, entryRoutes } = createProductModuleStandaloneApp('rysnova-bim');

    expect(meta).toEqual(expect.objectContaining({
      moduleId: 'rysnova-bim-engineering-support',
      displayName: 'Rysnova',
      moduleDeploymentMode: 'standalone',
      moduleNamespace: 'rysnova-bim',
      dataNamespace: 'rysnova-bim',
      apiNamespace: '/api/v2/rysnova-bim',
      productBoundary: 'independent-product-domain',
      productIndependenceLevel: 'portal-embedded-and-standalone-extractable',
      targetApp: 'apps/rysnova-bim-workbench',
      standaloneAppShellMode: 'independent-product-app-shell',
      standaloneDomainStrategy: 'dedicated-domain-or-subdomain-required',
      objectStoragePrefix: 'rysnova-bim/',
      analyticsNamespace: 'rysnova-bim',
      futureDatabaseStrategy: 'namespace-extractable-shared-ledger',
      standalonePostgresSchema: 'rysnova-bim',
      standaloneMongoDatabase: 'rysnova-bim_documents',
      standaloneObjectStorageBucket: 'rysnova-bim-product-artifacts',
      databaseIndependence: expect.objectContaining({
        currentDataMode: 'shared-foundation-product-domain-partitioned',
        futureDataMode: 'standalone-database-extractable',
        ownedPostgresTables: expect.arrayContaining(['file_artifacts', 'quotations']),
        ownedMongoNamespaces: expect.arrayContaining(['RysnovaArtifact.moduleNamespace=rysnova-bim']),
        standalonePostgresSchema: 'rysnova-bim',
        standaloneMongoDatabase: 'rysnova-bim_documents',
        standaloneObjectStorageBucket: 'rysnova-bim-product-artifacts',
        standaloneDatabaseTarget: 'rysnova-bim-owned-postgres-schema-plus-mongodb-namespace',
        extractionPlan: 'extract-by-data_namespace-moduleNamespace-objectStoragePrefix-artifactHashes',
        extractionProofRequired: true,
        futureStandaloneProductReady: true
      }),
      portalIntegration: expect.objectContaining({
        embeddedInRhauttPortal: true,
        embeddedEntry: '/rysnova-bim-designer.html'
      }),
      standaloneProductization: expect.objectContaining({
        launchable: true,
        targetApp: 'apps/rysnova-bim-workbench',
        appShellMode: 'independent-product-app-shell',
        domainStrategy: 'dedicated-domain-or-subdomain-required',
        standaloneDomainTargets: expect.arrayContaining(['pending-dedicated-rysnova-bim-domain-or-subdomain']),
        externalDomainProofRequired: true,
        databaseExtractionReady: true
      }),
      dataBoundary: expect.objectContaining({
        postgresRegistry: 'rhautt_nexus.product_modules',
        deploymentRegistry: 'rhautt_nexus.product_module_deployments',
        dataPartitionRegistry: 'rhautt_nexus.product_module_data_partitions',
        dataNamespace: 'rysnova-bim',
        productIndependenceLevel: 'portal-embedded-and-standalone-extractable',
        standaloneDomainStrategy: 'dedicated-domain-or-subdomain-required',
        standaloneAppShellMode: 'independent-product-app-shell',
        objectStoragePrefix: 'rysnova-bim/',
        currentDataMode: 'shared-foundation-product-domain-partitioned',
        futureDataMode: 'standalone-database-extractable',
        standalonePostgresSchema: 'rysnova-bim',
        standaloneMongoDatabase: 'rysnova-bim_documents',
        standaloneObjectStorageBucket: 'rysnova-bim-product-artifacts',
        standaloneDatabaseTarget: 'rysnova-bim-owned-postgres-schema-plus-mongodb-namespace',
        extractionPlan: 'extract-by-data_namespace-moduleNamespace-objectStoragePrefix-artifactHashes',
        extractionProofRequired: true,
        futureStandaloneProductReady: true,
        independentDatabaseReady: true
      }),
      iotBoundary: 'lifecycle_handoff_only'
    }));
    expect(entryRoutes).toContain('/rysnova-bim-workbench');

    await request(app)
      .get('/health')
      .expect(200)
      .expect(res => {
        expect(res.body.success).toBe(true);
        expect(res.body.standalone).toBe(true);
        expect(res.body.moduleId).toBe('rysnova-bim-engineering-support');
        expect(res.body.moduleDeploymentMode).toBe('standalone');
      });

    await request(app)
      .get('/api/v2/rysnova-bim/module-meta')
      .expect(200)
      .expect(res => {
        expect(res.body.moduleNamespace).toBe('rysnova-bim');
        expect(res.body.dataNamespace).toBe('rysnova-bim');
        expect(res.body.poweredBy).toBe('Powered by Rhautt Comfort');
      });

    await request(app)
      .get('/rysnova-bim-workbench?projectId=p-1&artifactId=a-1')
      .expect(302)
      .expect('Location', 'http://localhost:4003/viewer?projectId=p-1&artifactId=a-1');
  });
});

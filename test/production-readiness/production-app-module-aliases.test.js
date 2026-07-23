const request = require('./helpers/in-process-request');
const express = require('express');
const { PRODUCTION_ROUTE_CATALOG } = require('../../server/modules/productionRouteCatalog');
const createPageAliasesRouter = require('../../server/routes/page-aliases');

function createCatalogAliasApp() {
  const pagesGroup = PRODUCTION_ROUTE_CATALOG.find(group => group.id === 'pages-and-governance');
  const aliasEntry = pagesGroup?.routes.find(route => route.id === 'page-aliases');
  if (!aliasEntry || aliasEntry.factory !== 'pageAliases') {
    throw new Error('production route catalog must mount page-aliases through pageAliases factory');
  }

  const app = express();
  app.use(createPageAliasesRouter());
  return app;
}

describe('production app product module aliases', () => {
  test('瑞诺瓦 standalone aliases are mounted through the production app composition', async () => {
    const app = createCatalogAliasApp();

    await request(app)
      .get('/rysnova')
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('瑞诺瓦 AI 问诊');
        expect(res.text).toContain('Powered by Rhautt Comfort');
        expect(res.text).toContain('diag-rheem-wordmark');
        expect(res.text).not.toContain('/images/rheem-logo.svg');
      });

    await request(app)
      .get('/rysnova-ai')
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('瑞诺瓦系统问诊');
      });
  });

  test('Rysnova standalone aliases are mounted through the production app composition', async () => {
    const app = createCatalogAliasApp();

    await request(app)
      .get('/rysnova-bim?projectId=p-1&artifactId=a-1')
      .expect(302)
      .expect('Location', 'http://localhost:4003/viewer?projectId=p-1&artifactId=a-1');

    await request(app)
      .get('/rysnova-bim-bim?contractId=c-1&opportunityId=o-1')
      .expect(302)
      .expect('Location', 'http://localhost:4003/viewer?contractId=c-1&opportunityId=o-1');
  });
});

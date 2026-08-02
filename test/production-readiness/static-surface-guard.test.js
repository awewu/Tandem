const express = require('express');
const request = require('./helpers/in-process-request');
const {
  createLegacySurfaceClassifier,
  createProductionStaticSurfaceGuard
} = require('../../server/middleware/productionStaticSurfaceGuard');
const createPageAliasesRouter = require('../../server/routes/page-aliases');

describe('production static surface guard', () => {
  test('redirects former production HTML pages after archival', async () => {
    const app = express();
    app.use(createProductionStaticSurfaceGuard());
    app.get('/index-ready.html', (req, res) => res.status(200).send('portal'));

    const res = await request(app).get('/index-ready.html').expect(302);
    expect(res.headers.location).toContain('archived=%2Findex-ready.html');
    expect(res.headers.location).toContain('surfaceBucket=archive');
  });

  test('redirects legacy HTML pages out of the default production surface', async () => {
    const app = express();
    app.use(createProductionStaticSurfaceGuard());
    app.get('/analytics.html', (req, res) => res.status(200).send('legacy analytics'));

    const res = await request(app).get('/analytics.html').expect(302);
    expect(res.headers.location).toContain('/index.html');
    expect(res.headers.location).toContain('archived=%2Fanalytics.html');
    expect(res.headers.location).toContain('surfaceBucket=');
  });

  test('returns classified JSON for blocked legacy HTML when html is not accepted', async () => {
    const app = express();
    app.use(createProductionStaticSurfaceGuard({
      classifySurface: () => ({ active: false, bucket: 'archive' })
    }));
    app.get('/analytics.html', (req, res) => res.status(200).send('legacy analytics'));

    const res = await request(app)
      .get('/analytics.html')
      .set('Accept', 'application/json')
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.active).toBe(false);
    expect(res.body.surfaceBucket).toBe('archive');
  });

  test('classifies legacy surfaces from manifest by basename', () => {
    const classifySurface = createLegacySurfaceClassifier();

    expect(classifySurface('/index-ready.html')).toEqual({ active: false, bucket: 'archive' });
    expect(classifySurface('/admin-dashboard.html')).toEqual({ active: false, bucket: 'archive' });
    expect(classifySurface('/quotation-pro.html')).toEqual({ active: false, bucket: 'migration-candidate' });
  });

  test('legacy aliases redirect to active production pages', async () => {
    const app = express();
    app.use(createPageAliasesRouter());

    await request(app)
      .get('/analytics')
      .expect(302)
      .expect('Location', '/index.html');

    await request(app)
      .get('/admin')
      .expect(302)
      .expect('Location', '/login.html');
  });

  test('standalone module aliases redirect to retained portal surfaces', async () => {
    const app = express();
    app.use(createPageAliasesRouter());

    await request(app)
      .get('/rysnova')
      .expect(302)
      .expect('Location', '/index-ready.html');

    await request(app)
      .get('/rysnova-ai')
      .expect(302)
      .expect('Location', '/index-ready.html#contact');

  });
});

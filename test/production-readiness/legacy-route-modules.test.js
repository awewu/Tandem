const express = require('express');
const request = require('./helpers/in-process-request');

const createStandardsRouter = require('../../server/routes/standards.routes');

describe('retained legacy production route modules', () => {
  test('standards routes delegate compliance checks to the standards library', async () => {
    const engines = {
      standardsLibrary: {
        checkHotWaterCompliance: jest.fn().mockReturnValue({ summary: { complianceRate: '98%', grade: 'A' } }),
        checkDOASCompliance: jest.fn(),
        listAllStandards: jest.fn().mockReturnValue([{ code: 'GB 55020' }])
      }
    };
    const app = express();
    app.use(express.json());
    app.use(createStandardsRouter(engines));

    const compliance = await request(app)
      .post('/api/standards/hot-water-compliance')
      .send({ system: 'central-hot-water' })
      .expect(200);
    expect(compliance.body.success).toBe(true);
    expect(engines.standardsLibrary.checkHotWaterCompliance).toHaveBeenCalledWith({ system: 'central-hot-water' });

    const list = await request(app).get('/api/standards/list').expect(200);
    expect(list.body.data).toEqual([{ code: 'GB 55020' }]);
  });
});

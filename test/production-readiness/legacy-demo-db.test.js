const bcrypt = require('bcryptjs');
const { createProductionDemoDb } = require('../../server/fixtures/productionDemoDb');

describe('legacy production demo db fixture', () => {
  test('preserves legacy in-memory db shape while server-production is decomposed', () => {
    const db = createProductionDemoDb(bcrypt);

    expect(Array.isArray(db.users)).toBe(true);
    expect(Array.isArray(db.customers)).toBe(true);
    expect(Array.isArray(db.contracts)).toBe(true);
    expect(Array.isArray(db.techMaterials)).toBe(true);
    expect(Array.isArray(db.constructionTeams)).toBe(true);
    expect(Array.isArray(db.settlementRecords)).toBe(true);
    expect(Array.isArray(db.constructionTasks)).toBe(true);
    expect(db.users[0].password).toBeTruthy();
    expect(db.users[0].password).not.toBe('123456');
  });
});

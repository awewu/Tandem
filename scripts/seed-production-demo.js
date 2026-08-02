#!/usr/bin/env node

require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const Tenant = require('../server/models/Tenant');
const Dealer = require('../server/models/Dealer');
const Store = require('../server/models/Store');
const UserV2 = require('../server/models/UserV2');

function assertSeedAllowed(env = process.env) {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required for production demo seed');
  }

  if (env.NODE_ENV === 'production' && env.DEMO_MODE !== 'true') {
    throw new Error('Refusing to seed demo users in production unless DEMO_MODE=true');
  }
}

async function main() {
  assertSeedAllowed();

  await mongoose.connect(process.env.MONGODB_URI);

  const tenant = await Tenant.findOneAndUpdate(
    { code: 'RHAUTT-HQ' },
    {
      code: 'RHAUTT-HQ',
      name: 'Rhautt Comfort Headquarters',
      type: 'hq',
      status: 'active',
      settings: {
        pricingPolicy: 'standard',
        allowedBrands: ['Rheem', 'Ruud', 'Everhot', 'Rhautt Comfort'],
        featureFlags: new Map([
          ['crm', true],
          ['quotation', true]
        ])
      }
    },
    { upsert: true, new: true }
  );

  const dealer = await Dealer.findOneAndUpdate(
    { tenantId: tenant._id, code: 'DEALER-DEMO-001' },
    {
      tenantId: tenant._id,
      code: 'DEALER-DEMO-001',
      name: 'Rhautt Comfort Demo Dealer',
      province: '四川',
      city: '成都',
      contact: { name: 'Demo Admin', phone: '13900000000' },
      contractLevel: 'strategic',
      status: 'active'
    },
    { upsert: true, new: true }
  );

  const store = await Store.findOneAndUpdate(
    { tenantId: tenant._id, dealerId: dealer._id, code: 'STORE-DEMO-001' },
    {
      tenantId: tenant._id,
      dealerId: dealer._id,
      code: 'STORE-DEMO-001',
      name: 'Rhautt Comfort Demo Store',
      city: '成都',
      address: 'Demo Address',
      status: 'active'
    },
    { upsert: true, new: true }
  );

  const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || 'ChangeMe123!', 10);
  const users = [
    { phone: '13900000000', name: '总部管理员', role: 'hq_admin' },
    { phone: '13800000000', name: '经销商管理员', role: 'dealer_admin' },
    { phone: '13700000000', name: '门店经理', role: 'store_manager' },
    { phone: '13600000000', name: '设计师', role: 'designer' },
    { phone: '13500000000', name: '销售顾问', role: 'sales' }
  ];

  for (const user of users) {
    await UserV2.findOneAndUpdate(
      { phone: user.phone },
      {
        tenantId: tenant._id,
        dealerId: dealer._id,
        storeId: store._id,
        phone: user.phone,
        passwordHash,
        name: user.name,
        role: user.role,
        permissions: [],
        status: 'active'
      },
      { upsert: true, new: true }
    );
  }

  console.log(JSON.stringify({
    success: true,
    tenantId: tenant._id,
    dealerId: dealer._id,
    storeId: store._id,
    users: users.map(u => ({ phone: u.phone, role: u.role }))
  }, null, 2));

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = {
  assertSeedAllowed,
  main
};

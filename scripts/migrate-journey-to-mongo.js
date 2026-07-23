/**
 * 一键迁移: JSON DB → MongoDB
 * 使用:
 *   # 启动 mongo (Docker)
 *   docker run -d -p 27017:27017 --name mongo mongo:6
 *
 *   # 执行迁移
 *   $env:MONGODB_URI = "mongodb://localhost:27017/rheem-hvac"
 *   node scripts/migrate-journey-to-mongo.js
 *   node scripts/migrate-journey-to-mongo.js --reset   # 先清空 Mongo 再导入
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Journey = require('../server/models/Journey.model');

const JSON_PATH = path.join(__dirname, '..', 'data', 'customer-journeys.json');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rheem-hvac';
const RESET = process.argv.includes('--reset');

(async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  JSON → MongoDB 迁移');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('JSON source: ' + JSON_PATH);
  console.log('Mongo target: ' + MONGODB_URI);
  console.log('Reset mode: ' + RESET);
  console.log('');

  if (!fs.existsSync(JSON_PATH)) {
    console.error('❌ JSON DB 不存在: ' + JSON_PATH);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const journeys = Object.values(data.journeys || {});
  console.log('读取 JSON: ' + journeys.length + ' 个案例');

  if (journeys.length === 0) { console.log('⚠ JSON 为空，退出'); process.exit(0); }

  console.log('连接 MongoDB ...');
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('✓ 连接成功');

  if (RESET) {
    const r = await Journey.deleteMany({});
    console.log('✓ 清空旧数据: ' + r.deletedCount + ' 条');
  }

  let ok = 0, skip = 0, fail = 0;
  for (const j of journeys) {
    try {
      const exists = await Journey.findOne({ caseId: j.caseId }).lean();
      if (exists) { skip++; continue; }
      await Journey.create(j);
      ok++;
    } catch (e) {
      console.error('  ❌ ' + j.caseId + ': ' + e.message);
      fail++;
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  迁移完成');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  插入: ' + ok);
  console.log('  跳过(已存在): ' + skip);
  console.log('  失败: ' + fail);

  const total = await Journey.countDocuments();
  console.log('  Mongo 总数: ' + total);

  await mongoose.disconnect();
  console.log('✓ 断开连接');
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});

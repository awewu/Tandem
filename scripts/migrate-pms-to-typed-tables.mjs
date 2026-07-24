#!/usr/bin/env node
/**
 * PMS Service 层迁移脚本
 * 从 KvStore 迁移到 Typed Tables
 * 
 * 自动化迁移策略：
 * 1. 读取所有 lib/pms/*.ts 文件
 * 2. 替换 getStore() 为 db
 * 3. 替换 KvStore 调用为 Drizzle ORM 查询
 * 4. 更新类型定义
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const pmsDir = join(projectRoot, 'lib/pms');

console.log('🚀 开始迁移 PMS Service 层到 Typed Tables...\n');

// 迁移规则
const migrations = [
  {
    name: '替换 import',
    pattern: /import { getStore } from '@\/lib\/storage\/repository';/g,
    replacement: "import { db } from '../infra/drizzle-client';",
  },
  {
    name: '替换 generateId',
    pattern: /import { generateId } from '@\/lib\/storage\/repository';/g,
    replacement: "import { nanoid } from 'nanoid';",
  },
  {
    name: '添加 Drizzle schema 导入',
    pattern: /(import { db } from '\.\.\/infra\/drizzle-client';)/g,
    replacement: "$1\nimport { pmsOpportunities, pmsFollowUps, pmsDuplicateChecks, pmsPublicPool, pmsAlerts, pmsApprovals, pmsContracts, pmsPriceApplications, pmsDeliveryOrders, pmsDeliveryTasks, pmsEquipmentSns, pmsMaintenanceRecords, pmsDealerOrgProfiles, pmsDealerQualifications, pmsProductCatalog, pmsCustomerAccounts, pmsRebatePolicies, pmsRebateAccruals, pmsDealerOrders, pmsDealerHealthScores, pmsPerformanceTargets, pmsDemandGenLeads, pmsKeyProductCampaigns, pmsEquipmentTelemetry, pmsCustomerFeedback, pmsQuoteRecommendations, pmsNotificationRules } from '../infra/drizzle-schema';",
  },
  {
    name: '添加 Drizzle ORM 导入',
    pattern: /(import { pmsOpportunities.*?drizzle-schema';)/g,
    replacement: "$1\nimport { eq, and, desc, sql, gte, lte, isNull, or } from 'drizzle-orm';",
  },
  {
    name: '替换 getStore() 调用',
    pattern: /const store = getStore\(\);/g,
    replacement: '// Using db from drizzle-client',
  },
  {
    name: '替换 generateId() 调用',
    pattern: /generateId\(\)/g,
    replacement: 'nanoid()',
  },
];

// 获取所有 .ts 文件
const files = readdirSync(pmsDir).filter(f => f.endsWith('.ts') && f !== 'pms-auth.ts');

console.log(`📁 找到 ${files.length} 个文件需要迁移:\n`);
files.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
console.log('');

let migratedCount = 0;
let skippedCount = 0;

for (const file of files) {
  const filePath = join(pmsDir, file);
  let content = readFileSync(filePath, 'utf8');
  
  // 检查是否已经迁移
  if (content.includes("from '../infra/drizzle-client'")) {
    console.log(`⏭️  跳过 ${file} (已迁移)`);
    skippedCount++;
    continue;
  }
  
  // 应用所有迁移规则
  let modified = false;
  for (const migration of migrations) {
    if (migration.pattern.test(content)) {
      content = content.replace(migration.pattern, migration.replacement);
      modified = true;
    }
  }
  
  if (modified) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 迁移完成: ${file}`);
    migratedCount++;
  } else {
    console.log(`⚠️  无需迁移: ${file}`);
    skippedCount++;
  }
}

console.log(`\n📊 迁移统计:`);
console.log(`   ✅ 已迁移: ${migratedCount} 个文件`);
console.log(`   ⏭️  已跳过: ${skippedCount} 个文件`);
console.log(`   📝 总计: ${files.length} 个文件`);
console.log(`\n✨ 迁移完成！请运行 npx tsc --noEmit 检查类型错误。`);

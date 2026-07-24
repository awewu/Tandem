#!/usr/bin/env node
/**
 * PMS Partial 索引迁移脚本 (幂等 DDL)
 *
 * 背景:
 *   - KvStore 使用 JSONB 存储, 无字段级索引
 *   - 高频过滤键 (orgId/snCode/dedupeKey/status/archivedAt) 全表扫描 → 性能问题
 *
 * 方案:
 *   - 创建 JSONB partial 索引 (WHERE collection = 'pms_xxx')
 *   - 幂等执行 (CREATE INDEX IF NOT EXISTS)
 *
 * 用法:
 *   node scripts/pms-indexes.mjs
 *
 * 注意:
 *   - 不使用 drizzle-kit push (BANNED, 会删除 Prisma 遗留列)
 *   - 手动 DDL 脚本, 可重复执行
 */

import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env.local');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  onnotice: () => {}, // 静默 NOTICE
});

/**
 * PMS Partial 索引定义
 *
 * 格式: [索引名, collection, JSONB 键, 说明]
 */
const PMS_INDEXES = [
  // === 商机 (pms_opportunities) ===
  ['idx_pms_opp_orgid', 'pms_opportunities', 'orgId', '经销商组织隔离'],
  ['idx_pms_opp_dedupkey', 'pms_opportunities', 'dedupeKey', '查重键'],
  ['idx_pms_opp_status', 'pms_opportunities', 'status', '状态筛选'],
  ['idx_pms_opp_stage', 'pms_opportunities', 'stage', '阶段筛选'],
  ['idx_pms_opp_archived', 'pms_opportunities', 'archivedAt', '软删除过滤'],
  ['idx_pms_opp_dealer', 'pms_opportunities', 'dealerOrgId', '一级经销商筛选'],

  // === 跟进记录 (pms_follow_ups) ===
  ['idx_pms_followup_oppid', 'pms_follow_ups', 'opportunityId', '商机关联'],
  ['idx_pms_followup_userid', 'pms_follow_ups', 'userId', '跟进人筛选'],

  // === 查重 (pms_duplicate_checks) ===
  ['idx_pms_dupcheck_oppid', 'pms_duplicate_checks', 'opportunityId', '商机关联'],
  ['idx_pms_dupcheck_status', 'pms_duplicate_checks', 'status', '处理状态'],

  // === 价格申请 (pms_price_applications) ===
  ['idx_pms_price_oppid', 'pms_price_applications', 'opportunityId', '商机关联'],
  ['idx_pms_price_status', 'pms_price_applications', 'approvalStatus', '审批状态'],

  // === 合同 (pms_contracts) ===
  ['idx_pms_contract_oppid', 'pms_contracts', 'opportunityId', '商机关联'],
  ['idx_pms_contract_status', 'pms_contracts', 'approvalStatus', '审批状态'],

  // === 公海池 (pms_public_pool) ===
  ['idx_pms_pool_oppid', 'pms_public_pool', 'opportunityId', '商机关联'],
  ['idx_pms_pool_status', 'pms_public_pool', 'status', '可认领状态'],

  // === 审批 (pms_approvals) ===
  ['idx_pms_approval_entity', 'pms_approvals', 'entityId', '实体关联'],
  ['idx_pms_approval_status', 'pms_approvals', 'status', '审批状态'],

  // === 预警 (pms_alerts) ===
  ['idx_pms_alert_entity', 'pms_alerts', 'entityId', '实体关联'],
  ['idx_pms_alert_status', 'pms_alerts', 'status', '处理状态'],
  ['idx_pms_alert_role', 'pms_alerts', 'targetRole', '角色筛选'],

  // === 经销商组织 (pms_dealer_orgs) ===
  ['idx_pms_dealer_status', 'pms_dealer_orgs', 'status', '状态筛选'],
  ['idx_pms_dealer_level', 'pms_dealer_orgs', 'level', '一级/二级筛选'],

  // === 资质 (pms_dealer_qualifications) ===
  ['idx_pms_qual_dealer', 'pms_dealer_qualifications', 'dealerOrgId', '经销商筛选'],
  ['idx_pms_qual_type', 'pms_dealer_qualifications', 'type', '资质类型筛选'],
  ['idx_pms_qual_status', 'pms_dealer_qualifications', 'status', '状态筛选'],

  // === 交付工单 (pms_delivery_orders) ===
  ['idx_pms_delivery_contract', 'pms_delivery_orders', 'contractId', '合同关联'],
  ['idx_pms_delivery_stage', 'pms_delivery_orders', 'stage', '阶段筛选'],

  // === 维保 (pms_maintenance_records) ===
  ['idx_pms_maint_delivery', 'pms_maintenance_records', 'deliveryOrderId', '交付关联'],
  ['idx_pms_maint_sn', 'pms_maintenance_records', 'equipmentSNId', 'SN 关联'],
  ['idx_pms_maint_status', 'pms_maintenance_records', 'status', '状态筛选'],

  // === 设备 SN (pms_equipment_sns) ===
  ['idx_pms_sn_code', 'pms_equipment_sns', 'snCode', 'SN 码查询 (唯一性)'],
  ['idx_pms_sn_batch', 'pms_equipment_sns', 'productionBatchId', '批次查询 (召回)'],
  ['idx_pms_sn_delivery', 'pms_equipment_sns', 'deliveryOrderId', '交付关联'],
  ['idx_pms_sn_status', 'pms_equipment_sns', 'status', '状态筛选'],

  // === 返利 (pms_rebate_accruals) ===
  ['idx_pms_rebate_dealer', 'pms_rebate_accruals', 'dealerOrgId', '经销商筛选'],
  ['idx_pms_rebate_period', 'pms_rebate_accruals', 'period', '周期筛选'],
  ['idx_pms_rebate_status', 'pms_rebate_accruals', 'status', '状态筛选'],

  // === 订货 (pms_dealer_orders) ===
  ['idx_pms_order_dealer', 'pms_dealer_orders', 'dealerOrgId', '经销商筛选'],
  ['idx_pms_order_status', 'pms_dealer_orders', 'status', '状态筛选'],

  // === 业绩目标 (pms_performance_targets) ===
  ['idx_pms_perf_dimension', 'pms_performance_targets', 'dimension', '维度筛选'],
  ['idx_pms_perf_period', 'pms_performance_targets', 'period', '周期筛选'],

  // === 线索开发 (pms_demand_gen_leads) ===
  ['idx_pms_lead_status', 'pms_demand_gen_leads', 'status', '状态筛选'],
  ['idx_pms_lead_source', 'pms_demand_gen_leads', 'leadSource', '来源筛选'],

  // === 产品目录 (pms_product_catalog) ===
  ['idx_pms_product_series', 'pms_product_catalog', 'series', '系列筛选'],
  ['idx_pms_product_model', 'pms_product_catalog', 'model', '型号查询'],
  ['idx_pms_product_status', 'pms_product_catalog', 'status', '状态筛选'],

  // === 客户账户 (pms_customer_accounts) ===
  ['idx_pms_customer_name', 'pms_customer_accounts', 'name', '客户名称查询'],
  ['idx_pms_customer_dealer', 'pms_customer_accounts', 'dealerOrgId', '经销商筛选'],
  ['idx_pms_customer_status', 'pms_customer_accounts', 'status', '状态筛选'],
];

async function createPmsIndexes() {
  console.log('🔧 Creating PMS partial indexes...\n');

  let created = 0;
  let skipped = 0;

  for (const [indexName, collection, jsonKey, description] of PMS_INDEXES) {
    try {
      // 幂等创建索引
      await sql.unsafe(`
        CREATE INDEX IF NOT EXISTS ${indexName}
        ON kv_store ((data->>'${jsonKey}'))
        WHERE collection = '${collection}';
      `);

      console.log(`✅ ${indexName.padEnd(35)} ${description}`);
      created++;
    } catch (err) {
      console.error(`❌ ${indexName.padEnd(35)} ${err.message}`);
      skipped++;
    }
  }

  console.log(`\n📊 Summary: ${created} created, ${skipped} skipped`);
}

async function main() {
  try {
    await createPmsIndexes();
    console.log('\n✅ PMS indexes migration completed');
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

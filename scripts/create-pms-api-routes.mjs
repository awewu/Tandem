#!/usr/bin/env node
/**
 * 批量创建 PMS API 路由
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const apiDir = join(projectRoot, 'app/api/pms');

const routes = [
  { name: 'contracts', service: 'contract-service' },
  { name: 'price-applications', service: 'price-application-service' },
  { name: 'delivery-orders', service: 'delivery-service' },
  { name: 'equipment-sns', service: 'equipment-sn-service' },
  { name: 'maintenance', service: 'maintenance-service' },
  { name: 'products', service: 'product-service' },
  { name: 'rebates', service: 'rebate-service' },
  { name: 'analytics', service: 'analytics-service' },
  { name: 'public-pool', service: 'opportunity-service' },
];

console.log('🚀 开始创建 PMS API 路由...\n');

let created = 0;
let skipped = 0;

for (const route of routes) {
  const routeDir = join(apiDir, route.name);
  const routeFile = join(routeDir, 'route.ts');
  
  if (existsSync(routeFile)) {
    console.log(`⏭️  跳过 ${route.name} (已存在)`);
    skipped++;
    continue;
  }
  
  mkdirSync(routeDir, { recursive: true });
  
  const content = `/**
 * PMS API · ${route.name}
 */

import { NextRequest, NextResponse } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(req: NextRequest) {
  await boot();
  const auth = await requireAuth(req);
  
  try {
    // TODO: Implement GET logic
    return NextResponse.json({ data: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = await requireAuth(req);
  
  try {
    const body = await req.json();
    // TODO: Implement POST logic
    return NextResponse.json({ data: {} });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`;
  
  writeFileSync(routeFile, content, 'utf8');
  console.log(`✅ 创建: ${route.name}/route.ts`);
  created++;
}

console.log(`\n📊 创建统计:`);
console.log(`   ✅ 已创建: ${created} 个路由`);
console.log(`   ⏭️  已跳过: ${skipped} 个路由`);
console.log(`\n✨ API 路由创建完成！`);

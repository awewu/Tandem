# W-BIM · 上线前检查清单（2026-07-06）

> 本清单覆盖 Sprint 1-5 所有骨架已落地能力，确保上线前最低可运行。

## 1. 环境 / 依赖

- [ ] 后端 `npm install` 完成（`services/api`）
- [ ] 前端 `npm install` 完成（`apps/designer-workbench`）
- [ ] PostgreSQL 可连接，且已执行 `node scripts/db/apply-migrations.js`
- [ ] 对象存储（MinIO/S3）已配置
- [ ] `BIM_WEBHOOK_URL` 等环境变量已配置（可选）

## 2. 后端构建

- [ ] `npm run build` 通过（`services/api`）
- [ ] `npm run lint` 通过
- [ ] `npm run test` 通过（包括 `bcf.spec.ts` 等）
- [ ] boot-smoke 模式启动无报错（`TARGET_API_BOOT_SMOKE=true`）

## 3. 前端构建

- [ ] `npm run typecheck` 通过（`apps/designer-workbench`）
- [ ] `npm run build` 通过
- [ ] `next.config.js` 中 wasm 规则生效
- [ ] `public/small.ifc` 文件存在

## 4. 核心路由冒烟

- [ ] `/floor-plan` 可加载 CAD 底图、画墙、布管、放设备、保存/加载
- [ ] `/floor-plan` 点击 **3D 预览** 可渲染墙体/管线/设备
- [ ] `/viewer` 可加载 `public/small.ifc`
- [ ] `/ai-design` 可生成方案、确认、复核、生成报价
- [ ] `/bom` 可显示 BOM/出图占位
- [ ] `/api/rysnova-bim/projects` 列表正常
- [ ] `/api/ai-design/boundary` 返回模块边界规范
- [ ] `/api/rysnova-bim/cloud/clash` / `/ifc` / `/boq` 返回占位

## 5. 安全 / RLS / RBAC

- [ ] `sales` 角色不能调用 `POST /api/ai-design/verify`
- [ ] `engineer`/`designer` 可调用 `verify` / `review`
- [ ] 所有写入接口携带 `tenantId` 并经过 RLS
- [ ] 文件上传 evidence 记录写入对象存储元数据

## 6. 数据 / 迁移

- [ ] `028_w_bim_ai_design_and_floor_plan.sql` 已应用
- [ ] `floor_plans` 表包含 `pipes` / `devices` / `cad_image_url`
- [ ] `ai_design_audits` 表已创建
- [ ] `v_bim_project_delivery` 视图存在

## 7. 文档

- [ ] `docs/RYSNOVA-BIM-WORK-PLAN-2026-07.md` 已更新状态
- [ ] `revit-plugin/README.md` 已更新 API 命名空间
- [ ] `apps/designer-workbench/README.md` 已更新路由总览
- [ ] 本清单已创建

## 8. 已知上线后待续

- 3.3 自动计算管长与辅材需真实几何内核
- 4.2 自动盘管/布管/选型需算法替换占位输出
- 4.5 `select-quote` 需接入 product-catalog/quote 真实价格
- 5.1 Revit 插件 C# 端需按新命名空间重新编译

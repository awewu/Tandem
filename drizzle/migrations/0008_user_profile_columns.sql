-- Migration 0008: 补齐 User 表 profile 列 (schema drift 修复)
-- lib/infra/drizzle-schema.ts 的 user 表声明了 departmentId/managerId/jobTitle/
-- employeeId/hireDate/workLocation/phone 7 列, 且 drizzle-store.findByEmail 用
-- db.select() 全选这些列; 但 0000-0007 的 migration 从未创建它们 → 全新迁移的库
-- 缺列, 导致 bootstrap owner 及所有 auth 查询报 `column "departmentId" does not exist`.
-- 注: 这些字段的真实值实际落在 KvStore 'auth_user_extras' 命名空间, User 表列为
--     兼容 select() 全列读取而存在 (vestigial). 全部 nullable text, 幂等可重跑.

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "departmentId" text;

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managerId" text;

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jobTitle" text;

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "employeeId" text;

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hireDate" text;

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workLocation" text;

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" text;

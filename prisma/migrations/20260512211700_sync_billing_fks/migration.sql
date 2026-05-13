-- Sync billing schema: defaults, indexes, foreign keys

-- Fix defaults for Prisma-managed timestamps/IDs
ALTER TABLE "Plan" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "Plan" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "currentPeriodStart" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "currentPeriodEnd" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Workspace" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "Workspace" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Missing indexes
CREATE INDEX IF NOT EXISTS "Subscription_workspaceId_idx" ON "Subscription"("workspaceId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX IF NOT EXISTS "Workspace_slug_idx" ON "Workspace"("slug");
CREATE INDEX IF NOT EXISTS "Workspace_subscriptionStatus_idx" ON "Workspace"("subscriptionStatus");

-- Foreign keys
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_workspaceId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Workspace" DROP CONSTRAINT IF EXISTS "Workspace_planId_fkey";
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_workspaceId_fkey";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_planId_fkey";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rename manual index to Prisma convention
ALTER INDEX IF EXISTS "idx_user_workspace" RENAME TO "User_workspaceId_idx";

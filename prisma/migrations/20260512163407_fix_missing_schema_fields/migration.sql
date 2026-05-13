-- Fix missing schema fields: Workspace, Plan, Subscription, User.workspaceId

-- Workspace
CREATE TABLE IF NOT EXISTS "Workspace" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  "logoUrl" TEXT,
  description TEXT,
  "planId" TEXT,
  "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
  settings JSONB NOT NULL DEFAULT '{}',
  "maxUsers" INTEGER NOT NULL DEFAULT 10,
  "maxStorageMb" INTEGER NOT NULL DEFAULT 1024,
  "maxChannels" INTEGER DEFAULT 10,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Plan
CREATE TABLE IF NOT EXISTS "Plan" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  description TEXT,
  "priceMonthCents" INTEGER NOT NULL DEFAULT 0,
  "priceYearCents" INTEGER NOT NULL DEFAULT 0,
  "maxUsers" INTEGER NOT NULL DEFAULT 10,
  "maxStorageMb" INTEGER NOT NULL DEFAULT 1024,
  "maxChannels" INTEGER NOT NULL DEFAULT 10,
  "apiRateLimitRpm" INTEGER NOT NULL DEFAULT 60,
  features JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subscription
CREATE TABLE IF NOT EXISTS "Subscription" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workspaceId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'stripe',
  "providerSubId" TEXT,
  status TEXT NOT NULL DEFAULT 'trialing',
  "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User.workspaceId
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
CREATE INDEX IF NOT EXISTS idx_user_workspace ON "User"("workspaceId");

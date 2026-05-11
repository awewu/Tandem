/*
  Warnings:

  - You are about to drop the column `aiDraftGenerated` on the `CheckIn` table. All the data in the column will be lost.
  - You are about to drop the column `approvedByOwner` on the `CheckIn` table. All the data in the column will be lost.
  - You are about to drop the column `cycleId` on the `CheckIn` table. All the data in the column will be lost.
  - You are about to drop the column `krUpdates` on the `CheckIn` table. All the data in the column will be lost.
  - You are about to drop the column `nextWeekPlan` on the `CheckIn` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `CheckIn` table. All the data in the column will be lost.
  - You are about to drop the column `ttiUpdates` on the `CheckIn` table. All the data in the column will be lost.
  - You are about to drop the column `weekStart` on the `CheckIn` table. All the data in the column will be lost.
  - You are about to drop the column `whatWentWell` on the `CheckIn` table. All the data in the column will be lost.
  - You are about to drop the column `whatWentWrong` on the `CheckIn` table. All the data in the column will be lost.
  - Added the required column `authorId` to the `CheckIn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `confidenceAfter` to the `CheckIn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `confidenceBefore` to the `CheckIn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `progressAfter` to the `CheckIn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `progressBefore` to the `CheckIn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scope` to the `CheckIn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scopeId` to the `CheckIn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Objective` table without a default value. This is not possible if the table is not empty.

*/
-- A2.1a (2026-05-10) D5: demo data is dropped, real-backend cutover.
-- CheckIn 模型从 weekly 改为 scope-based, 字段全换, 直接 TRUNCATE 既存行.
-- Objective.updatedAt 临时 default now() 用于 backfill, 之后由 @updatedAt 接管.
TRUNCATE TABLE "CheckIn";

-- DropForeignKey
ALTER TABLE "CheckIn" DROP CONSTRAINT "CheckIn_cycleId_fkey";

-- DropForeignKey
ALTER TABLE "CheckIn" DROP CONSTRAINT "CheckIn_ownerId_fkey";

-- DropIndex
DROP INDEX "CheckIn_cycleId_idx";

-- DropIndex
DROP INDEX "CheckIn_ownerId_weekStart_idx";

-- AlterTable
ALTER TABLE "CheckIn" DROP COLUMN "aiDraftGenerated",
DROP COLUMN "approvedByOwner",
DROP COLUMN "cycleId",
DROP COLUMN "krUpdates",
DROP COLUMN "nextWeekPlan",
DROP COLUMN "ownerId",
DROP COLUMN "ttiUpdates",
DROP COLUMN "weekStart",
DROP COLUMN "whatWentWell",
DROP COLUMN "whatWentWrong",
ADD COLUMN     "achievements" TEXT,
ADD COLUMN     "authorId" TEXT NOT NULL,
ADD COLUMN     "blockers" TEXT,
ADD COLUMN     "confidenceAfter" TEXT NOT NULL,
ADD COLUMN     "confidenceBefore" TEXT NOT NULL,
ADD COLUMN     "mood" TEXT,
ADD COLUMN     "nextSteps" TEXT,
ADD COLUMN     "progressAfter" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "progressBefore" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "scope" TEXT NOT NULL,
ADD COLUMN     "scopeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "KeyResult" ADD COLUMN     "collaboratorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "finalScore" DOUBLE PRECISION,
ADD COLUMN     "selfScore" DOUBLE PRECISION,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "watcherIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 100,
ALTER COLUMN "measureType" SET DEFAULT 'numeric',
ALTER COLUMN "computeMethod" SET DEFAULT 'latest',
ALTER COLUMN "startValue" SET DEFAULT 0,
ALTER COLUMN "currentValue" SET DEFAULT 0,
ALTER COLUMN "confidence" SET DEFAULT 'on-track',
ALTER COLUMN "riskStatus" SET DEFAULT 'on_track';

-- AlterTable
ALTER TABLE "Objective" ADD COLUMN     "collaboratorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "confidence" TEXT NOT NULL DEFAULT 'on-track',
ADD COLUMN     "finalScore" DOUBLE PRECISION,
ADD COLUMN     "managerScore" DOUBLE PRECISION,
ADD COLUMN     "retrospective" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "selfScore" DOUBLE PRECISION,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "watcherIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 100;

-- CreateIndex
CREATE INDEX "CheckIn_scope_scopeId_idx" ON "CheckIn"("scope", "scopeId");

-- CreateIndex
CREATE INDEX "CheckIn_authorId_idx" ON "CheckIn"("authorId");

-- CreateIndex
CREATE INDEX "CheckIn_createdAt_idx" ON "CheckIn"("createdAt");

-- CreateIndex
CREATE INDEX "KeyResult_status_idx" ON "KeyResult"("status");

-- CreateIndex
CREATE INDEX "Objective_status_idx" ON "Objective"("status");

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ImChannel" ADD COLUMN     "autoCreated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "projectEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MemoryEntry" ADD COLUMN     "ownerDepartmentId" TEXT,
ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "ownershipLevel" TEXT NOT NULL DEFAULT 'company';

-- CreateIndex
CREATE INDEX "ImChannel_departmentId_idx" ON "ImChannel"("departmentId");

-- CreateIndex
CREATE INDEX "MemoryEntry_ownershipLevel_idx" ON "MemoryEntry"("ownershipLevel");

-- CreateIndex
CREATE INDEX "MemoryEntry_ownerUserId_idx" ON "MemoryEntry"("ownerUserId");

-- CreateIndex
CREATE INDEX "MemoryEntry_ownerDepartmentId_idx" ON "MemoryEntry"("ownerDepartmentId");

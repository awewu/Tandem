-- AlterTable
ALTER TABLE "Objective" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "OneOnOneMeeting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "managerId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'biweekly',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "agendaManager" TEXT,
    "agendaReport" TEXT,
    "noteProgress" TEXT,
    "noteBlockers" TEXT,
    "noteNextSteps" TEXT,
    "linkedKrIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moodScore" INTEGER,
    "privateManagerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneOnOneMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneOnOneActionItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "linkedInitiativeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneOnOneActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review360Cycle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "questions" JSONB NOT NULL,
    "anonymizePeers" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review360Cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review360Submission" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "raterType" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "strengths" TEXT NOT NULL,
    "improvements" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review360Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review360Assignment" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "raterType" TEXT NOT NULL,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review360Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OneOnOneMeeting_tenantId_idx" ON "OneOnOneMeeting"("tenantId");

-- CreateIndex
CREATE INDEX "OneOnOneMeeting_managerId_idx" ON "OneOnOneMeeting"("managerId");

-- CreateIndex
CREATE INDEX "OneOnOneMeeting_reportId_idx" ON "OneOnOneMeeting"("reportId");

-- CreateIndex
CREATE INDEX "OneOnOneMeeting_scheduledAt_idx" ON "OneOnOneMeeting"("scheduledAt");

-- CreateIndex
CREATE INDEX "OneOnOneActionItem_meetingId_idx" ON "OneOnOneActionItem"("meetingId");

-- CreateIndex
CREATE INDEX "OneOnOneActionItem_assigneeId_idx" ON "OneOnOneActionItem"("assigneeId");

-- CreateIndex
CREATE INDEX "OneOnOneActionItem_linkedInitiativeId_idx" ON "OneOnOneActionItem"("linkedInitiativeId");

-- CreateIndex
CREATE INDEX "Review360Cycle_tenantId_idx" ON "Review360Cycle"("tenantId");

-- CreateIndex
CREATE INDEX "Review360Cycle_status_idx" ON "Review360Cycle"("status");

-- CreateIndex
CREATE INDEX "Review360Cycle_createdBy_idx" ON "Review360Cycle"("createdBy");

-- CreateIndex
CREATE INDEX "Review360Submission_cycleId_idx" ON "Review360Submission"("cycleId");

-- CreateIndex
CREATE INDEX "Review360Submission_subjectId_idx" ON "Review360Submission"("subjectId");

-- CreateIndex
CREATE INDEX "Review360Assignment_cycleId_idx" ON "Review360Assignment"("cycleId");

-- CreateIndex
CREATE INDEX "Review360Assignment_raterId_submitted_idx" ON "Review360Assignment"("raterId", "submitted");

-- CreateIndex
CREATE UNIQUE INDEX "Review360Assignment_cycleId_subjectId_raterId_key" ON "Review360Assignment"("cycleId", "subjectId", "raterId");

-- AddForeignKey
ALTER TABLE "OneOnOneActionItem" ADD CONSTRAINT "OneOnOneActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "OneOnOneMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review360Submission" ADD CONSTRAINT "Review360Submission_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Review360Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review360Assignment" ADD CONSTRAINT "Review360Assignment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Review360Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

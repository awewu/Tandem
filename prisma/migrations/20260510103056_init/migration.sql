-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "departmentId" TEXT,
    "managerId" TEXT,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ssoBindings" JSONB,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordHash" (
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'argon2id',
    "mustChange" BOOLEAN NOT NULL DEFAULT false,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "historyHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "PasswordHash_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceFingerprint" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,
    "refreshTokenHash" TEXT NOT NULL,
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaSecret" (
    "userId" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "recoveryCodeHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "MfaSecret_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "email" TEXT,
    "presetRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "presetDepartmentId" TEXT,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "invitedById" TEXT NOT NULL,
    "note" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "eventType" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionCard" (
    "id" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT 'tandem.v1',
    "title" TEXT NOT NULL,
    "decisionClass" TEXT NOT NULL,
    "convergenceState" TEXT NOT NULL,
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "hardDeadlineAt" TIMESTAMP(3),
    "relatedKr" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedTti" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "origins" JSONB,
    "materialRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "options" JSONB NOT NULL,
    "selected" TEXT,
    "selectedById" TEXT,
    "selectedAt" TIMESTAMP(3),
    "expectedKrImpact" JSONB,
    "retrospective" JSONB,
    "vetoWindowEnds" TIMESTAMP(3),
    "watermark" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DecisionCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "decisionCardId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT 'tandem.v1',
    "stage" TEXT NOT NULL,
    "stageEnteredAt" TIMESTAMP(3) NOT NULL,
    "delegationLevel" TEXT NOT NULL,
    "decisionHistory" JSONB NOT NULL,
    "styleProfile" JSONB NOT NULL,
    "growthAreas" JSONB NOT NULL,
    "bossCaptureScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataOwnership" JSONB NOT NULL,
    "learningActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Origin" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "encryptedBlobRef" TEXT,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Origin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "originRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visibility" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryEntry" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceMaterialId" TEXT,
    "signers" JSONB NOT NULL,
    "publicReviewUntil" TIMESTAMP(3),
    "referenceCount" INTEGER NOT NULL DEFAULT 0,
    "lastReferencedAt" TIMESTAMP(3),
    "supersedes" TEXT,
    "supersededBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryPromotionRequest" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "proposedType" TEXT NOT NULL,
    "proposedTitle" TEXT NOT NULL,
    "proposedBody" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "signers" JSONB NOT NULL,
    "publicReviewUntil" TIMESTAMP(3),
    "isEmergencyTrack" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalDecisionAt" TIMESTAMP(3),

    CONSTRAINT "MemoryPromotionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Steward" (
    "userId" TEXT NOT NULL,
    "appointedAt" TIMESTAMP(3) NOT NULL,
    "conflictWith" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Steward_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "parentObjectiveId" TEXT,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyResult" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "coOwnerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "title" TEXT NOT NULL,
    "measureType" TEXT NOT NULL,
    "computeMethod" TEXT NOT NULL,
    "startValue" DOUBLE PRECISION NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "confidence" TEXT NOT NULL,
    "riskStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TTI" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "successCriteria" TEXT NOT NULL,
    "startValue" DOUBLE PRECISION,
    "targetValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "unit" TEXT,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yearEndBonusModifier" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TTI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "decisionCardIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "krUpdates" JSONB NOT NULL,
    "ttiUpdates" JSONB NOT NULL,
    "whatWentWell" TEXT,
    "whatWentWrong" TEXT,
    "nextWeekPlan" TEXT,
    "aiDraftGenerated" BOOLEAN NOT NULL DEFAULT false,
    "approvedByOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImChannel" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "topic" TEXT,
    "visibility" TEXT NOT NULL,
    "memberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "linkedDecisionCardId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderKind" TEXT NOT NULL DEFAULT 'user',
    "body" TEXT NOT NULL,
    "mentions" JSONB NOT NULL DEFAULT '[]',
    "attachments" JSONB,
    "parentMessageId" TEXT,
    "spawnedDecisionCardId" TEXT,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImMembership" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "notifyOn" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ImMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NineBoxSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "kpiScore" DOUBLE PRECISION NOT NULL,
    "ttiScore" DOUBLE PRECISION NOT NULL,
    "cell" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NineBoxSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DecisionInitiatives" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_codeHash_key" ON "Invite"("codeHash");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");

-- CreateIndex
CREATE INDEX "Invite_invitedById_idx" ON "Invite"("invitedById");

-- CreateIndex
CREATE INDEX "AuthEvent_userId_idx" ON "AuthEvent"("userId");

-- CreateIndex
CREATE INDEX "AuthEvent_email_idx" ON "AuthEvent"("email");

-- CreateIndex
CREATE INDEX "AuthEvent_eventType_idx" ON "AuthEvent"("eventType");

-- CreateIndex
CREATE INDEX "AuthEvent_createdAt_idx" ON "AuthEvent"("createdAt");

-- CreateIndex
CREATE INDEX "DecisionCard_convergenceState_idx" ON "DecisionCard"("convergenceState");

-- CreateIndex
CREATE INDEX "DecisionCard_createdById_idx" ON "DecisionCard"("createdById");

-- CreateIndex
CREATE INDEX "DecisionCard_createdAt_idx" ON "DecisionCard"("createdAt");

-- CreateIndex
CREATE INDEX "ActionItem_ownerId_idx" ON "ActionItem"("ownerId");

-- CreateIndex
CREATE INDEX "ActionItem_status_idx" ON "ActionItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Persona_userId_key" ON "Persona"("userId");

-- CreateIndex
CREATE INDEX "Origin_expiresAt_idx" ON "Origin"("expiresAt");

-- CreateIndex
CREATE INDEX "Material_type_idx" ON "Material"("type");

-- CreateIndex
CREATE INDEX "Material_visibility_idx" ON "Material"("visibility");

-- CreateIndex
CREATE INDEX "MemoryEntry_type_status_idx" ON "MemoryEntry"("type", "status");

-- CreateIndex
CREATE INDEX "MemoryEntry_status_idx" ON "MemoryEntry"("status");

-- CreateIndex
CREATE INDEX "MemoryPromotionRequest_status_idx" ON "MemoryPromotionRequest"("status");

-- CreateIndex
CREATE INDEX "MemoryPromotionRequest_createdById_idx" ON "MemoryPromotionRequest"("createdById");

-- CreateIndex
CREATE INDEX "Objective_cycleId_idx" ON "Objective"("cycleId");

-- CreateIndex
CREATE INDEX "Objective_ownerId_idx" ON "Objective"("ownerId");

-- CreateIndex
CREATE INDEX "KeyResult_objectiveId_idx" ON "KeyResult"("objectiveId");

-- CreateIndex
CREATE INDEX "KeyResult_ownerId_idx" ON "KeyResult"("ownerId");

-- CreateIndex
CREATE INDEX "TTI_cycleId_idx" ON "TTI"("cycleId");

-- CreateIndex
CREATE INDEX "TTI_ownerId_idx" ON "TTI"("ownerId");

-- CreateIndex
CREATE INDEX "Initiative_keyResultId_idx" ON "Initiative"("keyResultId");

-- CreateIndex
CREATE INDEX "CheckIn_ownerId_weekStart_idx" ON "CheckIn"("ownerId", "weekStart");

-- CreateIndex
CREATE INDEX "CheckIn_cycleId_idx" ON "CheckIn"("cycleId");

-- CreateIndex
CREATE INDEX "ImChannel_type_idx" ON "ImChannel"("type");

-- CreateIndex
CREATE INDEX "ImChannel_createdById_idx" ON "ImChannel"("createdById");

-- CreateIndex
CREATE INDEX "ImChannel_lastMessageAt_idx" ON "ImChannel"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ImMessage_channelId_createdAt_idx" ON "ImMessage"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "ImMessage_senderId_idx" ON "ImMessage"("senderId");

-- CreateIndex
CREATE INDEX "ImMessage_parentMessageId_idx" ON "ImMessage"("parentMessageId");

-- CreateIndex
CREATE INDEX "ImMembership_userId_idx" ON "ImMembership"("userId");

-- CreateIndex
CREATE INDEX "ImMembership_channelId_idx" ON "ImMembership"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ImMembership_channelId_userId_key" ON "ImMembership"("channelId", "userId");

-- CreateIndex
CREATE INDEX "NineBoxSnapshot_userId_cycleId_idx" ON "NineBoxSnapshot"("userId", "cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "_DecisionInitiatives_AB_unique" ON "_DecisionInitiatives"("A", "B");

-- CreateIndex
CREATE INDEX "_DecisionInitiatives_B_index" ON "_DecisionInitiatives"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordHash" ADD CONSTRAINT "PasswordHash_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaSecret" ADD CONSTRAINT "MfaSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionCard" ADD CONSTRAINT "DecisionCard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_decisionCardId_fkey" FOREIGN KEY ("decisionCardId") REFERENCES "DecisionCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryPromotionRequest" ADD CONSTRAINT "MemoryPromotionRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_parentObjectiveId_fkey" FOREIGN KEY ("parentObjectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyResult" ADD CONSTRAINT "KeyResult_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TTI" ADD CONSTRAINT "TTI_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TTI" ADD CONSTRAINT "TTI_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "KeyResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImMessage" ADD CONSTRAINT "ImMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ImChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImMessage" ADD CONSTRAINT "ImMessage_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "ImMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImMembership" ADD CONSTRAINT "ImMembership_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "ImChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionInitiatives" ADD CONSTRAINT "_DecisionInitiatives_A_fkey" FOREIGN KEY ("A") REFERENCES "DecisionCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionInitiatives" ADD CONSTRAINT "_DecisionInitiatives_B_fkey" FOREIGN KEY ("B") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

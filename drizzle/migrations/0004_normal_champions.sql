CREATE TABLE "Certification" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"courseId" text NOT NULL,
	"enrollmentId" text NOT NULL,
	"earnedAt" timestamp (3) DEFAULT now() NOT NULL,
	"expiresAt" timestamp (3),
	"status" text DEFAULT 'valid' NOT NULL,
	"certNo" text NOT NULL,
	"contentHashAtEarning" text DEFAULT '' NOT NULL,
	"signedBy" text,
	"unlockedDelegationLevel" text,
	"unlockedProficiencyBoost" jsonb,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Course" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"modeAffinity" text[] DEFAULT '{}' NOT NULL,
	"level" text DEFAULT 'beginner' NOT NULL,
	"estMinutes" integer DEFAULT 0 NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"coverUrl" text,
	"ownerUserId" text NOT NULL,
	"createdByUserId" text NOT NULL,
	"reviewedByUserIds" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"publishedAt" timestamp (3),
	"requirement" text DEFAULT 'elective' NOT NULL,
	"proficiencyReward" jsonb,
	"bossCaptureBonus" integer DEFAULT 0 NOT NULL,
	"unlocksDelegationLevel" text,
	"lockOnExpiry" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"contentHash" text DEFAULT '' NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"deletedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "CourseAssignment" (
	"id" text PRIMARY KEY NOT NULL,
	"courseId" text NOT NULL,
	"targetType" text NOT NULL,
	"targetUserId" text,
	"targetDepartmentId" text,
	"targetRole" text,
	"assignedByUserId" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"dueInDays" integer,
	"reminderPolicy" jsonb,
	"blocksUntilCompletion" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Enrollment" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"courseId" text NOT NULL,
	"source" text DEFAULT 'self_elected' NOT NULL,
	"assignmentId" text,
	"status" text DEFAULT 'enrolled' NOT NULL,
	"enrolledAt" timestamp (3) DEFAULT now() NOT NULL,
	"startedAt" timestamp (3),
	"completedAt" timestamp (3),
	"dueAt" timestamp (3),
	"lessonsCompleted" text[] DEFAULT '{}' NOT NULL,
	"totalScore" integer,
	"tenantId" text DEFAULT 'default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "LearningMcpToken" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"tokenHash" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"rateLimitPerHour" integer DEFAULT 30 NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"lastUsedAt" timestamp (3),
	"totalCalls" integer DEFAULT 0 NOT NULL,
	"revokedAt" timestamp (3),
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Lesson" (
	"id" text PRIMARY KEY NOT NULL,
	"courseId" text NOT NULL,
	"orderIdx" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'lecture' NOT NULL,
	"estMinutes" integer DEFAULT 0 NOT NULL,
	"contentMarkdown" text,
	"contentVideoUrl" text,
	"contentInteractiveSchema" jsonb,
	"aiGeneratedAt" timestamp (3),
	"aiSourceId" text,
	"aiReviewedBy" text,
	"passCondition" jsonb,
	"linkedKrId" text,
	"rewardMode" text,
	"rewardScore" integer DEFAULT 0 NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "LessonAttempt" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollmentId" text NOT NULL,
	"userId" text NOT NULL,
	"lessonId" text NOT NULL,
	"attemptNo" integer DEFAULT 1 NOT NULL,
	"startedAt" timestamp (3) DEFAULT now() NOT NULL,
	"submittedAt" timestamp (3),
	"timeSpentSec" integer DEFAULT 0 NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score" integer,
	"passed" boolean,
	"closureExecuted" boolean DEFAULT false NOT NULL,
	"closureEffects" jsonb,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Question" (
	"id" text PRIMARY KEY NOT NULL,
	"lessonId" text NOT NULL,
	"orderIdx" integer DEFAULT 0 NOT NULL,
	"type" text DEFAULT 'single' NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rubric" jsonb,
	"correctAnswerExplanation" text DEFAULT '' NOT NULL,
	"decisionContext" jsonb,
	"rightAnswerType" text,
	"weight" integer DEFAULT 1 NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
DROP INDEX "LlmUsageLog_tenantId_idx";--> statement-breakpoint
DROP INDEX "LlmUsageLog_requestId_idx";--> statement-breakpoint
DROP INDEX "UsageEvent_tenantId_idx";--> statement-breakpoint
CREATE INDEX "Certification_userId_status_idx" ON "Certification" USING btree ("userId","status","expiresAt");--> statement-breakpoint
CREATE INDEX "Certification_courseId_earnedAt_idx" ON "Certification" USING btree ("courseId","earnedAt");--> statement-breakpoint
CREATE INDEX "Certification_certNo_idx" ON "Certification" USING btree ("certNo");--> statement-breakpoint
CREATE INDEX "Course_slug_tenant_uniq" ON "Course" USING btree ("slug","tenantId");--> statement-breakpoint
CREATE INDEX "Course_status_category_idx" ON "Course" USING btree ("status","category");--> statement-breakpoint
CREATE INDEX "Course_requirement_idx" ON "Course" USING btree ("requirement","status");--> statement-breakpoint
CREATE INDEX "Course_tenant_idx" ON "Course" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "CourseAssignment_targetUserId_idx" ON "CourseAssignment" USING btree ("targetUserId","status");--> statement-breakpoint
CREATE INDEX "CourseAssignment_targetDepartmentId_idx" ON "CourseAssignment" USING btree ("targetDepartmentId","status");--> statement-breakpoint
CREATE INDEX "CourseAssignment_courseId_idx" ON "CourseAssignment" USING btree ("courseId");--> statement-breakpoint
CREATE INDEX "Enrollment_userId_status_idx" ON "Enrollment" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "Enrollment_courseId_status_idx" ON "Enrollment" USING btree ("courseId","status");--> statement-breakpoint
CREATE INDEX "Enrollment_user_course_tenant_uniq" ON "Enrollment" USING btree ("userId","courseId","tenantId");--> statement-breakpoint
CREATE INDEX "LearningMcpToken_userId_revokedAt_idx" ON "LearningMcpToken" USING btree ("userId","revokedAt");--> statement-breakpoint
CREATE INDEX "LearningMcpToken_tokenHash_idx" ON "LearningMcpToken" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "Lesson_courseId_orderIdx" ON "Lesson" USING btree ("courseId","orderIdx");--> statement-breakpoint
CREATE INDEX "Lesson_tenant_idx" ON "Lesson" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "LessonAttempt_userId_lessonId_idx" ON "LessonAttempt" USING btree ("userId","lessonId");--> statement-breakpoint
CREATE INDEX "LessonAttempt_enrollmentId_idx" ON "LessonAttempt" USING btree ("enrollmentId");--> statement-breakpoint
CREATE INDEX "Question_lessonId_orderIdx" ON "Question" USING btree ("lessonId","orderIdx");--> statement-breakpoint
CREATE INDEX "LlmUsageLog_tenant_created_idx" ON "LlmUsageLog" USING btree ("tenantId","createdAt");--> statement-breakpoint
CREATE INDEX "UsageEvent_tenant_user_idx" ON "UsageEvent" USING btree ("tenantId","userId");
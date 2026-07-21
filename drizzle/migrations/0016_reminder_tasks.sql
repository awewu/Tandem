CREATE TABLE IF NOT EXISTS "ReminderTask" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"userId" text NOT NULL,
	"sourceType" text NOT NULL,
	"sourceId" text NOT NULL,
	"dedupeKey" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"url" text,
	"remindAt" timestamp (3) NOT NULL,
	"channels" text[] DEFAULT '{"in_app"}' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"retryCount" integer DEFAULT 0 NOT NULL,
	"lastError" text,
	"processingAt" timestamp (3),
	"sentAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ReminderTask_tenant_dedupe_uniq" ON "ReminderTask" USING btree ("tenantId", "dedupeKey");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ReminderTask_user_due_idx" ON "ReminderTask" USING btree ("tenantId", "userId", "status", "remindAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ReminderTask_source_idx" ON "ReminderTask" USING btree ("tenantId", "sourceType", "sourceId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ReminderTask_due_idx" ON "ReminderTask" USING btree ("status", "remindAt");

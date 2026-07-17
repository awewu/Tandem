CREATE TABLE "CalendarReminder" (
	"id" text PRIMARY KEY NOT NULL,
	"eventId" text NOT NULL,
	"userId" text NOT NULL,
	"remindAt" timestamp (3) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"firedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "CalendarSubscription" (
	"id" text PRIMARY KEY NOT NULL,
	"subscriberId" text NOT NULL,
	"targetUserId" text NOT NULL,
	"status" text DEFAULT 'subscribed' NOT NULL,
	"detailPermission" text DEFAULT 'not_requested' NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "CalendarEvent" ADD COLUMN "attendeeEmails" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "CalendarEvent" ADD COLUMN "externalAttendeeEmails" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "CalendarEvent" ADD COLUMN "reminderMinutes" integer;
--> statement-breakpoint
ALTER TABLE "CalendarEvent" ADD COLUMN "seriesId" text;
--> statement-breakpoint
ALTER TABLE "CalendarEvent" ADD COLUMN "recurrenceIndex" integer;
--> statement-breakpoint
CREATE INDEX "CalendarReminder_eventId_idx" ON "CalendarReminder" USING btree ("eventId");
--> statement-breakpoint
CREATE INDEX "CalendarReminder_user_due_idx" ON "CalendarReminder" USING btree ("tenantId", "userId", "status", "remindAt");
--> statement-breakpoint
CREATE UNIQUE INDEX "CalendarSubscription_relation_uniq" ON "CalendarSubscription" USING btree ("tenantId", "subscriberId", "targetUserId");
--> statement-breakpoint
CREATE INDEX "CalendarSubscription_target_idx" ON "CalendarSubscription" USING btree ("tenantId", "targetUserId");
--> statement-breakpoint
CREATE INDEX "CalendarEvent_seriesId_idx" ON "CalendarEvent" USING btree ("seriesId");
--> statement-breakpoint
CREATE INDEX "CalendarEvent_tenant_start_idx" ON "CalendarEvent" USING btree ("tenantId", "startAt");


CREATE TABLE "CalendarEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"startAt" timestamp (3) NOT NULL,
	"endAt" timestamp (3) NOT NULL,
	"timezone" text DEFAULT 'Asia/Shanghai' NOT NULL,
	"allDay" boolean DEFAULT false NOT NULL,
	"recurringRule" jsonb,
	"ownerId" text NOT NULL,
	"attendees" text[] DEFAULT '{}' NOT NULL,
	"location" text,
	"meetingUrl" text,
	"calendarSource" text DEFAULT 'manual' NOT NULL,
	"externalId" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Document" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'doc' NOT NULL,
	"ownerId" text NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"isLocked" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"deletedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "DriveFile" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"mimeType" text DEFAULT 'application/octet-stream' NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"parentId" text,
	"ownerId" text NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"storageKey" text NOT NULL,
	"storageUrl" text,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"isFolder" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"deletedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "Notification" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb,
	"readAt" timestamp (3),
	"dismissedAt" timestamp (3),
	"priority" text DEFAULT 'normal' NOT NULL,
	"channel" text DEFAULT 'in-app' NOT NULL,
	"sourceId" text,
	"sourceType" text,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"emailVerifiedAt" timestamp (3),
	"name" text NOT NULL,
	"avatarUrl" text,
	"roles" text[] DEFAULT '{}' NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"deletedAt" timestamp (3),
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "CalendarEvent_ownerId_idx" ON "CalendarEvent" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "CalendarEvent_startAt_idx" ON "CalendarEvent" USING btree ("startAt");--> statement-breakpoint
CREATE INDEX "Document_ownerId_idx" ON "Document" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "Document_tenantId_idx" ON "Document" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "Document_updatedAt_idx" ON "Document" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "DriveFile_ownerId_idx" ON "DriveFile" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "DriveFile_parentId_idx" ON "DriveFile" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "Notification_userId_idx" ON "Notification" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Notification_createdAt_idx" ON "Notification" USING btree ("createdAt");
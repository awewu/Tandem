CREATE TABLE "AuditLog" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"actorId" text NOT NULL,
	"targetId" text,
	"targetType" text,
	"metadata" jsonb,
	"timestamp" timestamp (3) NOT NULL,
	"hash" text NOT NULL,
	"prevHash" text,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"seq" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "LaunchpadApp" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"iconUrl" text,
	"url" text NOT NULL,
	"ssoMode" text DEFAULT 'none' NOT NULL,
	"ssoConfig" jsonb,
	"visibleTo" text[] DEFAULT '{}' NOT NULL,
	"visibleToRoles" text[] DEFAULT '{}' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"recommendKeywords" text[] DEFAULT '{}' NOT NULL,
	"unreadAdapter" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "LaunchpadClick" (
	"id" text PRIMARY KEY NOT NULL,
	"appId" text NOT NULL,
	"userId" text NOT NULL,
	"clickedAt" timestamp (3) DEFAULT now() NOT NULL,
	"source" text DEFAULT 'home' NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "AuditLog_action_idx" ON "AuditLog" USING btree ("action");--> statement-breakpoint
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog" USING btree ("actorId");--> statement-breakpoint
CREATE INDEX "AuditLog_targetId_idx" ON "AuditLog" USING btree ("targetId");--> statement-breakpoint
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "AuditLog_tenant_seq_idx" ON "AuditLog" USING btree ("tenantId","seq");--> statement-breakpoint
CREATE INDEX "LaunchpadApp_category_idx" ON "LaunchpadApp" USING btree ("category");--> statement-breakpoint
CREATE INDEX "LaunchpadApp_tenantId_idx" ON "LaunchpadApp" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "LaunchpadApp_status_idx" ON "LaunchpadApp" USING btree ("status");--> statement-breakpoint
CREATE INDEX "LaunchpadClick_appId_idx" ON "LaunchpadClick" USING btree ("appId");--> statement-breakpoint
CREATE INDEX "LaunchpadClick_userId_idx" ON "LaunchpadClick" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "LaunchpadClick_clickedAt_idx" ON "LaunchpadClick" USING btree ("clickedAt");
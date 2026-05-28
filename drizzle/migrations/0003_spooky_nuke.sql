CREATE TABLE "LlmUsageLog" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"scenario" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"tokensIn" integer DEFAULT 0 NOT NULL,
	"tokensOut" integer DEFAULT 0 NOT NULL,
	"latencyMs" integer DEFAULT 0 NOT NULL,
	"costMicroUsd" integer DEFAULT 0 NOT NULL,
	"requestId" text,
	"success" boolean DEFAULT true NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UsageEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"eventName" text NOT NULL,
	"props" jsonb,
	"sessionId" text,
	"userAgent" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "LlmUsageLog_scenario_idx" ON "LlmUsageLog" USING btree ("scenario");--> statement-breakpoint
CREATE INDEX "LlmUsageLog_provider_idx" ON "LlmUsageLog" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "LlmUsageLog_userId_idx" ON "LlmUsageLog" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "LlmUsageLog_tenantId_idx" ON "LlmUsageLog" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "LlmUsageLog_createdAt_idx" ON "LlmUsageLog" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "LlmUsageLog_requestId_idx" ON "LlmUsageLog" USING btree ("requestId");--> statement-breakpoint
CREATE INDEX "UsageEvent_eventName_idx" ON "UsageEvent" USING btree ("eventName");--> statement-breakpoint
CREATE INDEX "UsageEvent_userId_idx" ON "UsageEvent" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "UsageEvent_tenantId_idx" ON "UsageEvent" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent" USING btree ("createdAt");
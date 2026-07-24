CREATE TABLE "AgentTemplate" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"specialty" text NOT NULL,
	"origin" text DEFAULT 'internal' NOT NULL,
	"externalRef" text,
	"basePrompt" text NOT NULL,
	"defaultSkills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"defaultKnowledgeTags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"createdBy" text NOT NULL,
	"reviewedBy" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ApiLog" (
	"id" text PRIMARY KEY NOT NULL,
	"requestId" text,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"actorId" text DEFAULT 'anonymous' NOT NULL,
	"actorType" text DEFAULT 'anonymous' NOT NULL,
	"source" text DEFAULT 'api' NOT NULL,
	"category" text DEFAULT 'system' NOT NULL,
	"operation" text NOT NULL,
	"action" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"route" text,
	"targetType" text,
	"targetId" text,
	"statusCode" integer NOT NULL,
	"outcome" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"durationMs" integer,
	"summary" text NOT NULL,
	"requestData" jsonb,
	"details" jsonb,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BusinessLog" (
	"id" text PRIMARY KEY NOT NULL,
	"requestId" text,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"actorId" text DEFAULT 'anonymous' NOT NULL,
	"actorType" text DEFAULT 'anonymous' NOT NULL,
	"kind" text NOT NULL,
	"source" text DEFAULT 'domain' NOT NULL,
	"category" text DEFAULT 'system' NOT NULL,
	"operation" text NOT NULL,
	"action" text NOT NULL,
	"method" text,
	"path" text,
	"route" text,
	"targetType" text,
	"targetId" text,
	"statusCode" integer,
	"outcome" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"durationMs" integer,
	"summary" text NOT NULL,
	"requestData" jsonb,
	"details" jsonb,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "Kpi" (
	"id" text PRIMARY KEY NOT NULL,
	"cycleId" text NOT NULL,
	"subjectId" text NOT NULL,
	"bscPerspective" text,
	"level" text NOT NULL,
	"parentKpiId" text,
	"assigneeId" text NOT NULL,
	"departmentId" text,
	"title" text NOT NULL,
	"description" text,
	"measureType" text DEFAULT 'numeric' NOT NULL,
	"startValue" numeric(18, 4) DEFAULT '0' NOT NULL,
	"targetValue" numeric(18, 4) DEFAULT '0' NOT NULL,
	"currentValue" numeric(18, 4) DEFAULT '0' NOT NULL,
	"unit" text,
	"weight" numeric(6, 2) DEFAULT '0' NOT NULL,
	"dataSource" text DEFAULT 'pending' NOT NULL,
	"scope" text DEFAULT 'bonus' NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KpiBonusPayout" (
	"id" text PRIMARY KEY NOT NULL,
	"cycleId" text NOT NULL,
	"assigneeId" text NOT NULL,
	"baseBonus" numeric(18, 2) NOT NULL,
	"weightedCompletion" numeric(6, 4) NOT NULL,
	"finalBonus" numeric(18, 2) NOT NULL,
	"contributions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calculatedAt" timestamp (3) NOT NULL,
	"calculatedBy" text NOT NULL,
	"committed" boolean DEFAULT false NOT NULL,
	"committedAt" timestamp (3),
	"note" text,
	"tenantId" text DEFAULT 'default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KpiCausalLink" (
	"id" text PRIMARY KEY NOT NULL,
	"cycleId" text NOT NULL,
	"fromKpiId" text NOT NULL,
	"toKpiId" text NOT NULL,
	"strength" numeric(4, 3) DEFAULT '0.5' NOT NULL,
	"hypothesis" text,
	"validated" boolean DEFAULT false NOT NULL,
	"validatedAt" timestamp (3),
	"validatedBy" text,
	"validationNote" text,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KpiCheckIn" (
	"id" text PRIMARY KEY NOT NULL,
	"kpiId" text NOT NULL,
	"asOf" text NOT NULL,
	"cumulativeValue" numeric(18, 4) NOT NULL,
	"delta" numeric(18, 4) DEFAULT '0' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"note" text,
	"createdBy" text NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KpiCycle" (
	"id" text PRIMARY KEY NOT NULL,
	"fiscalYear" integer NOT NULL,
	"name" text NOT NULL,
	"startDate" text NOT NULL,
	"endDate" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"targetsLockedAt" timestamp (3),
	"closedAt" timestamp (3),
	"createdBy" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KpiManualEntry" (
	"id" text PRIMARY KEY NOT NULL,
	"kpiId" text NOT NULL,
	"operatorId" text NOT NULL,
	"operatorRole" text NOT NULL,
	"fromValue" numeric(18, 4) NOT NULL,
	"toValue" numeric(18, 4) NOT NULL,
	"reason" text NOT NULL,
	"evidenceUrl" text,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KpiSnapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"kpiId" text NOT NULL,
	"date" text NOT NULL,
	"cumulativeValue" numeric(18, 4) NOT NULL,
	"source" text DEFAULT 'erp' NOT NULL,
	"breakdown" jsonb,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "KpiSubject" (
	"id" text PRIMARY KEY NOT NULL,
	"parentId" text,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"bscPerspective" text,
	"level" integer DEFAULT 1 NOT NULL,
	"defaultScope" text DEFAULT 'bonus' NOT NULL,
	"defaultUnit" text,
	"defaultMeasureType" text DEFAULT 'numeric' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"entityType" text NOT NULL,
	"entityId" text NOT NULL,
	"message" text NOT NULL,
	"targetRole" text,
	"targetUserId" text,
	"acted" boolean DEFAULT false NOT NULL,
	"actedBy" text,
	"actedAt" timestamp (3),
	"escalationLevel" integer DEFAULT 0,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"entityType" text NOT NULL,
	"entityId" text NOT NULL,
	"level" integer NOT NULL,
	"approverId" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decision" text,
	"comment" text,
	"decidedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"opportunityId" text NOT NULL,
	"contractNumber" text NOT NULL,
	"customerName" text NOT NULL,
	"totalAmount" numeric NOT NULL,
	"signedDate" text,
	"effectiveDate" text,
	"expiryDate" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"signedBy" text,
	"approvedBy" text,
	"approvedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_customer_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"externalCode" text,
	"type" text,
	"parentAccountId" text,
	"level" integer DEFAULT 0,
	"region" text,
	"channel" text,
	"dealerOrgId" text,
	"attributes" jsonb DEFAULT '{}'::jsonb,
	"source" text DEFAULT 'manual',
	"sourceRefId" text,
	"status" text DEFAULT 'active' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_customer_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"snCode" text,
	"maintenanceRecordId" text,
	"type" text NOT NULL,
	"rating" integer,
	"comment" text,
	"contactInfo" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_dealer_health_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"dealerOrgId" text NOT NULL,
	"period" text NOT NULL,
	"totalScore" numeric NOT NULL,
	"dimensions" jsonb NOT NULL,
	"rank" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_dealer_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"dealerOrgId" text NOT NULL,
	"orderNumber" text NOT NULL,
	"items" jsonb NOT NULL,
	"totalAmount" numeric NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirmedBy" text,
	"confirmedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_dealer_org_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"orgId" text NOT NULL,
	"contactName" text,
	"contactPhone" text,
	"contactEmail" text,
	"businessLicense" text,
	"registeredCapital" numeric,
	"establishedDate" text,
	"coverageRegions" jsonb DEFAULT '[]'::jsonb,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_dealer_qualifications" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"dealerOrgId" text NOT NULL,
	"type" text NOT NULL,
	"certificateNumber" text,
	"issuedBy" text,
	"issuedDate" text,
	"expiryDate" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approvedBy" text,
	"approvedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_delivery_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"orgId" text NOT NULL,
	"contractId" text NOT NULL,
	"orderNumber" text NOT NULL,
	"customerName" text NOT NULL,
	"deliveryAddress" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduledDeliveryDate" text,
	"actualDeliveryDate" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"archivedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "pms_delivery_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"deliveryOrderId" text NOT NULL,
	"type" text NOT NULL,
	"assignedTo" text NOT NULL,
	"assigneeType" text NOT NULL,
	"description" text NOT NULL,
	"dueDate" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"completedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_demand_gen_leads" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"source" text NOT NULL,
	"customerName" text NOT NULL,
	"contactPhone" text,
	"region" text,
	"status" text DEFAULT 'new' NOT NULL,
	"assignedTo" text,
	"convertedOpportunityId" text,
	"convertedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_duplicate_appeals" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"duplicateCheckId" text NOT NULL,
	"appealerId" text NOT NULL,
	"reason" text NOT NULL,
	"evidence" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"arbitratedBy" text,
	"arbitrationResult" text,
	"arbitrationReason" text,
	"arbitratedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_duplicate_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"opportunityId" text NOT NULL,
	"duplicateOpportunityId" text,
	"similarityScore" numeric NOT NULL,
	"dimensions" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolvedBy" text,
	"resolvedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_equipment_sns" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"snCode" text NOT NULL,
	"productId" text NOT NULL,
	"productModel" text NOT NULL,
	"batchNumber" text,
	"manufacturedAt" text,
	"parentSNId" text,
	"deliveryOrderId" text,
	"status" text DEFAULT 'in_stock' NOT NULL,
	"installedAt" text,
	"warrantyExpiresAt" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_equipment_telemetry" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"snCode" text NOT NULL,
	"timestamp" timestamp (3) NOT NULL,
	"metrics" jsonb NOT NULL,
	"alerts" jsonb DEFAULT '[]'::jsonb,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_follow_ups" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"opportunityId" text NOT NULL,
	"userId" text NOT NULL,
	"stage" text NOT NULL,
	"content" text NOT NULL,
	"nextFollowUpAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_key_product_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"productId" text NOT NULL,
	"name" text NOT NULL,
	"targetSales" numeric NOT NULL,
	"actualSales" numeric DEFAULT '0',
	"startDate" text NOT NULL,
	"endDate" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_maintenance_records" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"equipmentSNId" text NOT NULL,
	"type" text NOT NULL,
	"reportedBy" text NOT NULL,
	"assignedTo" text,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduledAt" timestamp (3),
	"completedAt" timestamp (3),
	"customerFeedback" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_notification_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"alertType" text NOT NULL,
	"severity" text NOT NULL,
	"targetRole" text NOT NULL,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"escalationSLA" integer,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"orgId" text NOT NULL,
	"dealerOrgId" text NOT NULL,
	"reporterId" text NOT NULL,
	"customerName" text NOT NULL,
	"customerPhone" text,
	"customerAddress" text,
	"projectName" text NOT NULL,
	"stage" text DEFAULT 'initial_contact' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"estimatedAmount" numeric,
	"estimatedClosingDate" text,
	"productLine" text,
	"region" text,
	"channel" text,
	"dedupeKey" text NOT NULL,
	"duplicateStatus" text,
	"lastFollowUpAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"archivedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "pms_performance_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"orgId" text,
	"dealerOrgId" text,
	"period" text NOT NULL,
	"targetType" text NOT NULL,
	"targetValue" numeric NOT NULL,
	"actualValue" numeric DEFAULT '0',
	"achievementRate" numeric DEFAULT '0',
	"createdBy" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_price_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"opportunityId" text NOT NULL,
	"applicantId" text NOT NULL,
	"productId" text NOT NULL,
	"listPrice" numeric NOT NULL,
	"requestedPrice" numeric NOT NULL,
	"discountRate" numeric NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approvedPrice" numeric,
	"approvedBy" text,
	"approvedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_product_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"series" text NOT NULL,
	"seriesCode" text,
	"model" text NOT NULL,
	"modelCode" text,
	"category" text,
	"specification" text,
	"unit" text,
	"listPrice" numeric,
	"costPrice" numeric,
	"minPrice" numeric,
	"bomItems" jsonb DEFAULT '[]'::jsonb,
	"parentModel" text,
	"attributes" jsonb DEFAULT '{}'::jsonb,
	"source" text DEFAULT 'manual',
	"sourceRefId" text,
	"status" text DEFAULT 'active' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_public_pool" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"opportunityId" text NOT NULL,
	"releasedBy" text NOT NULL,
	"releasedReason" text NOT NULL,
	"releasedAt" timestamp (3) DEFAULT now() NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"claimedBy" text,
	"claimedAt" timestamp (3),
	"protectionExpiresAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "pms_quote_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"opportunityId" text,
	"customerRequirements" jsonb NOT NULL,
	"recommendations" jsonb NOT NULL,
	"aiModel" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_rebate_accruals" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"dealerOrgId" text NOT NULL,
	"policyId" text NOT NULL,
	"period" text NOT NULL,
	"salesAmount" numeric NOT NULL,
	"rebateAmount" numeric NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"settledBy" text,
	"settledAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pms_rebate_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"productLine" text,
	"tiers" jsonb NOT NULL,
	"effectiveDate" text NOT NULL,
	"expiryDate" text,
	"status" text DEFAULT 'active' NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ReminderTask" (
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
CREATE TABLE "RoleDefinition" (
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'internal' NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "RoleDefinition_tenantId_key_pk" PRIMARY KEY("tenantId","key")
);
--> statement-breakpoint
ALTER TABLE "CalendarEvent" ADD COLUMN "attendeeEmails" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "CalendarEvent" ADD COLUMN "externalAttendeeEmails" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "CalendarEvent" ADD COLUMN "reminderMinutes" integer;--> statement-breakpoint
ALTER TABLE "CalendarEvent" ADD COLUMN "seriesId" text;--> statement-breakpoint
ALTER TABLE "CalendarEvent" ADD COLUMN "recurrenceIndex" integer;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "spawnedPromotionId" text;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "spawnedDecisionCardId" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "departmentId" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "managerId" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "jobTitle" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "employeeId" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "hireDate" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "workLocation" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "phone" text;--> statement-breakpoint
CREATE INDEX "AgentTemplate_tenantId_status_idx" ON "AgentTemplate" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "AgentTemplate_tenantId_specialty_idx" ON "AgentTemplate" USING btree ("tenantId","specialty");--> statement-breakpoint
CREATE INDEX "AgentTemplate_origin_idx" ON "AgentTemplate" USING btree ("origin","status");--> statement-breakpoint
CREATE UNIQUE INDEX "AgentTemplate_tenantId_name_uniq" ON "AgentTemplate" USING btree ("tenantId","name");--> statement-breakpoint
CREATE INDEX "ApiLog_tenant_created_idx" ON "ApiLog" USING btree ("tenantId","createdAt");--> statement-breakpoint
CREATE INDEX "ApiLog_tenant_actor_idx" ON "ApiLog" USING btree ("tenantId","actorId","createdAt");--> statement-breakpoint
CREATE INDEX "ApiLog_tenant_route_idx" ON "ApiLog" USING btree ("tenantId","route","createdAt");--> statement-breakpoint
CREATE INDEX "ApiLog_tenant_outcome_idx" ON "ApiLog" USING btree ("tenantId","outcome","createdAt");--> statement-breakpoint
CREATE INDEX "ApiLog_requestId_idx" ON "ApiLog" USING btree ("requestId");--> statement-breakpoint
CREATE INDEX "BusinessLog_tenant_created_idx" ON "BusinessLog" USING btree ("tenantId","createdAt");--> statement-breakpoint
CREATE INDEX "BusinessLog_tenant_actor_idx" ON "BusinessLog" USING btree ("tenantId","actorId","createdAt");--> statement-breakpoint
CREATE INDEX "BusinessLog_tenant_operation_idx" ON "BusinessLog" USING btree ("tenantId","operation","createdAt");--> statement-breakpoint
CREATE INDEX "BusinessLog_tenant_outcome_idx" ON "BusinessLog" USING btree ("tenantId","outcome","createdAt");--> statement-breakpoint
CREATE INDEX "BusinessLog_requestId_idx" ON "BusinessLog" USING btree ("requestId");--> statement-breakpoint
CREATE INDEX "CalendarReminder_eventId_idx" ON "CalendarReminder" USING btree ("eventId");--> statement-breakpoint
CREATE INDEX "CalendarReminder_user_due_idx" ON "CalendarReminder" USING btree ("tenantId","userId","status","remindAt");--> statement-breakpoint
CREATE UNIQUE INDEX "CalendarSubscription_relation_uniq" ON "CalendarSubscription" USING btree ("tenantId","subscriberId","targetUserId");--> statement-breakpoint
CREATE INDEX "CalendarSubscription_target_idx" ON "CalendarSubscription" USING btree ("tenantId","targetUserId");--> statement-breakpoint
CREATE INDEX "Kpi_cycleId_level_scope_idx" ON "Kpi" USING btree ("cycleId","level","scope");--> statement-breakpoint
CREATE INDEX "Kpi_assigneeId_cycleId_idx" ON "Kpi" USING btree ("assigneeId","cycleId");--> statement-breakpoint
CREATE INDEX "Kpi_parentKpiId_idx" ON "Kpi" USING btree ("parentKpiId");--> statement-breakpoint
CREATE INDEX "Kpi_departmentId_cycleId_idx" ON "Kpi" USING btree ("departmentId","cycleId");--> statement-breakpoint
CREATE INDEX "Kpi_bscPerspective_cycleId_idx" ON "Kpi" USING btree ("bscPerspective","cycleId");--> statement-breakpoint
CREATE INDEX "Kpi_tenantId_idx" ON "Kpi" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "KpiBonusPayout_cycleId_assigneeId_idx" ON "KpiBonusPayout" USING btree ("cycleId","assigneeId");--> statement-breakpoint
CREATE INDEX "KpiBonusPayout_committed_cycleId_idx" ON "KpiBonusPayout" USING btree ("committed","cycleId");--> statement-breakpoint
CREATE INDEX "KpiBonusPayout_tenantId_idx" ON "KpiBonusPayout" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "KpiCausalLink_fromKpiId_cycleId_idx" ON "KpiCausalLink" USING btree ("fromKpiId","cycleId");--> statement-breakpoint
CREATE INDEX "KpiCausalLink_toKpiId_cycleId_idx" ON "KpiCausalLink" USING btree ("toKpiId","cycleId");--> statement-breakpoint
CREATE UNIQUE INDEX "KpiCausalLink_from_to_cycle_uniq" ON "KpiCausalLink" USING btree ("fromKpiId","toKpiId","cycleId");--> statement-breakpoint
CREATE INDEX "KpiCausalLink_tenantId_idx" ON "KpiCausalLink" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "KpiCheckIn_kpiId_asOf_idx" ON "KpiCheckIn" USING btree ("kpiId","asOf");--> statement-breakpoint
CREATE INDEX "KpiCheckIn_tenantId_idx" ON "KpiCheckIn" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "KpiCycle_tenantId_status_idx" ON "KpiCycle" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "KpiCycle_fiscalYear_idx" ON "KpiCycle" USING btree ("fiscalYear","tenantId");--> statement-breakpoint
CREATE INDEX "KpiManualEntry_kpiId_operatorId_idx" ON "KpiManualEntry" USING btree ("kpiId","operatorId");--> statement-breakpoint
CREATE INDEX "KpiManualEntry_kpiId_createdAt_idx" ON "KpiManualEntry" USING btree ("kpiId","createdAt");--> statement-breakpoint
CREATE INDEX "KpiManualEntry_tenantId_idx" ON "KpiManualEntry" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "KpiSnapshot_kpiId_date_idx" ON "KpiSnapshot" USING btree ("kpiId","date");--> statement-breakpoint
CREATE UNIQUE INDEX "KpiSnapshot_kpiId_date_uniq" ON "KpiSnapshot" USING btree ("kpiId","date");--> statement-breakpoint
CREATE INDEX "KpiSnapshot_tenantId_date_idx" ON "KpiSnapshot" USING btree ("tenantId","date");--> statement-breakpoint
CREATE UNIQUE INDEX "KpiSubject_code_tenant_uniq" ON "KpiSubject" USING btree ("code","tenantId");--> statement-breakpoint
CREATE INDEX "KpiSubject_parentId_idx" ON "KpiSubject" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "KpiSubject_bscPerspective_idx" ON "KpiSubject" USING btree ("bscPerspective","tenantId");--> statement-breakpoint
CREATE INDEX "KpiSubject_active_tenant_idx" ON "KpiSubject" USING btree ("active","tenantId");--> statement-breakpoint
CREATE INDEX "pms_alert_entity_idx" ON "pms_alerts" USING btree ("entityType","entityId");--> statement-breakpoint
CREATE INDEX "pms_alert_severity_idx" ON "pms_alerts" USING btree ("severity","acted");--> statement-breakpoint
CREATE INDEX "pms_alert_target_idx" ON "pms_alerts" USING btree ("targetUserId","acted");--> statement-breakpoint
CREATE INDEX "pms_alert_tenant_idx" ON "pms_alerts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_approval_entity_idx" ON "pms_approvals" USING btree ("entityType","entityId");--> statement-breakpoint
CREATE INDEX "pms_approval_approver_idx" ON "pms_approvals" USING btree ("approverId","status");--> statement-breakpoint
CREATE INDEX "pms_approval_tenant_idx" ON "pms_approvals" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_contract_opp_idx" ON "pms_contracts" USING btree ("opportunityId");--> statement-breakpoint
CREATE UNIQUE INDEX "pms_contract_number_idx" ON "pms_contracts" USING btree ("contractNumber");--> statement-breakpoint
CREATE INDEX "pms_contract_status_idx" ON "pms_contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pms_contract_tenant_idx" ON "pms_contracts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_customer_name_idx" ON "pms_customer_accounts" USING btree ("name");--> statement-breakpoint
CREATE INDEX "pms_customer_parent_idx" ON "pms_customer_accounts" USING btree ("parentAccountId");--> statement-breakpoint
CREATE INDEX "pms_customer_dealer_idx" ON "pms_customer_accounts" USING btree ("dealerOrgId");--> statement-breakpoint
CREATE INDEX "pms_customer_tenant_idx" ON "pms_customer_accounts" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_feedback_sn_idx" ON "pms_customer_feedback" USING btree ("snCode");--> statement-breakpoint
CREATE INDEX "pms_feedback_maint_idx" ON "pms_customer_feedback" USING btree ("maintenanceRecordId");--> statement-breakpoint
CREATE INDEX "pms_feedback_tenant_idx" ON "pms_customer_feedback" USING btree ("tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX "pms_health_dealer_period_idx" ON "pms_dealer_health_scores" USING btree ("dealerOrgId","period");--> statement-breakpoint
CREATE INDEX "pms_health_tenant_idx" ON "pms_dealer_health_scores" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_order_dealer_idx" ON "pms_dealer_orders" USING btree ("dealerOrgId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "pms_order_number_idx" ON "pms_dealer_orders" USING btree ("orderNumber");--> statement-breakpoint
CREATE INDEX "pms_order_tenant_idx" ON "pms_dealer_orders" USING btree ("tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX "pms_dealer_org_idx" ON "pms_dealer_org_profiles" USING btree ("orgId");--> statement-breakpoint
CREATE INDEX "pms_dealer_tenant_idx" ON "pms_dealer_org_profiles" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_qual_dealer_idx" ON "pms_dealer_qualifications" USING btree ("dealerOrgId");--> statement-breakpoint
CREATE INDEX "pms_qual_type_idx" ON "pms_dealer_qualifications" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "pms_qual_expiry_idx" ON "pms_dealer_qualifications" USING btree ("expiryDate","status");--> statement-breakpoint
CREATE INDEX "pms_qual_tenant_idx" ON "pms_dealer_qualifications" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_delivery_org_status_idx" ON "pms_delivery_orders" USING btree ("orgId","status","createdAt");--> statement-breakpoint
CREATE INDEX "pms_delivery_contract_idx" ON "pms_delivery_orders" USING btree ("contractId");--> statement-breakpoint
CREATE UNIQUE INDEX "pms_delivery_number_idx" ON "pms_delivery_orders" USING btree ("orderNumber");--> statement-breakpoint
CREATE INDEX "pms_delivery_tenant_idx" ON "pms_delivery_orders" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_task_order_idx" ON "pms_delivery_tasks" USING btree ("deliveryOrderId");--> statement-breakpoint
CREATE INDEX "pms_task_assignee_idx" ON "pms_delivery_tasks" USING btree ("assignedTo","status");--> statement-breakpoint
CREATE INDEX "pms_task_tenant_idx" ON "pms_delivery_tasks" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_lead_source_status_idx" ON "pms_demand_gen_leads" USING btree ("source","status");--> statement-breakpoint
CREATE INDEX "pms_lead_assigned_idx" ON "pms_demand_gen_leads" USING btree ("assignedTo");--> statement-breakpoint
CREATE INDEX "pms_lead_tenant_idx" ON "pms_demand_gen_leads" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_appeal_check_idx" ON "pms_duplicate_appeals" USING btree ("duplicateCheckId");--> statement-breakpoint
CREATE INDEX "pms_appeal_status_idx" ON "pms_duplicate_appeals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pms_appeal_tenant_idx" ON "pms_duplicate_appeals" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_dupcheck_opp_idx" ON "pms_duplicate_checks" USING btree ("opportunityId");--> statement-breakpoint
CREATE INDEX "pms_dupcheck_status_idx" ON "pms_duplicate_checks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pms_dupcheck_tenant_idx" ON "pms_duplicate_checks" USING btree ("tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX "pms_sn_code_idx" ON "pms_equipment_sns" USING btree ("snCode");--> statement-breakpoint
CREATE INDEX "pms_sn_batch_status_idx" ON "pms_equipment_sns" USING btree ("batchNumber","status");--> statement-breakpoint
CREATE INDEX "pms_sn_delivery_idx" ON "pms_equipment_sns" USING btree ("deliveryOrderId");--> statement-breakpoint
CREATE INDEX "pms_sn_tenant_idx" ON "pms_equipment_sns" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_telemetry_sn_time_idx" ON "pms_equipment_telemetry" USING btree ("snCode","timestamp");--> statement-breakpoint
CREATE INDEX "pms_telemetry_tenant_idx" ON "pms_equipment_telemetry" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_followup_opp_time_idx" ON "pms_follow_ups" USING btree ("opportunityId","createdAt");--> statement-breakpoint
CREATE INDEX "pms_followup_tenant_idx" ON "pms_follow_ups" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_campaign_product_idx" ON "pms_key_product_campaigns" USING btree ("productId","status");--> statement-breakpoint
CREATE INDEX "pms_campaign_date_idx" ON "pms_key_product_campaigns" USING btree ("startDate","endDate");--> statement-breakpoint
CREATE INDEX "pms_campaign_tenant_idx" ON "pms_key_product_campaigns" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_maint_sn_idx" ON "pms_maintenance_records" USING btree ("equipmentSNId");--> statement-breakpoint
CREATE INDEX "pms_maint_status_idx" ON "pms_maintenance_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pms_maint_expiry_idx" ON "pms_maintenance_records" USING btree ("scheduledAt","status");--> statement-breakpoint
CREATE INDEX "pms_maint_tenant_idx" ON "pms_maintenance_records" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_notifrule_type_idx" ON "pms_notification_rules" USING btree ("alertType","severity");--> statement-breakpoint
CREATE INDEX "pms_notifrule_tenant_idx" ON "pms_notification_rules" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_opp_orgid_status_stage_idx" ON "pms_opportunities" USING btree ("orgId","status","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "pms_opp_dedupkey_idx" ON "pms_opportunities" USING btree ("dedupeKey");--> statement-breakpoint
CREATE INDEX "pms_opp_dealer_stage_idx" ON "pms_opportunities" USING btree ("dealerOrgId","stage","createdAt");--> statement-breakpoint
CREATE INDEX "pms_opp_alert_scan_idx" ON "pms_opportunities" USING btree ("lastFollowUpAt","status");--> statement-breakpoint
CREATE INDEX "pms_opp_analytics_idx" ON "pms_opportunities" USING btree ("tenantId","orgId","stage","status","region","productLine","createdAt");--> statement-breakpoint
CREATE INDEX "pms_opp_tenant_idx" ON "pms_opportunities" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_target_org_period_idx" ON "pms_performance_targets" USING btree ("orgId","period");--> statement-breakpoint
CREATE INDEX "pms_target_dealer_period_idx" ON "pms_performance_targets" USING btree ("dealerOrgId","period");--> statement-breakpoint
CREATE INDEX "pms_target_tenant_idx" ON "pms_performance_targets" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_price_opp_idx" ON "pms_price_applications" USING btree ("opportunityId");--> statement-breakpoint
CREATE INDEX "pms_price_status_idx" ON "pms_price_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pms_price_tenant_idx" ON "pms_price_applications" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_product_series_cat_idx" ON "pms_product_catalog" USING btree ("series","category","status");--> statement-breakpoint
CREATE INDEX "pms_product_model_idx" ON "pms_product_catalog" USING btree ("model");--> statement-breakpoint
CREATE INDEX "pms_product_tenant_idx" ON "pms_product_catalog" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_pool_released_idx" ON "pms_public_pool" USING btree ("releasedAt","claimed");--> statement-breakpoint
CREATE INDEX "pms_pool_opp_idx" ON "pms_public_pool" USING btree ("opportunityId");--> statement-breakpoint
CREATE INDEX "pms_pool_tenant_idx" ON "pms_public_pool" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_quote_opp_idx" ON "pms_quote_recommendations" USING btree ("opportunityId");--> statement-breakpoint
CREATE INDEX "pms_quote_tenant_idx" ON "pms_quote_recommendations" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_rebate_acc_dealer_period_idx" ON "pms_rebate_accruals" USING btree ("dealerOrgId","period");--> statement-breakpoint
CREATE INDEX "pms_rebate_acc_status_idx" ON "pms_rebate_accruals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pms_rebate_acc_tenant_idx" ON "pms_rebate_accruals" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "pms_rebate_status_idx" ON "pms_rebate_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pms_rebate_tenant_idx" ON "pms_rebate_policies" USING btree ("tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX "ReminderTask_tenant_dedupe_uniq" ON "ReminderTask" USING btree ("tenantId","dedupeKey");--> statement-breakpoint
CREATE INDEX "ReminderTask_user_due_idx" ON "ReminderTask" USING btree ("tenantId","userId","status","remindAt");--> statement-breakpoint
CREATE INDEX "ReminderTask_source_idx" ON "ReminderTask" USING btree ("tenantId","sourceType","sourceId");--> statement-breakpoint
CREATE INDEX "ReminderTask_due_idx" ON "ReminderTask" USING btree ("status","remindAt");--> statement-breakpoint
CREATE INDEX "RoleDefinition_tenant_enabled_idx" ON "RoleDefinition" USING btree ("tenantId","enabled");--> statement-breakpoint
CREATE INDEX "CalendarEvent_seriesId_idx" ON "CalendarEvent" USING btree ("seriesId");--> statement-breakpoint
CREATE INDEX "CalendarEvent_tenant_start_idx" ON "CalendarEvent" USING btree ("tenantId","startAt");--> statement-breakpoint
CREATE INDEX "KvStore_collection_tenant_idx" ON "KvStore" USING btree ("collection","tenantId");
-- PMS Typed Tables Migration
-- 28 tables + 87 indexes for world-class百万级数据支持

-- Tables (28)
CREATE TABLE IF NOT EXISTS "pms_alerts" (
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

CREATE TABLE IF NOT EXISTS "pms_approvals" (
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

CREATE TABLE IF NOT EXISTS "pms_contracts" (
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

CREATE TABLE IF NOT EXISTS "pms_customer_accounts" (
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

CREATE TABLE IF NOT EXISTS "pms_customer_feedback" (
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

CREATE TABLE IF NOT EXISTS "pms_dealer_health_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"dealerOrgId" text NOT NULL,
	"period" text NOT NULL,
	"totalScore" numeric NOT NULL,
	"dimensions" jsonb NOT NULL,
	"rank" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pms_dealer_orders" (
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

CREATE TABLE IF NOT EXISTS "pms_dealer_org_profiles" (
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

CREATE TABLE IF NOT EXISTS "pms_dealer_qualifications" (
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

CREATE TABLE IF NOT EXISTS "pms_delivery_orders" (
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

CREATE TABLE IF NOT EXISTS "pms_delivery_tasks" (
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

CREATE TABLE IF NOT EXISTS "pms_demand_gen_leads" (
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

CREATE TABLE IF NOT EXISTS "pms_duplicate_appeals" (
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

CREATE TABLE IF NOT EXISTS "pms_duplicate_checks" (
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

CREATE TABLE IF NOT EXISTS "pms_equipment_sns" (
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

CREATE TABLE IF NOT EXISTS "pms_equipment_telemetry" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"snCode" text NOT NULL,
	"timestamp" timestamp (3) NOT NULL,
	"metrics" jsonb NOT NULL,
	"alerts" jsonb DEFAULT '[]'::jsonb,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pms_follow_ups" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"opportunityId" text NOT NULL,
	"userId" text NOT NULL,
	"stage" text NOT NULL,
	"content" text NOT NULL,
	"nextFollowUpAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pms_key_product_campaigns" (
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

CREATE TABLE IF NOT EXISTS "pms_maintenance_records" (
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

CREATE TABLE IF NOT EXISTS "pms_notification_rules" (
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

CREATE TABLE IF NOT EXISTS "pms_opportunities" (
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

CREATE TABLE IF NOT EXISTS "pms_performance_targets" (
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

CREATE TABLE IF NOT EXISTS "pms_price_applications" (
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

CREATE TABLE IF NOT EXISTS "pms_product_catalog" (
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

CREATE TABLE IF NOT EXISTS "pms_public_pool" (
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

CREATE TABLE IF NOT EXISTS "pms_quote_recommendations" (
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

CREATE TABLE IF NOT EXISTS "pms_rebate_accruals" (
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

CREATE TABLE IF NOT EXISTS "pms_rebate_policies" (
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

-- Indexes (87 total)
CREATE INDEX IF NOT EXISTS "pms_alert_entity_idx" ON "pms_alerts" USING btree ("entityType","entityId");
CREATE INDEX IF NOT EXISTS "pms_alert_severity_idx" ON "pms_alerts" USING btree ("severity","acted");
CREATE INDEX IF NOT EXISTS "pms_alert_target_idx" ON "pms_alerts" USING btree ("targetUserId","acted");
CREATE INDEX IF NOT EXISTS "pms_alert_tenant_idx" ON "pms_alerts" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_approval_entity_idx" ON "pms_approvals" USING btree ("entityType","entityId");
CREATE INDEX IF NOT EXISTS "pms_approval_approver_idx" ON "pms_approvals" USING btree ("approverId","status");
CREATE INDEX IF NOT EXISTS "pms_approval_tenant_idx" ON "pms_approvals" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_contract_opp_idx" ON "pms_contracts" USING btree ("opportunityId");
CREATE UNIQUE INDEX IF NOT EXISTS "pms_contract_number_idx" ON "pms_contracts" USING btree ("contractNumber");
CREATE INDEX IF NOT EXISTS "pms_contract_status_idx" ON "pms_contracts" USING btree ("status");
CREATE INDEX IF NOT EXISTS "pms_contract_tenant_idx" ON "pms_contracts" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_customer_name_idx" ON "pms_customer_accounts" USING btree ("name");
CREATE INDEX IF NOT EXISTS "pms_customer_parent_idx" ON "pms_customer_accounts" USING btree ("parentAccountId");
CREATE INDEX IF NOT EXISTS "pms_customer_dealer_idx" ON "pms_customer_accounts" USING btree ("dealerOrgId");
CREATE INDEX IF NOT EXISTS "pms_customer_tenant_idx" ON "pms_customer_accounts" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_feedback_sn_idx" ON "pms_customer_feedback" USING btree ("snCode");
CREATE INDEX IF NOT EXISTS "pms_feedback_maint_idx" ON "pms_customer_feedback" USING btree ("maintenanceRecordId");
CREATE INDEX IF NOT EXISTS "pms_feedback_tenant_idx" ON "pms_customer_feedback" USING btree ("tenantId");

CREATE UNIQUE INDEX IF NOT EXISTS "pms_health_dealer_period_idx" ON "pms_dealer_health_scores" USING btree ("dealerOrgId","period");
CREATE INDEX IF NOT EXISTS "pms_health_tenant_idx" ON "pms_dealer_health_scores" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_order_dealer_idx" ON "pms_dealer_orders" USING btree ("dealerOrgId","status");
CREATE UNIQUE INDEX IF NOT EXISTS "pms_order_number_idx" ON "pms_dealer_orders" USING btree ("orderNumber");
CREATE INDEX IF NOT EXISTS "pms_order_tenant_idx" ON "pms_dealer_orders" USING btree ("tenantId");

CREATE UNIQUE INDEX IF NOT EXISTS "pms_dealer_org_idx" ON "pms_dealer_org_profiles" USING btree ("orgId");
CREATE INDEX IF NOT EXISTS "pms_dealer_tenant_idx" ON "pms_dealer_org_profiles" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_qual_dealer_idx" ON "pms_dealer_qualifications" USING btree ("dealerOrgId");
CREATE INDEX IF NOT EXISTS "pms_qual_type_idx" ON "pms_dealer_qualifications" USING btree ("type","status");
CREATE INDEX IF NOT EXISTS "pms_qual_expiry_idx" ON "pms_dealer_qualifications" USING btree ("expiryDate","status");
CREATE INDEX IF NOT EXISTS "pms_qual_tenant_idx" ON "pms_dealer_qualifications" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_delivery_org_status_idx" ON "pms_delivery_orders" USING btree ("orgId","status","createdAt");
CREATE INDEX IF NOT EXISTS "pms_delivery_contract_idx" ON "pms_delivery_orders" USING btree ("contractId");
CREATE UNIQUE INDEX IF NOT EXISTS "pms_delivery_number_idx" ON "pms_delivery_orders" USING btree ("orderNumber");
CREATE INDEX IF NOT EXISTS "pms_delivery_tenant_idx" ON "pms_delivery_orders" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_task_order_idx" ON "pms_delivery_tasks" USING btree ("deliveryOrderId");
CREATE INDEX IF NOT EXISTS "pms_task_assignee_idx" ON "pms_delivery_tasks" USING btree ("assignedTo","status");
CREATE INDEX IF NOT EXISTS "pms_task_tenant_idx" ON "pms_delivery_tasks" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_lead_source_status_idx" ON "pms_demand_gen_leads" USING btree ("source","status");
CREATE INDEX IF NOT EXISTS "pms_lead_assigned_idx" ON "pms_demand_gen_leads" USING btree ("assignedTo");
CREATE INDEX IF NOT EXISTS "pms_lead_tenant_idx" ON "pms_demand_gen_leads" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_appeal_check_idx" ON "pms_duplicate_appeals" USING btree ("duplicateCheckId");
CREATE INDEX IF NOT EXISTS "pms_appeal_status_idx" ON "pms_duplicate_appeals" USING btree ("status");
CREATE INDEX IF NOT EXISTS "pms_appeal_tenant_idx" ON "pms_duplicate_appeals" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_dupcheck_opp_idx" ON "pms_duplicate_checks" USING btree ("opportunityId");
CREATE INDEX IF NOT EXISTS "pms_dupcheck_status_idx" ON "pms_duplicate_checks" USING btree ("status");
CREATE INDEX IF NOT EXISTS "pms_dupcheck_tenant_idx" ON "pms_duplicate_checks" USING btree ("tenantId");

CREATE UNIQUE INDEX IF NOT EXISTS "pms_sn_code_idx" ON "pms_equipment_sns" USING btree ("snCode");
CREATE INDEX IF NOT EXISTS "pms_sn_batch_status_idx" ON "pms_equipment_sns" USING btree ("batchNumber","status");
CREATE INDEX IF NOT EXISTS "pms_sn_delivery_idx" ON "pms_equipment_sns" USING btree ("deliveryOrderId");
CREATE INDEX IF NOT EXISTS "pms_sn_tenant_idx" ON "pms_equipment_sns" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_telemetry_sn_time_idx" ON "pms_equipment_telemetry" USING btree ("snCode","timestamp");
CREATE INDEX IF NOT EXISTS "pms_telemetry_tenant_idx" ON "pms_equipment_telemetry" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_followup_opp_time_idx" ON "pms_follow_ups" USING btree ("opportunityId","createdAt");
CREATE INDEX IF NOT EXISTS "pms_followup_tenant_idx" ON "pms_follow_ups" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_campaign_product_idx" ON "pms_key_product_campaigns" USING btree ("productId","status");
CREATE INDEX IF NOT EXISTS "pms_campaign_date_idx" ON "pms_key_product_campaigns" USING btree ("startDate","endDate");
CREATE INDEX IF NOT EXISTS "pms_campaign_tenant_idx" ON "pms_key_product_campaigns" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_maint_sn_idx" ON "pms_maintenance_records" USING btree ("equipmentSNId");
CREATE INDEX IF NOT EXISTS "pms_maint_status_idx" ON "pms_maintenance_records" USING btree ("status");
CREATE INDEX IF NOT EXISTS "pms_maint_expiry_idx" ON "pms_maintenance_records" USING btree ("scheduledAt","status");
CREATE INDEX IF NOT EXISTS "pms_maint_tenant_idx" ON "pms_maintenance_records" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_notifrule_type_idx" ON "pms_notification_rules" USING btree ("alertType","severity");
CREATE INDEX IF NOT EXISTS "pms_notifrule_tenant_idx" ON "pms_notification_rules" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_opp_orgid_status_stage_idx" ON "pms_opportunities" USING btree ("orgId","status","stage");
CREATE UNIQUE INDEX IF NOT EXISTS "pms_opp_dedupkey_idx" ON "pms_opportunities" USING btree ("dedupeKey");
CREATE INDEX IF NOT EXISTS "pms_opp_dealer_stage_idx" ON "pms_opportunities" USING btree ("dealerOrgId","stage","createdAt");
CREATE INDEX IF NOT EXISTS "pms_opp_alert_scan_idx" ON "pms_opportunities" USING btree ("lastFollowUpAt","status");
CREATE INDEX IF NOT EXISTS "pms_opp_analytics_idx" ON "pms_opportunities" USING btree ("tenantId","orgId","stage","status","region","productLine","createdAt");
CREATE INDEX IF NOT EXISTS "pms_opp_tenant_idx" ON "pms_opportunities" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_target_org_period_idx" ON "pms_performance_targets" USING btree ("orgId","period");
CREATE INDEX IF NOT EXISTS "pms_target_dealer_period_idx" ON "pms_performance_targets" USING btree ("dealerOrgId","period");
CREATE INDEX IF NOT EXISTS "pms_target_tenant_idx" ON "pms_performance_targets" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_price_opp_idx" ON "pms_price_applications" USING btree ("opportunityId");
CREATE INDEX IF NOT EXISTS "pms_price_status_idx" ON "pms_price_applications" USING btree ("status");
CREATE INDEX IF NOT EXISTS "pms_price_tenant_idx" ON "pms_price_applications" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_product_series_cat_idx" ON "pms_product_catalog" USING btree ("series","category","status");
CREATE INDEX IF NOT EXISTS "pms_product_model_idx" ON "pms_product_catalog" USING btree ("model");
CREATE INDEX IF NOT EXISTS "pms_product_tenant_idx" ON "pms_product_catalog" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_pool_released_idx" ON "pms_public_pool" USING btree ("releasedAt","claimed");
CREATE INDEX IF NOT EXISTS "pms_pool_opp_idx" ON "pms_public_pool" USING btree ("opportunityId");
CREATE INDEX IF NOT EXISTS "pms_pool_tenant_idx" ON "pms_public_pool" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_quote_opp_idx" ON "pms_quote_recommendations" USING btree ("opportunityId");
CREATE INDEX IF NOT EXISTS "pms_quote_tenant_idx" ON "pms_quote_recommendations" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_rebate_acc_dealer_period_idx" ON "pms_rebate_accruals" USING btree ("dealerOrgId","period");
CREATE INDEX IF NOT EXISTS "pms_rebate_acc_status_idx" ON "pms_rebate_accruals" USING btree ("status");
CREATE INDEX IF NOT EXISTS "pms_rebate_acc_tenant_idx" ON "pms_rebate_accruals" USING btree ("tenantId");

CREATE INDEX IF NOT EXISTS "pms_rebate_status_idx" ON "pms_rebate_policies" USING btree ("status");
CREATE INDEX IF NOT EXISTS "pms_rebate_tenant_idx" ON "pms_rebate_policies" USING btree ("tenantId");

-- Migration 0008: align User profile columns with drizzle-schema.ts.
-- Safe to run repeatedly on existing production databases.

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "departmentId" text;

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managerId" text;

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jobTitle" text;

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "employeeId" text;

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hireDate" text;

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workLocation" text;

--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" text;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "User_departmentId_idx" ON "User" ("departmentId");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "User_managerId_idx" ON "User" ("managerId");

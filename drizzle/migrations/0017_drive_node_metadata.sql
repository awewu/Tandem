ALTER TABLE "DriveFile" ADD COLUMN IF NOT EXISTS "nodeRole" text;
--> statement-breakpoint
ALTER TABLE "DriveFile" ADD COLUMN IF NOT EXISTS "distillable" boolean DEFAULT true NOT NULL;

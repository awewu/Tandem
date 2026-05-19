CREATE TABLE "KvStore" (
	"collection" text NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL,
	"tenantId" text DEFAULT 'default' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "KvStore_collection_id_pk" PRIMARY KEY("collection","id")
);
--> statement-breakpoint
CREATE INDEX "KvStore_collection_idx" ON "KvStore" USING btree ("collection");--> statement-breakpoint
CREATE INDEX "KvStore_tenant_idx" ON "KvStore" USING btree ("tenantId");
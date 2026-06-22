-- DOC-2/DOC-4: persist reverse links on Document so the canonical `Document`
-- table (V1 GA documentRepo) can store promote-to-memory / decision-card refs.
-- Idempotent: safe to re-run.
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "spawnedPromotionId" text;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "spawnedDecisionCardId" text;

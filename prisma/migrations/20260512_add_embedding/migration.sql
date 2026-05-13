-- Enable pgvector extension (requires pgvector to be installed on the PostgreSQL host)
-- If this fails, the application falls back to text-based search (V1 retriever).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector extension not available, skipping embedding columns';
END
$$;

-- Add embedding column to Material (only if pgvector is available)
DO $$
BEGIN
  ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS embedding vector(1536);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add embedding to Material';
END
$$;

-- Add embedding column to MemoryEntry (only if pgvector is available)
DO $$
BEGIN
  ALTER TABLE "MemoryEntry" ADD COLUMN IF NOT EXISTS embedding vector(1536);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add embedding to MemoryEntry';
END
$$;

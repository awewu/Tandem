-- Rhautt Nexus - Migration 055
-- Tenant-owned brand-site news articles for public website content.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.site_news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  site_id uuid NOT NULL REFERENCES rhautt_nexus.tenant_brand_sites(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text NOT NULL,
  summary text NOT NULL,
  body text NOT NULL DEFAULT '',
  cover_image_artifact_id uuid,
  cover_image_url text,
  published_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden', 'archived')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_featured boolean NOT NULL DEFAULT false,
  site_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES rhautt_nexus.users(id),
  updated_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_by uuid REFERENCES rhautt_nexus.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS site_news_articles_site_slug_uidx
  ON rhautt_nexus.site_news_articles (tenant_id, site_id, lower(slug))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS site_news_articles_public_idx
  ON rhautt_nexus.site_news_articles (tenant_id, site_id, status, sort_order, published_at)
  WHERE deleted_at IS NULL;

ALTER TABLE rhautt_nexus.site_news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.site_news_articles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_news_articles_tenant_isolation ON rhautt_nexus.site_news_articles;
CREATE POLICY site_news_articles_tenant_isolation ON rhautt_nexus.site_news_articles
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

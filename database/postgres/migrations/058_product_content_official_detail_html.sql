-- Rhautt Nexus - Migration 058
-- Official site product detail rich HTML for brand product detail pages.

SET search_path TO rhautt_nexus, public;

ALTER TABLE rhautt_nexus.product_content
  ADD COLUMN IF NOT EXISTS official_detail_html text;

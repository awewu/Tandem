-- Rhautt Nexus - Migration 057
-- Align Everhot local development URL with the current everhot-cn app port.

SET search_path TO rhautt_nexus, public;

UPDATE rhautt_nexus.tenant_brand_sites
SET development_url = 'http://localhost:5011',
    updated_at = now()
WHERE code = 'everhot'
  AND deleted_at IS NULL
  AND COALESCE(development_url, '') <> 'http://localhost:5011';

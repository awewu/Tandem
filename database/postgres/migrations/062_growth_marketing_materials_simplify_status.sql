SET search_path TO rhautt_nexus, public;

ALTER TABLE IF EXISTS rhautt_nexus.growth_marketing_material
  DROP CONSTRAINT IF EXISTS growth_marketing_material_type_chk;

ALTER TABLE IF EXISTS rhautt_nexus.growth_marketing_material
  DROP CONSTRAINT IF EXISTS growth_marketing_material_status_chk;

UPDATE rhautt_nexus.growth_marketing_material
SET status = 'active'
WHERE status IS NULL OR status IN ('draft', 'review', 'approved', 'published');

ALTER TABLE IF EXISTS rhautt_nexus.growth_marketing_material
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE IF EXISTS rhautt_nexus.growth_marketing_material
  ADD CONSTRAINT growth_marketing_material_status_chk
  CHECK (status IN ('active', 'archived'));

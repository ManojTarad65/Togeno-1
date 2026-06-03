-- Migration 020: Add label_url to shipments table
-- ===================================================

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS label_url TEXT;

-- RLS note: shipments uses row-level policies on the full row (SELECT *).
-- No column-level grant is needed; existing policies already cover new columns.
-- Verify: run `SELECT grantee, privilege_type FROM information_schema.role_column_grants WHERE table_name = 'shipments' AND column_name = 'label_url';`
-- If column-level grants exist on shipments, add: GRANT SELECT (label_url) ON shipments TO authenticated;

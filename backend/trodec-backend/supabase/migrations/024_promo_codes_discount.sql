-- Migration 024: Promo codes + discount on orders
-- =================================================

-- -------------------------
-- 1. Discount on orders
-- -------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code      TEXT;

-- -------------------------
-- 2. Promo codes master table
-- -------------------------
CREATE TABLE IF NOT EXISTS promo_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  discount_pct    DECIMAL(5,2) NOT NULL CHECK (discount_pct > 0 AND discount_pct <= 100),
  max_uses        INTEGER,                       -- NULL = unlimited
  used_count      INTEGER NOT NULL DEFAULT 0,
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  expires_at      TIMESTAMPTZ,                  -- NULL = never expires
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code      ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_is_active ON promo_codes(is_active);

CREATE TRIGGER update_promo_codes_updated_at
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------
-- 3. Per-user usage tracking
-- -------------------------
CREATE TABLE IF NOT EXISTS promo_code_usages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(promo_code_id, user_id)   -- one use per user per code
);

CREATE INDEX IF NOT EXISTS idx_promo_usages_user_id  ON promo_code_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_usages_promo_id ON promo_code_usages(promo_code_id);

-- -------------------------
-- 4. Seed the existing hardcoded codes
-- -------------------------
INSERT INTO promo_codes (code, discount_pct, max_uses, min_order_amount, is_active)
VALUES
  ('TRODEC10', 10, NULL, 0, true),
  ('TRODEC20', 20, NULL, 0, true),
  ('WELCOME',   5, NULL, 0, true)
ON CONFLICT (code) DO NOTHING;

-- -------------------------
-- 5. RLS
-- -------------------------
ALTER TABLE promo_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role bypass promo_codes"       ON promo_codes       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass promo_code_usages" ON promo_code_usages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public can read active promo codes (for validation)
CREATE POLICY "Public read active promo codes" ON promo_codes
  FOR SELECT TO authenticated USING (is_active = true);

-- Users can read their own usages
CREATE POLICY "Users read own promo usages" ON promo_code_usages
  FOR SELECT TO authenticated USING (user_id = auth.uid());

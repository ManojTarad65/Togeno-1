-- Migration 022: Brand payouts, free shipping for customers
-- ==========================================================
-- 1. orders.actual_shipping_cost  — what Trodec pays Shiprocket (hidden from customer)
-- 2. shipments tracking columns   — events timeline + estimated delivery
-- 3. brand_payouts                — brand net per order (subtotal - shipping - commission)
-- 4. brand_bank_accounts          — brand payout bank details
-- 5. brand_withdrawal_requests    — brand withdrawal flow

-- -------------------------
-- 1. Extend orders table
-- -------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS actual_shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0;

-- -------------------------
-- 2. Extend shipments table
-- -------------------------
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS tracking_events    JSONB,
  ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_url        TEXT,
  ADD COLUMN IF NOT EXISTS manifest_url       TEXT;

-- -------------------------
-- 3. Brand payouts
-- -------------------------
CREATE TABLE IF NOT EXISTS brand_payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  brand_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  order_amount        DECIMAL(10,2) NOT NULL,   -- subtotal the customer paid for item(s)
  shipping_cost       DECIMAL(10,2) NOT NULL DEFAULT 0,  -- actual Shiprocket freight
  platform_commission DECIMAL(10,2) NOT NULL,   -- total_commission from commissions table
  brand_net           DECIMAL(10,2) NOT NULL,   -- order_amount - shipping_cost - platform_commission
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'reserved', 'paid', 'reversed')),
  reversed_at         TIMESTAMPTZ,
  withdrawal_request_id UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_payouts_brand_id  ON brand_payouts(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_payouts_order_id  ON brand_payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_brand_payouts_status    ON brand_payouts(status);

CREATE TRIGGER update_brand_payouts_updated_at
  BEFORE UPDATE ON brand_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------
-- 4. Brand bank accounts
-- -------------------------
CREATE TABLE IF NOT EXISTS brand_bank_accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_holder_name  TEXT NOT NULL,
  account_number       TEXT NOT NULL,
  ifsc_code            TEXT NOT NULL,
  bank_name            TEXT NOT NULL,
  upi_id               TEXT,
  is_verified          BOOLEAN NOT NULL DEFAULT false,
  is_primary           BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brand_id, account_number)
);

CREATE INDEX IF NOT EXISTS idx_brand_bank_accounts_brand_id ON brand_bank_accounts(brand_id);

CREATE TRIGGER update_brand_bank_accounts_updated_at
  BEFORE UPDATE ON brand_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------
-- 5. Brand withdrawal requests
-- -------------------------
CREATE TABLE IF NOT EXISTS brand_withdrawal_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_account_id  UUID NOT NULL REFERENCES brand_bank_accounts(id) ON DELETE RESTRICT,
  amount           DECIMAL(10,2) NOT NULL CHECK (amount >= 100),
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  rejection_reason TEXT,
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at     TIMESTAMPTZ,
  paid_at          TIMESTAMPTZ,
  transaction_ref  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_withdrawals_brand_id ON brand_withdrawal_requests(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_withdrawals_status   ON brand_withdrawal_requests(status);

CREATE TRIGGER update_brand_withdrawal_requests_updated_at
  BEFORE UPDATE ON brand_withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- FK from brand_payouts.withdrawal_request_id
ALTER TABLE brand_payouts
  ADD CONSTRAINT fk_brand_payouts_withdrawal
  FOREIGN KEY (withdrawal_request_id)
  REFERENCES brand_withdrawal_requests(id)
  ON DELETE SET NULL
  NOT VALID;

-- -------------------------
-- 6. RLS policies
-- -------------------------
ALTER TABLE brand_payouts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_bank_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role bypass brand_payouts"     ON brand_payouts            FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass brand_bank_accounts" ON brand_bank_accounts    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role bypass brand_withdrawals" ON brand_withdrawal_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Brands can read their own payouts + bank accounts + withdrawals
CREATE POLICY "Brands read own payouts"      ON brand_payouts            FOR SELECT TO authenticated USING (brand_id = auth.uid());
CREATE POLICY "Brands read own bank accounts" ON brand_bank_accounts     FOR SELECT TO authenticated USING (brand_id = auth.uid());
CREATE POLICY "Brands read own withdrawals"  ON brand_withdrawal_requests FOR SELECT TO authenticated USING (brand_id = auth.uid());

-- Migration 023: Support per-brand payouts on multi-brand orders
-- ===============================================================
-- Replaces the single UNIQUE(order_id) constraint with
-- UNIQUE(order_id, brand_id) so one row per brand per order is allowed.

ALTER TABLE brand_payouts DROP CONSTRAINT IF EXISTS brand_payouts_order_id_key;

ALTER TABLE brand_payouts
  ADD CONSTRAINT brand_payouts_order_id_brand_id_key UNIQUE (order_id, brand_id);

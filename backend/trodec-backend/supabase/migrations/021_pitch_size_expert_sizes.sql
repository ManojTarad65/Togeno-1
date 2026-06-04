-- Migration 021: Add size selection to pitches + size preferences to expert_details
-- =================================================================================

-- Brand selects which size sample to send when pitching a product
ALTER TABLE pitches
  ADD COLUMN IF NOT EXISTS selected_size TEXT;

-- Expert saves their clothing/shoe size preferences once in their profile
-- Format: { "clothing": "M", "shoes": "UK 10", "bottoms": "32" }
ALTER TABLE expert_details
  ADD COLUMN IF NOT EXISTS clothing_sizes JSONB NOT NULL DEFAULT '{}';

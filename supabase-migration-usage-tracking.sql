-- Supabase Migration: Usage Tracking System
-- Purpose: Track feature usage for enforcing daily/monthly limits
-- Run this in your Supabase SQL Editor after the subscriptions migration

-- ==========================================
-- TABLE: usage_logs
-- ==========================================
-- Stores all feature usage events for limit enforcement

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Feature identification
  feature TEXT NOT NULL CHECK (feature IN (
    'ai_assistance',
    'transcription',
    'rag_training',
    'api_calls',
    'custom_personas',
    'conversations'
  )),

  -- Usage measurement
  usage_type TEXT NOT NULL CHECK (usage_type IN (
    'minutes',      -- For AI assistance and transcription
    'pages',        -- For RAG training documents
    'requests',     -- For API calls
    'count'         -- For countable items (personas, conversations)
  )),
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0, -- How much was used

  -- Timestamps
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  -- Optional metadata for debugging
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ==========================================
-- INDEXES for fast querying
-- ==========================================

-- Most common query: Get today's usage for a user's feature
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_date_feature
  ON usage_logs(user_id, date, feature);

-- For admin analytics: Usage by date
CREATE INDEX IF NOT EXISTS idx_usage_logs_date
  ON usage_logs(date);

-- For feature-specific queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_feature
  ON usage_logs(feature);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own usage logs
CREATE POLICY "Users can view own usage logs"
  ON usage_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- System (service role) can insert usage logs
CREATE POLICY "Service role can insert usage logs"
  ON usage_logs
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses this anyway

-- Only service role can update/delete (for corrections)
CREATE POLICY "Service role can manage usage logs"
  ON usage_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- ==========================================
-- HELPER FUNCTION: Get today's usage for a feature
-- ==========================================
-- Usage: SELECT get_today_usage('user-uuid', 'ai_assistance');

CREATE OR REPLACE FUNCTION get_today_usage(
  p_user_id UUID,
  p_feature TEXT
)
RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM usage_logs
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND date = CURRENT_DATE;
$$ LANGUAGE SQL STABLE;

-- ==========================================
-- HELPER FUNCTION: Get this month's usage
-- ==========================================
-- Usage: SELECT get_month_usage('user-uuid', 'rag_training');

CREATE OR REPLACE FUNCTION get_month_usage(
  p_user_id UUID,
  p_feature TEXT
)
RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM usage_logs
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND date >= DATE_TRUNC('month', CURRENT_DATE);
$$ LANGUAGE SQL STABLE;

-- ==========================================
-- HELPER FUNCTION: Log usage
-- ==========================================
-- Usage: SELECT log_usage('user-uuid', 'ai_assistance', 5.5, 'minutes');

CREATE OR REPLACE FUNCTION log_usage(
  p_user_id UUID,
  p_feature TEXT,
  p_amount DECIMAL,
  p_usage_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO usage_logs (user_id, feature, usage_type, amount, metadata)
  VALUES (p_user_id, p_feature, p_usage_type, p_amount, p_metadata)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- OPTIONAL: entitlements table for custom overrides
-- ==========================================
-- Use this to give specific users custom limits or features

CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Feature to override
  feature TEXT NOT NULL,

  -- Override settings
  enabled BOOLEAN DEFAULT TRUE,
  custom_limit INTEGER, -- NULL = unlimited, otherwise specific limit

  -- Expiry for temporary grants
  expires_at TIMESTAMP WITH TIME ZONE,

  -- Audit trail
  granted_by TEXT, -- Admin email who granted this
  granted_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

  -- Unique constraint: One override per user per feature
  UNIQUE(user_id, feature)
);

-- RLS for entitlements
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;

-- Users can read their own entitlements
CREATE POLICY "Users can view own entitlements"
  ON entitlements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can manage entitlements
CREATE POLICY "Service role can manage entitlements"
  ON entitlements
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for entitlements
CREATE INDEX IF NOT EXISTS idx_entitlements_user_id
  ON entitlements(user_id);

-- ==========================================
-- COMMENTS for documentation
-- ==========================================

COMMENT ON TABLE usage_logs IS 'Tracks feature usage for enforcing daily/monthly limits per subscription tier';
COMMENT ON COLUMN usage_logs.feature IS 'Feature being tracked: ai_assistance, transcription, rag_training, api_calls, custom_personas, conversations';
COMMENT ON COLUMN usage_logs.usage_type IS 'Unit of measurement: minutes, pages, requests, count';
COMMENT ON COLUMN usage_logs.amount IS 'Amount of the feature used (e.g., 5.5 minutes, 10 pages)';
COMMENT ON COLUMN usage_logs.date IS 'Date of usage (for daily rollups and limit checks)';

COMMENT ON TABLE entitlements IS 'Custom feature overrides for specific users (admin-granted exceptions to tier limits)';
COMMENT ON FUNCTION get_today_usage IS 'Returns total usage for a user-feature combination today';
COMMENT ON FUNCTION get_month_usage IS 'Returns total usage for a user-feature combination this month';
COMMENT ON FUNCTION log_usage IS 'Logs a usage event for a user-feature combination';

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================
-- Run these to verify the migration worked:

-- Check tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('usage_logs', 'entitlements');

-- Check functions exist
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('get_today_usage', 'get_month_usage', 'log_usage');

-- Test logging usage (replace 'your-user-uuid' with actual UUID)
-- SELECT log_usage('your-user-uuid', 'ai_assistance', 5.0, 'minutes', '{"session_id": "test-123"}'::jsonb);

-- Test getting usage
-- SELECT get_today_usage('your-user-uuid', 'ai_assistance');

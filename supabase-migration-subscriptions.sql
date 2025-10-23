-- Supabase Migration: Add Subscription Fields to Profiles Table
-- Run this in your Supabase SQL Editor or via CLI

-- Add subscription-related columns to the profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP;

-- Create an index on stripe_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles(stripe_customer_id);

-- Create an index on subscription_tier for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier
  ON profiles(subscription_tier);

-- Add a check constraint to ensure subscription_tier is valid
ALTER TABLE profiles
  ADD CONSTRAINT check_subscription_tier
  CHECK (subscription_tier IN ('free', 'premium', 'max'));

-- Add a comment to document the subscription_tier column
COMMENT ON COLUMN profiles.subscription_tier IS 'User subscription tier: free, premium, or max';
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Active Stripe subscription ID';
COMMENT ON COLUMN profiles.subscription_status IS 'Stripe subscription status: active, canceled, past_due, etc.';
COMMENT ON COLUMN profiles.subscription_current_period_end IS 'End date of current subscription billing period';

-- Optional: Set existing users to 'free' tier if NULL
UPDATE profiles
SET subscription_tier = 'free'
WHERE subscription_tier IS NULL;

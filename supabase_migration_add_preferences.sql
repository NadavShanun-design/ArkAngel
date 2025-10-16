-- Migration: Add design and persona preferences to profiles table
-- This SQL script adds new columns to store user preferences for design settings and persona selection
-- Run this in your Supabase SQL Editor

-- Add design_accent column (stores 'bw' or 'rainbow')
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS design_accent TEXT DEFAULT 'bw'
CHECK (design_accent IN ('bw', 'rainbow'));

-- Add design_gradient column (stores 'bw' or 'rainbow')
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS design_gradient TEXT DEFAULT 'bw'
CHECK (design_gradient IN ('bw', 'rainbow'));

-- Add current_persona_id column (stores the active persona ID)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS current_persona_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN profiles.design_accent IS 'User preference for accent color style: black-and-white or rainbow';
COMMENT ON COLUMN profiles.design_gradient IS 'User preference for gradient style: black-and-white or rainbow';
COMMENT ON COLUMN profiles.current_persona_id IS 'ID of the currently active AI persona for this user';

-- Create index for faster lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_profiles_current_persona ON profiles(current_persona_id);

-- Migration: Support anonymous/guest users in profiles table
-- This SQL script modifies the profiles table to allow guest users with no email
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/editor

-- Step 1: Make email column nullable (required for anonymous users)
ALTER TABLE profiles
ALTER COLUMN email DROP NOT NULL;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN profiles.email IS 'User email address (nullable for anonymous/guest users)';

-- Step 3: Verify RLS policy exists for anonymous users to create profiles
-- This ensures anonymous users can insert their own profile after sign-in
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Allow users to create own profile'
  ) THEN
    CREATE POLICY "Allow users to create own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Step 4: Verify RLS policy allows anonymous users to read their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Allow users to read own profile'
  ) THEN
    CREATE POLICY "Allow users to read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);
  END IF;
END $$;

-- Step 5: Verify RLS policy allows anonymous users to update their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Allow users to update own profile'
  ) THEN
    CREATE POLICY "Allow users to update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Verify the changes
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'email';

-- Expected output: email | YES | text

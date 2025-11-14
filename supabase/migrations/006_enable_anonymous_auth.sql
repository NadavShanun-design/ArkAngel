-- Enable Anonymous Authentication
-- This migration ensures guest users can sign in and create profiles
-- IMPORTANT: Run this AFTER 000_create_profiles_table.sql

-- 1. Make email column nullable in profiles table (required for anonymous users)
-- This is safe to run even if already nullable
DO $$
BEGIN
    ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
EXCEPTION
    WHEN undefined_column THEN NULL;
    WHEN others THEN
        RAISE NOTICE 'Email column already nullable or other issue';
END $$;

-- Note: The RLS policies for anonymous users are already created in 000_create_profiles_table.sql
-- These policies allow anonymous users to INSERT, SELECT, and UPDATE their own profiles

-- Verify that the anon policies exist
DO $$
BEGIN
    -- Check if anonymous policies exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'profiles'
        AND policyname = 'anon_insert_own_profile'
    ) THEN
        -- Create policy if it doesn't exist
        EXECUTE 'CREATE POLICY anon_insert_own_profile ON public.profiles FOR INSERT TO anon WITH CHECK (id = auth.uid())';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'profiles'
        AND policyname = 'anon_read_own_profile'
    ) THEN
        EXECUTE 'CREATE POLICY anon_read_own_profile ON public.profiles FOR SELECT TO anon USING (id = auth.uid())';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'profiles'
        AND policyname = 'anon_update_own_profile'
    ) THEN
        EXECUTE 'CREATE POLICY anon_update_own_profile ON public.profiles FOR UPDATE TO anon USING (id = auth.uid()) WITH CHECK (id = auth.uid())';
    END IF;
END $$;

-- Verify RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- IMPORTANT MANUAL STEP:
-- You must also enable anonymous sign-ins in Supabase Dashboard:
-- 1. Go to Authentication → Settings
-- 2. Find "Anonymous sign-ins"
-- 3. Toggle it ON
-- 4. Click Save

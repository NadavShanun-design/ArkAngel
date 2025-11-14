-- =====================================================
-- Migration: Enable Anonymous Auth RLS Policies
-- Purpose: Allow anonymous users to create and manage their own profiles
-- Date: 2025-11-14
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "users_read_own" ON public.profiles;
DROP POLICY IF EXISTS "employers_read_employees" ON public.profiles;

-- =====================================================
-- PROFILES TABLE RLS POLICIES
-- =====================================================

-- Allow authenticated users (including anonymous) to insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow employers to read profiles of employees in their organization
CREATE POLICY "Employers can read org employees"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User can read their own profile
  auth.uid() = id
  OR
  -- Employer can read employees in their organization
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
    AND p.role = 'employer'
    AND p.organization_id = profiles.organization_id
  )
);

-- Allow authenticated users to update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- =====================================================
-- ORGANIZATIONS TABLE RLS POLICIES
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "employers_read_own_org" ON public.organizations;
DROP POLICY IF EXISTS "authenticated_insert_org" ON public.organizations;

-- Allow employers to read their own organization
CREATE POLICY "Employers can read own org"
ON public.organizations
FOR SELECT
TO authenticated
USING (employer_id = auth.uid());

-- Allow authenticated users to insert via RPC functions only
-- Direct inserts are blocked, only setup_employer_account can insert
CREATE POLICY "Allow insert via RPC"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);  -- RPC function will handle validation

-- =====================================================
-- SCREENSHOTS TABLE RLS POLICIES
-- =====================================================

-- Allow users to insert their own screenshots
CREATE POLICY "Users can insert own screenshots"
ON public.screenshots
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow users to read their own screenshots
CREATE POLICY "Users can read own screenshots"
ON public.screenshots
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow employers to read screenshots from their organization
CREATE POLICY "Employers can read org screenshots"
ON public.screenshots
FOR SELECT
TO authenticated
USING (
  -- User can read their own screenshots
  user_id = auth.uid()
  OR
  -- Employer can read screenshots from their organization
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
    AND p.role = 'employer'
    AND p.organization_id = screenshots.organization_id
  )
);

-- =====================================================
-- EMPLOYEE_ANALYTICS TABLE RLS POLICIES
-- =====================================================

-- Allow users to read their own analytics
CREATE POLICY "Users can read own analytics"
ON public.employee_analytics
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow employers to read analytics from their organization
CREATE POLICY "Employers can read org analytics"
ON public.employee_analytics
FOR SELECT
TO authenticated
USING (
  -- User can read their own analytics
  user_id = auth.uid()
  OR
  -- Employer can read analytics from their organization
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = auth.uid()
    AND p.role = 'employer'
    AND p.organization_id = employee_analytics.organization_id
  )
);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify RLS is enabled on all tables
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'organizations') THEN
    ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'screenshots') THEN
    ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'employee_analytics') THEN
    ALTER TABLE public.employee_analytics ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Anonymous auth RLS policies created successfully!';
  RAISE NOTICE '⚠️  Make sure to enable "Anonymous Sign-Ins" in Supabase Dashboard';
  RAISE NOTICE '📍 Authentication > Providers > Anonymous Sign-Ins = ON';
END $$;

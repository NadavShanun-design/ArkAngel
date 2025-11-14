-- Migration: Create profiles table for user data
-- This table extends Supabase auth.users with custom profile information
-- Date: 2025-11-13

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
    website TEXT,
    design_accent TEXT,
    design_gradient TEXT,
    current_persona_id TEXT,
    theme TEXT,
    subscription_tier TEXT DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT,
    subscription_current_period_end TIMESTAMPTZ,
    -- Multi-tenant fields
    role TEXT CHECK (role IN ('employer', 'employee')),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    employer_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_employer_code ON public.profiles(employer_code);

-- RLS Policies

-- Allow users to read their own profile
DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
CREATE POLICY "users_read_own_profile" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

-- Allow anonymous users to read their own profile
DROP POLICY IF EXISTS "anon_read_own_profile" ON public.profiles;
CREATE POLICY "anon_read_own_profile" ON public.profiles
FOR SELECT TO anon
USING (id = auth.uid());

-- Allow users to update their own profile
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
CREATE POLICY "users_update_own_profile" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Allow anonymous users to update their own profile
DROP POLICY IF EXISTS "anon_update_own_profile" ON public.profiles;
CREATE POLICY "anon_update_own_profile" ON public.profiles
FOR UPDATE TO anon
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Allow users to insert their own profile
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
CREATE POLICY "users_insert_own_profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- Allow anonymous users to insert their own profile
DROP POLICY IF EXISTS "anon_insert_own_profile" ON public.profiles;
CREATE POLICY "anon_insert_own_profile" ON public.profiles
FOR INSERT TO anon
WITH CHECK (id = auth.uid());

-- Employers can read employees in their organization
DROP POLICY IF EXISTS "employers_read_employees_profiles" ON public.profiles;
CREATE POLICY "employers_read_employees_profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE employer_id = auth.uid()
  )
);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Comments
COMMENT ON TABLE public.profiles IS 'Extended user profile information';
COMMENT ON COLUMN public.profiles.role IS 'User role: employer (can see all employees) or employee (can only see own data)';
COMMENT ON COLUMN public.profiles.organization_id IS 'Links user to an organization for multi-tenant isolation';
COMMENT ON COLUMN public.profiles.employer_code IS 'Employer code for sharing with employees (employers only)';

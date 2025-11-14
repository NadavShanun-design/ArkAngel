-- Migration: Create organizations table with employer codes
-- Date: 2025-11-12
-- Description: Sets up multi-tenant organization structure for employer/employee system

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  employer_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_employer UNIQUE(employer_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_organizations_employer_id ON public.organizations(employer_id);
CREATE INDEX IF NOT EXISTS idx_organizations_employer_code ON public.organizations(employer_code);

-- Enable Row Level Security
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Employers can read their own organization
CREATE POLICY "employers_read_own_org" ON public.organizations
FOR SELECT TO authenticated
USING (employer_id = auth.uid());

-- RLS Policy: Only authenticated users can insert (via functions)
CREATE POLICY "authenticated_insert_org" ON public.organizations
FOR INSERT TO authenticated
WITH CHECK (employer_id = auth.uid());

-- Function to generate unique employer codes
CREATE OR REPLACE FUNCTION public.generate_employer_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude similar looking chars (0,O,1,I)
  result TEXT := 'EMP-';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Function to create organization for employer (Security Definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.create_employer_organization(
  p_user_id UUID,
  p_org_name TEXT
)
RETURNS TABLE(id UUID, employer_code TEXT) AS $$
DECLARE
  new_org_id UUID;
  new_code TEXT;
BEGIN
  -- Generate unique code
  LOOP
    new_code := public.generate_employer_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.organizations WHERE organizations.employer_code = new_code);
  END LOOP;

  -- Create organization
  INSERT INTO public.organizations (employer_id, name, employer_code)
  VALUES (p_user_id, p_org_name, new_code)
  RETURNING organizations.id, organizations.employer_code INTO new_org_id, new_code;

  RETURN QUERY SELECT new_org_id, new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on table
COMMENT ON TABLE public.organizations IS 'Stores employer organizations with unique invite codes for multi-tenant employee monitoring';

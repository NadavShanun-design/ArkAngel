-- Migration: Extend users table with role and organization fields
-- Date: 2025-11-12
-- Description: Adds employer/employee role system and organization linking

-- Add new columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'employee';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employer_code TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_employer_code ON public.users(employer_code);

-- Add constraint to validate role values
ALTER TABLE public.users ADD CONSTRAINT chk_user_role CHECK (role IN ('employer', 'employee'));

-- RLS Policies for users table

-- Users can read their own profile
DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_own" ON public.users
FOR SELECT TO authenticated
USING (id = auth.uid());

-- Users can update their own profile
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Employers can read employees in their organization
DROP POLICY IF EXISTS "employers_read_employees" ON public.users;
CREATE POLICY "employers_read_employees" ON public.users
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE employer_id = auth.uid()
  )
);

-- Function to link employee to organization
CREATE OR REPLACE FUNCTION public.link_employee_to_organization(
  p_user_id UUID,
  p_employer_code TEXT
)
RETURNS TABLE(success BOOLEAN, organization_id UUID, employer_name TEXT) AS $$
DECLARE
  v_org_id UUID;
  v_employer_id UUID;
  v_org_name TEXT;
  v_employer_name TEXT;
BEGIN
  -- Find organization by code
  SELECT o.id, o.employer_id, o.name
  INTO v_org_id, v_employer_id, v_org_name
  FROM public.organizations o
  WHERE o.employer_code = p_employer_code;

  -- Check if organization exists
  IF v_org_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- Get employer name
  SELECT full_name INTO v_employer_name
  FROM public.users
  WHERE id = v_employer_id;

  -- Update user with role and organization
  UPDATE public.users
  SET
    role = 'employee',
    organization_id = v_org_id,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, v_org_id, COALESCE(v_employer_name, v_org_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user role to employer and create organization
CREATE OR REPLACE FUNCTION public.setup_employer_account(
  p_user_id UUID,
  p_org_name TEXT
)
RETURNS TABLE(success BOOLEAN, employer_code TEXT, organization_id UUID) AS $$
DECLARE
  v_org_id UUID;
  v_code TEXT;
BEGIN
  -- Create organization
  SELECT o.id, o.employer_code INTO v_org_id, v_code
  FROM public.create_employer_organization(p_user_id, p_org_name) o;

  -- Update user
  UPDATE public.users
  SET
    role = 'employer',
    organization_id = v_org_id,
    employer_code = v_code,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, v_code, v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN public.users.role IS 'User role: employer (can see all employees) or employee (can only see own data)';
COMMENT ON COLUMN public.users.organization_id IS 'Links user to an organization for multi-tenant isolation';
COMMENT ON COLUMN public.users.employer_code IS 'Employer code for sharing with employees (employers only)';

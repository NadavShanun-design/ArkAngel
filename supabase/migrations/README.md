# Supabase Database Migrations

## Overview
These SQL migrations set up the complete multi-tenant employer/employee system for ArkAngel.

## Migration Files

1. **001_create_organizations_table.sql** - Creates organizations with unique employer codes
2. **002_extend_users_table.sql** - Adds role, organization_id fields to users
3. **003_create_screenshots_table.sql** - Creates screenshots table with RLS
4. **004_create_employee_analytics_table.sql** - Creates analytics table with auto-updates
5. **005_setup_storage_and_realtime.sql** - Configures storage bucket and realtime

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each migration file in order (001 → 005)
4. Copy the contents of each `.sql` file
5. Paste into SQL Editor and click "Run"
6. Verify no errors appear

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Post-Migration Steps

### 1. Configure Custom Access Token Hook

Go to **Auth > Hooks** in Supabase Dashboard:

1. Click "Add Auth Hook"
2. Select "Custom Access Token"
3. Add this function:

```sql
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  user_role TEXT;
  org_id UUID;
BEGIN
  -- Get user role and organization
  SELECT role, organization_id INTO user_role, org_id
  FROM public.users
  WHERE id = (event->>'user_id')::UUID;

  -- Add to JWT app_metadata
  event := jsonb_set(
    event,
    '{claims,app_metadata}',
    jsonb_build_object(
      'role', COALESCE(user_role, 'employee'),
      'organization_id', org_id
    )
  );

  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

4. Enable the hook and save

### 2. Enable Realtime

Go to **Database > Replication** in Supabase Dashboard:

1. Find `screenshots` table
2. Click toggle to enable replication
3. Find `employee_analytics` table
4. Click toggle to enable replication

### 3. Verify Storage Bucket

Go to **Storage** in Supabase Dashboard:

1. Verify `screenshots` bucket exists
2. Check that RLS policies are enabled
3. Test upload by running:

```sql
SELECT * FROM storage.buckets WHERE id = 'screenshots';
```

## Testing Migrations

Run these test queries to verify everything is set up correctly:

```sql
-- Test 1: Check organizations table
SELECT * FROM public.organizations LIMIT 5;

-- Test 2: Check users table has new columns
SELECT id, email, role, organization_id, employer_code
FROM public.users LIMIT 5;

-- Test 3: Test employer code generation
SELECT public.generate_employer_code();

-- Test 4: Check screenshots table
SELECT * FROM public.screenshots LIMIT 5;

-- Test 5: Check employee_analytics table
SELECT * FROM public.employee_analytics LIMIT 5;

-- Test 6: Check storage policies
SELECT * FROM storage.objects LIMIT 5;

-- Test 7: Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'organizations', 'screenshots', 'employee_analytics');
```

## Important Functions Created

### For Frontend/Backend Use:

1. **`create_employer_organization(user_id, org_name)`**
   - Creates organization with unique code
   - Returns: `{id, employer_code}`

2. **`setup_employer_account(user_id, org_name)`**
   - Sets up complete employer account
   - Updates user role and creates organization
   - Returns: `{success, employer_code, organization_id}`

3. **`link_employee_to_organization(user_id, employer_code)`**
   - Links employee to employer via code
   - Returns: `{success, organization_id, employer_name}`

4. **`update_employee_analytics(user_id)`**
   - Recalculates employee statistics
   - Called automatically via trigger

5. **`insert_screenshot(...)`**
   - Safely inserts screenshot with validation
   - Returns: screenshot UUID

## Row Level Security (RLS) Summary

### Users Table
- ✅ Users can read/update their own profile
- ✅ Employers can read employees in their organization

### Organizations Table
- ✅ Employers can read their own organization
- ✅ All modifications through security definer functions

### Screenshots Table
- ✅ Employees can insert/read/update their own screenshots
- ✅ Employers can read all screenshots in their organization

### Employee Analytics Table
- ✅ Employees can read their own analytics
- ✅ Employers can read analytics for their organization

### Storage
- ✅ Employees upload to their own folder: `screenshots/{user_id}/filename.png`
- ✅ Employees can read their own files
- ✅ Employers can read files from their employees

## Rollback (if needed)

To rollback migrations in reverse order:

```sql
-- Rollback storage and realtime
DROP POLICY IF EXISTS "employers_read_org_screenshots" ON storage.objects;
DROP POLICY IF EXISTS "users_delete_own_screenshots" ON storage.objects;
DROP POLICY IF EXISTS "users_update_own_screenshots" ON storage.objects;
DROP POLICY IF EXISTS "users_read_own_screenshots" ON storage.objects;
DROP POLICY IF EXISTS "employees_upload_own_screenshots" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'screenshots';

-- Rollback employee_analytics
DROP TRIGGER IF EXISTS screenshot_updated_update_analytics ON public.screenshots;
DROP TRIGGER IF EXISTS screenshot_inserted_update_analytics ON public.screenshots;
DROP FUNCTION IF EXISTS public.trigger_update_analytics();
DROP FUNCTION IF EXISTS public.update_employee_analytics(UUID);
DROP TABLE IF EXISTS public.employee_analytics;

-- Rollback screenshots
DROP TRIGGER IF EXISTS screenshot_update_timestamp ON public.screenshots;
DROP FUNCTION IF EXISTS public.update_screenshot_timestamp();
DROP FUNCTION IF EXISTS public.insert_screenshot(...);
DROP TABLE IF EXISTS public.screenshots;

-- Rollback users extensions
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_user_role;
ALTER TABLE public.users DROP COLUMN IF EXISTS employer_code;
ALTER TABLE public.users DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS role;
DROP FUNCTION IF EXISTS public.link_employee_to_organization(UUID, TEXT);
DROP FUNCTION IF EXISTS public.setup_employer_account(UUID, TEXT);

-- Rollback organizations
DROP FUNCTION IF EXISTS public.create_employer_organization(UUID, TEXT);
DROP FUNCTION IF EXISTS public.generate_employer_code();
DROP TABLE IF EXISTS public.organizations;
```

## Support

If you encounter any issues:

1. Check Supabase logs: Dashboard > Logs
2. Verify RLS policies: Database > Policies
3. Test with SQL Editor: Dashboard > SQL Editor
4. Check migration order was followed (001 → 005)

## Next Steps

After running migrations successfully:

1. Update environment variables with Supabase credentials
2. Implement Rust backend integration (Phase 2)
3. Build frontend authentication flow (Phase 3)
4. Test end-to-end with real users

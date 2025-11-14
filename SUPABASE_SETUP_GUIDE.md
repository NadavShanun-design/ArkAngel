# Supabase Multi-Tenant Setup Guide

This guide will walk you through setting up the complete employer/employee multi-tenant system in Supabase.

## Prerequisites

- Active Supabase project
- Access to Supabase Dashboard
- Supabase project URL and anon key

## Part 1: Run Database Migrations

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query** button

### Step 2: Run Migrations in Order

**IMPORTANT**: Run these migrations in the exact order listed below. Each migration depends on the previous one.

#### Migration 1: Create Organizations Table

1. Open `supabase/migrations/001_create_organizations_table.sql`
2. Copy the entire contents
3. Paste into SQL Editor
4. Click **Run** button
5. ✅ Verify you see "Success. No rows returned"

#### Migration 2: Extend Users Table

1. Open `supabase/migrations/002_extend_users_table.sql`
2. Copy the entire contents
3. Paste into SQL Editor
4. Click **Run** button
5. ✅ Verify you see "Success. No rows returned"

#### Migration 3: Create Screenshots Table

1. Open `supabase/migrations/003_create_screenshots_table.sql`
2. Copy the entire contents
3. Paste into SQL Editor
4. Click **Run** button
5. ✅ Verify you see "Success. No rows returned"

#### Migration 4: Create Employee Analytics Table

1. Open `supabase/migrations/004_create_employee_analytics_table.sql`
2. Copy the entire contents
3. Paste into SQL Editor
4. Click **Run** button
5. ✅ Verify you see "Success. No rows returned"

#### Migration 5: Setup Storage and Realtime

1. Open `supabase/migrations/005_setup_storage_and_realtime.sql`
2. Copy the entire contents
3. Paste into SQL Editor
4. Click **Run** button
5. ✅ Verify you see "Success. No rows returned"

### Step 3: Verify Migrations

Run this test query to verify all tables were created:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('organizations', 'users', 'screenshots', 'employee_analytics')
ORDER BY tablename;
```

You should see 4 rows returned.

## Part 2: Configure Authentication Hooks

### Step 1: Create Custom Access Token Hook

This hook adds user role and organization to the JWT token.

1. Go to **Authentication** → **Hooks** in Supabase Dashboard
2. Click **"Add a new Hook"**
3. Select **"Custom Access Token"** from the dropdown
4. Click **"Create a new hook"**
5. Paste this SQL:

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

6. Click **"Create function"**
7. Enable the hook and click **"Save"**

## Part 3: Enable Realtime

### Step 1: Enable Replication for Screenshots Table

1. Go to **Database** → **Replication** in Supabase Dashboard
2. Find the **screenshots** table
3. Click the toggle to **enable replication**
4. Wait for confirmation

### Step 2: Enable Replication for Employee Analytics Table

1. In the same **Database** → **Replication** section
2. Find the **employee_analytics** table
3. Click the toggle to **enable replication**
4. Wait for confirmation

## Part 4: Verify Storage Bucket

### Step 1: Check Screenshots Bucket

1. Go to **Storage** in Supabase Dashboard
2. Verify you see a bucket named **screenshots**
3. Click on the bucket
4. Go to **Configuration** tab
5. Verify:
   - ✅ Public bucket: **OFF** (private)
   - ✅ File size limit: **10 MB**
   - ✅ Allowed MIME types: `image/png, image/jpeg, image/jpg, image/webp`

### Step 2: Verify Storage Policies

1. Go to **Storage** → **Policies**
2. Click on **screenshots** bucket
3. You should see 5 policies:
   - ✅ `employees_upload_own_screenshots` (INSERT)
   - ✅ `users_read_own_screenshots` (SELECT)
   - ✅ `employers_read_org_screenshots` (SELECT)
   - ✅ `users_update_own_screenshots` (UPDATE)
   - ✅ `users_delete_own_screenshots` (DELETE)

## Part 5: Test Database Functions

Run these test queries to ensure everything works:

### Test 1: Generate Employer Code

```sql
SELECT public.generate_employer_code();
```

Should return something like: `EMP-X7K9M2`

### Test 2: Check Tables Structure

```sql
-- Test organizations table
SELECT * FROM public.organizations LIMIT 5;

-- Test users table has new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('role', 'organization_id', 'employer_code');

-- Test screenshots table
SELECT * FROM public.screenshots LIMIT 5;

-- Test employee_analytics table
SELECT * FROM public.employee_analytics LIMIT 5;
```

### Test 3: Verify Row Level Security

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'organizations', 'screenshots', 'employee_analytics');
```

All 4 tables should show `rowsecurity = true`

## Part 6: Update Environment Variables

### Step 1: Get Your Supabase Credentials

1. Go to **Project Settings** → **API** in Supabase Dashboard
2. Copy your **Project URL** (e.g., `https://xxxxxxxxx.supabase.co`)
3. Copy your **anon public** key

### Step 2: Update .env.local

1. Open `.env.local` in the root directory
2. Update these values:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

3. Save the file

### Step 3: Restart Development Server

If the app is running, restart it to load new environment variables:

```bash
# Stop the current dev server (Ctrl+C)
# Then restart
npm run tauri dev
```

## Verification Checklist

Before proceeding to Phase 2, verify:

- [ ] All 5 migrations ran successfully without errors
- [ ] Custom Access Token Hook is created and enabled
- [ ] Realtime replication enabled for `screenshots` table
- [ ] Realtime replication enabled for `employee_analytics` table
- [ ] Screenshots storage bucket exists with correct settings
- [ ] All 5 storage policies are in place
- [ ] Test queries return expected results
- [ ] Environment variables updated in `.env.local`
- [ ] No errors in Supabase logs (**Logs** section in dashboard)

## Troubleshooting

### Issue: Migration fails with "relation already exists"

**Solution**: The table/function already exists. Either:
1. Drop the existing object first (see rollback section in README)
2. Or modify the migration to use `CREATE OR REPLACE` or `IF NOT EXISTS`

### Issue: "permission denied for table users"

**Solution**: Make sure you're running migrations as the project owner/admin, not as an authenticated user.

### Issue: Storage bucket policies not working

**Solution**:
1. Verify RLS is enabled on `storage.objects` table
2. Check that policies were created without syntax errors
3. Test with an actual authenticated user (not anonymous)

### Issue: Realtime not working

**Solution**:
1. Verify replication is enabled in Database → Replication
2. Check that the publication `supabase_realtime` exists
3. Ensure you're subscribing to the correct channel name

### Issue: Custom Access Token Hook not firing

**Solution**:
1. Verify the hook is **enabled** (toggle should be ON)
2. Check Supabase logs for any errors
3. Try signing out and signing back in to trigger a new token

## Next Steps

Once you've completed all verification steps above:

1. ✅ **Phase 1 Complete**: Database schema and Supabase configuration
2. ➡️ **Phase 2 Next**: Rust/Tauri backend integration
   - Add Supabase client to Rust
   - Modify screenshot sync to upload to Supabase
   - Update employee tracker to sync analytics

Proceed to Phase 2 implementation when ready!

## Support

If you encounter issues not covered in troubleshooting:

1. Check Supabase Logs: **Logs** section in dashboard
2. Verify each migration ran in correct order
3. Check that environment variables are correctly set
4. Review RLS policies: **Database** → **Policies**

---

**Last Updated**: 2025-11-12
**Version**: 1.0.0

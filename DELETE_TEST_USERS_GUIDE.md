# Delete Test Users from Supabase - Quick Guide

**Date**: 2025-11-12
**Issue**: Need to delete previously registered test emails to retry role selection
**Supabase Project**: https://oyexmxetjudbnuhairry.supabase.co

---

## 🎯 Quick Access

**Supabase Dashboard**: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry

---

## Method 1: Delete via Supabase Dashboard (EASIEST) ✅

### Step-by-Step Instructions

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry
   - Sign in with your Supabase account

2. **Navigate to Authentication**
   - In the left sidebar, click **"Authentication"**
   - Click **"Users"** sub-menu

3. **Find the Test User**
   - You'll see a list of all registered users
   - Look for the email you want to delete (e.g., `test@example.com`)

4. **Delete the User**
   - Click the **three dots (⋯)** on the right side of the user row
   - Click **"Delete user"**
   - Confirm the deletion when prompted

5. **Verify Deletion**
   - The user should disappear from the list
   - You can now register with the same email again

---

## Method 2: Delete via SQL Editor (ADVANCED)

### Step-by-Step Instructions

1. **Open SQL Editor**
   - Go to: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/sql
   - Click **"SQL Editor"** in left sidebar

2. **Run Delete Query**
   - Paste the following SQL:
   ```sql
   -- Delete user from auth.users table
   DELETE FROM auth.users
   WHERE email = 'test@example.com';

   -- Also delete from profiles table (if exists)
   DELETE FROM public.profiles
   WHERE email = 'test@example.com';
   ```

3. **Replace Email**
   - Change `'test@example.com'` to the actual email you want to delete

4. **Execute Query**
   - Click **"Run"** button (or press Ctrl+Enter)
   - Check the output for success message

---

## Method 3: Delete All Test Users (BULK DELETE)

**⚠️ WARNING**: This will delete ALL users from your database. Only use in development!

### SQL Query for Bulk Delete

```sql
-- Delete all users from auth.users
DELETE FROM auth.users;

-- Delete all profiles
DELETE FROM public.profiles;

-- Delete all organizations
DELETE FROM public.organizations;

-- Delete all organization_users
DELETE FROM public.organization_users;

-- Reset sequences (optional)
ALTER SEQUENCE IF EXISTS public.organizations_id_seq RESTART WITH 1;
```

**When to Use**:
- Only in development environment
- When you want a completely fresh start
- Before final production deployment

---

## Method 4: Delete Specific Emails via SQL

If you have multiple test emails to delete:

```sql
-- Delete multiple specific users
DELETE FROM auth.users
WHERE email IN (
  'employer@test.com',
  'employee@test.com',
  'test1@example.com',
  'test2@example.com'
);

-- Also delete their profiles
DELETE FROM public.profiles
WHERE email IN (
  'employer@test.com',
  'employee@test.com',
  'test1@example.com',
  'test2@example.com'
);
```

---

## Troubleshooting

### Issue: "Cannot delete user - foreign key constraint"

**Cause**: User has related data in other tables (profiles, organizations, etc.)

**Solution**: Delete in this order:
```sql
-- 1. Delete from organization_users first
DELETE FROM public.organization_users
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'test@example.com'
);

-- 2. Delete from profiles
DELETE FROM public.profiles
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'test@example.com'
);

-- 3. Delete organizations owned by user (if employer)
DELETE FROM public.organizations
WHERE employer_id IN (
  SELECT id FROM auth.users WHERE email = 'test@example.com'
);

-- 4. Finally delete from auth.users
DELETE FROM auth.users
WHERE email = 'test@example.com';
```

---

### Issue: "User deleted but can't re-register with same email"

**Cause**: Supabase caches authentication data for a short period

**Solution**:
1. Wait 1-2 minutes after deletion
2. Clear browser localStorage:
   - Open DevTools (F12)
   - Go to "Application" tab → "Local Storage"
   - Delete all `sb-` prefixed keys
   - Refresh the page
3. Try registering again

---

### Issue: "User exists in profiles but not in auth.users"

**Cause**: Manual deletion or database inconsistency

**Solution**:
```sql
-- Clean up orphaned profiles (profiles without auth users)
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- Clean up orphaned organization_users
DELETE FROM public.organization_users
WHERE user_id NOT IN (SELECT id FROM auth.users);
```

---

## Complete Clean Slate Script

Use this to start completely fresh (development only):

```sql
-- Step 1: Disable foreign key checks temporarily (PostgreSQL specific)
SET session_replication_role = 'replica';

-- Step 2: Delete all data from all tables
TRUNCATE auth.users CASCADE;
TRUNCATE public.profiles CASCADE;
TRUNCATE public.organizations CASCADE;
TRUNCATE public.organization_users CASCADE;

-- Step 3: Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Step 4: Reset auto-increment sequences
ALTER SEQUENCE IF EXISTS public.organizations_id_seq RESTART WITH 1;

-- Verify all tables are empty
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'organizations', COUNT(*) FROM public.organizations
UNION ALL
SELECT 'organization_users', COUNT(*) FROM public.organization_users;
```

**Expected Output**: All counts should be 0.

---

## Quick Reference: Common Email Patterns

Delete by email pattern (e.g., all test emails):

```sql
-- Delete all emails containing "test"
DELETE FROM auth.users
WHERE email LIKE '%test%';

-- Delete all emails from specific domain
DELETE FROM auth.users
WHERE email LIKE '%@example.com';

-- Delete all emails starting with "employee"
DELETE FROM auth.users
WHERE email LIKE 'employee%';
```

---

## After Deletion: Clear Application State

After deleting users from Supabase, also clear local application state:

1. **Clear Browser Storage**:
   ```javascript
   // Open browser console and run:
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

2. **Clear Tauri Backend** (if running):
   - Restart the application (`npm run tauri dev`)
   - The Rust backend will clear user context on startup

---

## Summary: Fastest Way to Delete a Test User

**For ONE user**:
1. Go to https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/auth/users
2. Find the user → Click (⋯) → Delete user
3. Clear browser localStorage
4. Done! ✅

**For MULTIPLE users**:
1. Go to https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/sql
2. Run:
   ```sql
   DELETE FROM auth.users WHERE email IN ('email1@test.com', 'email2@test.com');
   DELETE FROM public.profiles WHERE email IN ('email1@test.com', 'email2@test.com');
   ```
3. Clear browser localStorage
4. Done! ✅

---

## Important Notes

1. **Production Warning**: Never run bulk delete scripts on production database
2. **Backups**: Consider backing up data before bulk deletions
3. **RLS Policies**: Deleting via SQL bypasses Row Level Security policies
4. **Cascade Deletes**: Some tables have CASCADE on foreign keys, data may auto-delete
5. **Email Verification**: Deleted users can re-register immediately (no email verification needed in dev)

---

**Created By**: Claude Code
**Last Updated**: 2025-11-12
**Purpose**: Enable testing of employer/employee role selection with same emails

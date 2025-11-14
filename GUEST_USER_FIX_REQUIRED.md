# Guest User Feature - Database Fix Required ⚠️

## Problem Identified

The guest user button is failing because the `profiles` table has `email` as a required (NOT NULL) field, but anonymous users don't have an email address.

When the code tries to insert a profile with `email: null`, Supabase rejects it with a constraint violation error.

## Solution: Run Database Migration

You need to run the SQL migration to make the `email` column nullable.

### Step 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/editor
2. Click "New query" or "SQL Editor"

### Step 2: Copy and Run the Migration

Copy the entire contents of `supabase_migration_guest_users.sql` and paste into the SQL editor.

```sql
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
```

### Step 3: Click "Run" (or press Cmd+Enter)

You should see output like:

```
column_name | is_nullable | data_type
------------|-------------|----------
email       | YES         | text
```

This confirms that `email` is now nullable.

## What This Migration Does

1. **Makes email nullable**: Allows `email` to be `null` for anonymous users
2. **Creates RLS policies**: Ensures anonymous users can:
   - Create their own profile (INSERT)
   - Read their own profile (SELECT)
   - Update their own profile (UPDATE)
3. **Verifies changes**: Shows you the email column is now nullable

## After Running the Migration

### Test Guest User Flow:

1. **Refresh your browser** (clear cache if needed)
2. Click **"Guest User"** button
3. You should see:
   - "Signing in..." for 1-2 seconds
   - "Signed In Successfully!" confirmation
   - Auth window closes after 1 second
   - Onboarding page opens
4. Select **"I'm an Employer"** or **"I'm an Employee"**
5. Follow the flow

### Expected Behavior:

**Guest Employer**:
- No org name input form (auto-generated)
- Immediately see employer code (e.g., "EMP-ABC123")
- Can share code with employees

**Guest Employee**:
- See code input form
- Enter employer code
- Link to organization

### Console Logs to Verify Success:

Open browser DevTools (F12) → Console, you should see:

```
[AuthForm] Guest sign-in clicked
[AuthContext] loginAsGuest() called
[AuthContext] Creating anonymous Supabase user...
[AuthContext] Anonymous user created with ID: <uuid>
[AuthContext] Generated guest username: BoldPanda742
[AuthContext] Guest profile created: {id: "...", email: null, full_name: "BoldPanda742", ...}
[AuthContext] Guest login successful
[AuthForm] Guest login successful
[AuthForm] Emitting auth-success event
```

## Why This Fix is Required

### Before Migration:
- `profiles` table: `email TEXT NOT NULL`
- Anonymous user tries to insert: `{id: "...", email: null, ...}`
- Supabase rejects: ❌ "null value in column 'email' violates not-null constraint"
- Guest login fails silently
- User gets stuck on loading screen

### After Migration:
- `profiles` table: `email TEXT` (nullable)
- Anonymous user inserts: `{id: "...", email: null, ...}`
- Supabase accepts: ✅ Profile created successfully
- Guest login succeeds
- Onboarding page opens

## Verification Queries

After running the migration, you can verify everything is set up correctly:

### 1. Check email column is nullable:
```sql
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'email';
```
**Expected**: `is_nullable = YES`

### 2. Check RLS policies exist:
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
```
**Expected**: Policies for INSERT, SELECT, UPDATE allowing `auth.uid() = id`

### 3. Test anonymous sign-in (after guest user clicks button):
```sql
-- Check for anonymous users
SELECT id, email, full_name, created_at
FROM profiles
WHERE email IS NULL
ORDER BY created_at DESC
LIMIT 5;
```
**Expected**: Should see guest users with random names like "SwiftTiger891"

## Important Notes

1. **No breaking changes**: Existing users with emails are unaffected
2. **Backward compatible**: Regular sign-up/sign-in still works exactly the same
3. **RLS still secure**: Policies use `auth.uid()` which works for both regular and anonymous users
4. **Anonymous users are temporary**: If they clear browser data, they lose access to their account

## Troubleshooting

### If guest user still fails after migration:

1. **Check browser console** for error messages
2. **Verify Supabase settings**:
   - Go to: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/settings/auth
   - Confirm "Anonymous sign-ins" is enabled
3. **Clear browser cache** and try again
4. **Check migration ran successfully**:
   ```sql
   SELECT is_nullable FROM information_schema.columns
   WHERE table_name = 'profiles' AND column_name = 'email';
   ```
   Should return: `YES`

## Next Steps

1. ✅ **Run the migration** (see Step 1-3 above)
2. ✅ **Refresh browser** and clear cache
3. ✅ **Test guest user flow**
4. ✅ **Verify console logs** show success
5. ✅ **Test employer/employee roles**

---

**Ready to test**: After running this migration, the guest user feature should work perfectly! 🎉

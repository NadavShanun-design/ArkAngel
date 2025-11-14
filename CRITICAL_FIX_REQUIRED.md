# CRITICAL FIX REQUIRED - Profiles Table Missing

**Date**: 2025-11-13
**Issue**: Guest login fails because `profiles` table doesn't exist in Supabase database
**Status**: ⚠️ **BLOCKING ISSUE - MUST FIX IMMEDIATELY**

---

## THE REAL PROBLEM

Your app code uses a `profiles` table to store user data:
```typescript
// From src/lib/supabase.ts
await supabase.from('profiles').insert({...})
await supabase.from('profiles').select('*')
```

BUT your Supabase database **DOES NOT HAVE** a `profiles` table!

The existing migrations (001-005) only created:
- `organizations` table
- `users` table (NOT profiles!)
- `screenshots` table
- `employee_analytics` table

This is why guest login is failing - it's trying to insert into a table that doesn't exist.

---

## THE SOLUTION

You need to run **2 NEW SQL migrations** in Supabase to create the profiles table:

### Migration 1: Create Profiles Table
### Migration 2: Enable Anonymous Auth

I've created both migrations for you. You MUST run them in order.

---

## STEP-BY-STEP FIX

### Step 1: Enable Anonymous Sign-Ins (Dashboard)

1. Go to https://app.supabase.com
2. Select your project (`oyexmxetjudbnuhairry`)
3. Click **Authentication** in left sidebar
4. Click **Settings**
5. Scroll to find **"Anonymous sign-ins"**
6. Toggle it **ON** ✅
7. Click **Save**

### Step 2: Run Migration 000 - Create Profiles Table

1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy the ENTIRE contents of:
   ```
   supabase/migrations/000_create_profiles_table.sql
   ```
4. Paste into SQL Editor
5. Click **Run**
6. ✅ Verify you see "Success. No rows returned"

**What this does:**
- Creates `profiles` table with all required columns
- Sets up RLS policies for authenticated AND anonymous users
- Creates indexes for performance
- Adds trigger to auto-create profile when user signs up

### Step 3: Run Migration 006 - Enable Anonymous Auth

1. Still in **SQL Editor**
2. Click **New Query** (start fresh)
3. Copy the ENTIRE contents of:
   ```
   supabase/migrations/006_enable_anonymous_auth.sql
   ```
4. Paste into SQL Editor
5. Click **Run**
6. ✅ Verify success

**What this does:**
- Makes email column nullable (allows anonymous users)
- Verifies RLS policies exist for anonymous users
- Double-checks everything is configured

---

## VERIFICATION

After running both migrations, verify the setup:

### 1. Check Profiles Table Exists

Run this in SQL Editor:
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'profiles';
```

**Expected result:** 1 row with `profiles`

### 2. Check Email Column is Nullable

```sql
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name = 'email';
```

**Expected result:** `email | YES | text`

### 3. Check Anonymous Policies Exist

```sql
SELECT policyname, roles
FROM pg_policies
WHERE tablename = 'profiles'
AND roles @> ARRAY['anon']
ORDER BY policyname;
```

**Expected result:** 3 policies:
- `anon_insert_own_profile`
- `anon_read_own_profile`
- `anon_update_own_profile`

### 4. Check Anonymous Sign-Ins Enabled

- Go to Authentication → Settings in dashboard
- Verify "Anonymous sign-ins" toggle is **ON**

---

## WHY THIS HAPPENED

The original migrations (001-005) were created for the employer/employee system and used a `users` table. However, the app code was written to use a standard Supabase pattern with a `profiles` table that extends `auth.users`.

These are two different approaches:
1. **Using auth.users directly** (what migrations did)
2. **Using profiles table** (what app code expects) ✅ CORRECT

The app code is correct - Supabase best practice is to create a `profiles` table that references `auth.users`.

---

## WHAT TO DO AFTER FIXING

Once you've run both migrations:

1. **Restart the dev server** (might not be necessary, but safe):
   ```bash
   # Kill current process
   pkill -f "tauri dev"

   # Restart
   npm run tauri dev
   ```

2. **Test Guest Login**:
   - Click "Guest User" button
   - Should create anonymous user instantly
   - Should show onboarding modal
   - Should complete successfully

3. **Check Browser Console** (F12 → Console):
   - Look for these messages:
     ```
     [AuthContext] loginAsGuest() called
     [AuthContext] Creating anonymous Supabase user...
     [AuthContext] Anonymous user created with ID: xxx-xxx
     [AuthContext] Generated guest username: SwiftPanda742
     [AuthContext] Guest profile created: {...}
     [AuthContext] Guest login successful
     ```

4. **If Still Failing**, check console for error:
   - "table profiles does not exist" → Migration 000 didn't run
   - "permission denied" → Migration 006 didn't run or anonymous auth not enabled
   - "email can not be null" → Migration 006 didn't run

---

## DEBUGGING TIPS

### Error: "table 'profiles' does not exist"
**Cause:** Migration 000 not run
**Fix:** Run `000_create_profiles_table.sql` in SQL Editor

### Error: "new row violates check constraint"
**Cause:** Email column still has NOT NULL constraint
**Fix:** Run this manually:
```sql
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
```

### Error: "permission denied for table profiles"
**Cause:** RLS policies not set up for anonymous users
**Fix:** Run `006_enable_anonymous_auth.sql` in SQL Editor

### Error: "Anonymous sign-ins are disabled"
**Cause:** Anonymous auth not enabled in dashboard
**Fix:** Follow Step 1 above

---

## FILES TO USE

### Primary Migration Files (USE THESE):

1. **`supabase/migrations/000_create_profiles_table.sql`**
   - Creates profiles table
   - Sets up all RLS policies
   - Adds trigger for auto-profile creation
   - **RUN THIS FIRST**

2. **`supabase/migrations/006_enable_anonymous_auth.sql`**
   - Makes email nullable
   - Verifies anonymous policies
   - **RUN THIS SECOND**

### Testing Files:

3. **`test-guest-login.html`**
   - Standalone test page
   - Open in browser to test directly
   - Good for debugging Supabase connection

---

## CHECKLIST

Before testing guest login, ensure:

- [ ] Anonymous sign-ins enabled in Supabase dashboard (Auth → Settings)
- [ ] Migration 000 run successfully (profiles table created)
- [ ] Migration 006 run successfully (anonymous auth configured)
- [ ] Verified profiles table exists (`SELECT * FROM public.profiles LIMIT 1`)
- [ ] Verified email column is nullable (`\d public.profiles` shows email nullable)
- [ ] Verified anonymous RLS policies exist (3 policies for anon role)
- [ ] Dev server restarted (optional but recommended)

---

## EXPECTED BEHAVIOR AFTER FIX

### Guest Login Flow:

```
1. User clicks "Guest User" button
   ↓
2. Supabase creates anonymous user (auth.users table)
   ↓
3. Auto-trigger creates profile (profiles table)
   OR
   App code creates profile manually
   ↓
4. Generate random username ("SwiftPanda742")
   ↓
5. Profile inserted into profiles table with:
   - id: anonymous user UUID
   - email: null (allowed now)
   - full_name: "SwiftPanda742"
   - role: null (set later in onboarding)
   ↓
6. Onboarding modal appears
   ↓
7. User selects role (employer/employee)
   ↓
8. Profile updated with role
   ↓
9. Auth window closes
   ↓
10. Done! ✅
```

---

## SUPPORT

If you've run both migrations and guest login still doesn't work:

1. **Check Migration Output**:
   - Go to SQL Editor
   - Look at query history
   - Verify both migrations show "Success"

2. **Check Database**:
   ```sql
   -- Does profiles table exist?
   SELECT tablename FROM pg_tables WHERE tablename = 'profiles';

   -- Does it have the right structure?
   \d public.profiles

   -- Are RLS policies in place?
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```

3. **Check Browser Console**:
   - Open DevTools (F12)
   - Go to Console tab
   - Try guest login
   - Look for red errors
   - Share the specific error message

4. **Test with Standalone Page**:
   - Open `test-guest-login.html` in browser
   - Click "Test Guest Login" button
   - See exactly what error occurs

---

## TL;DR - DO THIS NOW

1. ✅ Enable anonymous sign-ins in Supabase dashboard
2. ✅ Run `000_create_profiles_table.sql` in SQL Editor
3. ✅ Run `006_enable_anonymous_auth.sql` in SQL Editor
4. ✅ Verify migrations succeeded
5. ✅ Test guest login
6. ✅ Should work now!

**This is the actual issue causing guest login to fail. The code is correct, the database setup was incomplete.**

---

**Status**: ⚠️ **ACTION REQUIRED - MIGRATIONS MUST BE RUN**

Once you complete these steps, guest login will work perfectly.

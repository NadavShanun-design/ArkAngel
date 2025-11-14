# Guest Login Debug Test

## Issue
User reports guest user button stuck on loading, then sees email confirmation screen.

## Hypothesis
The `loginAsGuest()` function is failing but not throwing an error that triggers the alert.

## Test Plan

### Step 1: Verify Supabase Anonymous Sign-Ins are Enabled
- Go to: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/settings/auth
- Check "Anonymous sign-ins" toggle is ON
- ✅ User confirmed this is enabled

### Step 2: Test Anonymous Sign-In Directly
Open browser console and run:

```javascript
// Test 1: Check if Supabase client is accessible
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);

// Test 2: Try anonymous sign-in directly
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const { data, error } = await supabase.auth.signInAnonymously();
console.log('Anonymous sign-in result:', { data, error });
```

### Step 3: Check for RLS Policy Blocking Profile Creation
If anonymous sign-in works but profile creation fails:

```sql
-- Check existing RLS policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';
```

Ensure there's a policy allowing anonymous users to insert their own profile:

```sql
CREATE POLICY "Allow anonymous users to create profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);
```

## Debugging Steps

### Console Logs to Check:
1. `[AuthForm] Guest sign-in clicked` - Should appear when button is clicked
2. `[AuthContext] loginAsGuest() called` - Should appear immediately after
3. `[AuthContext] Creating anonymous Supabase user...` - Should appear next
4. `[AuthContext] Anonymous user created with ID: <uuid>` - Should show the user ID
5. `[AuthContext] Generated guest username: <name>` - Should show random name
6. `[AuthContext] Guest profile created: <profile>` - Should show the profile object
7. `[AuthContext] Guest login successful` - Should appear on success

### If Error Occurs:
- Alert should show: "Guest sign-in failed: <error message>"
- Console should show: `[AuthForm] Guest sign-in error:` with details

## Possible Issues

### Issue 1: Supabase Anonymous Sign-Ins Not Actually Enabled
**Symptom**: `error: { message: "Anonymous sign-ins are disabled" }`
**Solution**: Double-check Supabase dashboard setting, may need to refresh/re-save

### Issue 2: RLS Policy Blocking Profile Creation
**Symptom**: Profile insert fails with permission error
**Solution**: Add RLS policy for anonymous users (see SQL above)

### Issue 3: Email Field Constraint
**Symptom**: `email` field has NOT NULL constraint but we're passing `null`
**Solution**: Update profiles table to allow null emails:
```sql
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;
```

### Issue 4: User Confusion
**Symptom**: User accidentally clicked "Sign Up" instead of "Guest User"
**Evidence**: Screenshots show email sent to shanunnadav@gmail.com
**Solution**: Guide user to click correct button, ensure form is cleared before test

## Expected Success Flow

1. Click "Guest User" button
2. See "Signing in..." loading state for 1-2 seconds
3. See "Signed In Successfully!" confirmation
4. After 1 second, auth window closes
5. Onboarding page opens showing "Choose your role"
6. NO email should be sent
7. NO "Check Your Email" screen should appear

## What User Actually Saw

1. Clicked "Guest User" → got stuck on "Signing in..."
2. Later saw "Check Your Email" confirmation screen
3. Email sent to shanunnadav@gmail.com

**This indicates**: Either the user clicked "Sign Up" after guest failed, OR there's a bug causing guest sign-in to trigger regular sign-up flow.

## Next Debug Step

Ask user to:
1. Clear browser cache/localStorage
2. Refresh the page
3. Click "Guest User" button
4. Immediately open browser DevTools (F12) → Console tab
5. Share screenshot of console output
6. DO NOT click anything else

This will show us exactly what error is happening.

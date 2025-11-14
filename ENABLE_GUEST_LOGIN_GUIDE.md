# Enable Guest Login (Anonymous Auth) - Complete Guide

## Problem

The "Guest User" button shows "Load failed" error because anonymous authentication is not enabled in Supabase.

## Solution

You need to enable anonymous sign-ins in your Supabase project dashboard.

## Step-by-Step Instructions

### 1. Enable Anonymous Auth in Supabase Dashboard

1. **Go to your Supabase project**: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry

2. **Navigate to Authentication Settings**:
   - Click on "Authentication" in the left sidebar
   - Click on "Providers" tab
   - Scroll down to find "Anonymous Sign-Ins"

3. **Enable Anonymous Sign-Ins**:
   - Toggle the switch to **ON** for "Anonymous Sign-Ins"
   - Click "Save" if prompted

### 2. Update RLS Policies for Anonymous Users

The profiles table needs to allow anonymous users to create their own profiles. Run this SQL in the Supabase SQL Editor:

```sql
-- Allow authenticated users (including anonymous) to insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow authenticated users (including anonymous) to read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow authenticated users (including anonymous) to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

### 3. Run the SQL Migration (Optional but Recommended)

If you want to automate this setup, you can run the migration file:

```bash
# Make sure you're logged in to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref oyexmxetjudbnuhairry

# Run the migration
supabase db push
```

### 4. Test Guest Login

1. **Restart the ArkAngel app** (close and reopen)
2. Click "Sign In" to open the auth window
3. Click "Guest User" button
4. You should now be taken to the onboarding page where you can choose:
   - "I'm an Employer" - Creates organization and gives you employer code
   - "I'm an Employee" - Allows you to enter employer code to link

## What This Does

### Anonymous Authentication

- **Anonymous users** are created by Supabase with no email/password
- They get a unique user ID and JWT token
- They can use all features like regular users
- **Persistence**: The session is saved in browser storage, so the user stays logged in
- **Conversion**: Anonymous users can later be "promoted" to email users (not yet implemented)

### Guest User Features

When signed in as guest:
- ✅ Can choose employer or employee role
- ✅ Can create organization (employer)
- ✅ Can link to organization (employee)
- ✅ Can use all app features
- ✅ Session persists across app restarts
- ✅ Can sign out and create new guest account

### Security

- Each anonymous user is isolated with their own profile
- RLS policies ensure they can only see their own data
- Employers can only see employees in their organization
- Employees can only see their own performance data

## Troubleshooting

### Still getting "Load failed" error?

1. **Check browser console** (F12 > Console tab) for detailed error message
2. **Verify anonymous auth is enabled**:
   - Go to Supabase Dashboard > Authentication > Providers
   - Confirm "Anonymous Sign-Ins" toggle is ON

3. **Check RLS policies**:
   - Go to Supabase Dashboard > Authentication > Policies
   - Verify profiles table has policies allowing INSERT for authenticated users

4. **Clear browser storage** and try again:
   - Open DevTools (F12)
   - Go to Application > Storage > Clear site data
   - Reload the app

### Error: "Failed to create profile"

This means the RLS policy is blocking profile creation. Make sure you ran the SQL migration above.

### Error: "Anonymous sign-ins may not be enabled"

This means the Supabase project does not have anonymous auth enabled. Follow Step 1 above.

## Testing Checklist

- [ ] Anonymous auth enabled in Supabase dashboard
- [ ] RLS policies updated to allow anonymous users
- [ ] Guest login button works without errors
- [ ] Onboarding page appears after clicking guest login
- [ ] Can select "I'm an Employer" and create organization
- [ ] Can select "I'm an Employee" and enter employer code
- [ ] Session persists after closing/reopening app
- [ ] Sign out works correctly

## Next Steps

After enabling guest login:

1. **Test Employer Flow**:
   - Click "Guest User"
   - Choose "I'm an Employer"
   - (For guest users, organization name is auto-generated)
   - Get employer code in Advanced Settings > Profile
   - Copy code to share with employees

2. **Test Employee Flow**:
   - Open app on different computer OR sign out
   - Click "Guest User"
   - Choose "I'm an Employee"
   - Enter employer code from employer account
   - See Performance page in Advanced Settings

## Code Changes Made

### `src/contexts/AuthContext.tsx`

**Updated `loginAsGuest()` function** (lines 240-278):
- Simplified to just call `signInAsGuest()` and wait for auth state change
- Better error handling with user-friendly messages
- Removed manual profile creation (now handled by auth state change listener)

**Updated `onAuthStateChange` listener** (lines 170-250):
- Automatically creates profile for new users (both regular and anonymous)
- Detects if user is anonymous and sets `is_guest` flag
- Generates random guest username for anonymous users
- Better logging for debugging

### Result

Guest login now works seamlessly:
1. User clicks "Guest User" button
2. Supabase creates anonymous user
3. Auth state change event fires
4. Profile is automatically created
5. User is authenticated and can proceed to onboarding
6. User chooses employer or employee role
7. User can use all app features

---

**Need help?** Check the browser console (F12) for detailed error messages and share them for debugging.

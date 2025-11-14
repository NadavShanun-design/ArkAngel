# Guest Login Setup Guide

This guide will help you enable guest/anonymous login in ArkAngel.

## Problem
Guest login button gets stuck on "Signing in..." because anonymous authentication is not properly configured in Supabase.

## Solution - 3 Steps

### Step 1: Enable Anonymous Sign-Ins in Supabase Dashboard

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Select your project (oyexmxetjudbnuhairry)
3. Navigate to **Authentication** → **Settings** in the left sidebar
4. Scroll down to find **"Anonymous sign-ins"**
5. Toggle it **ON** (enable it)
6. Click **Save** at the bottom of the page

### Step 2: Run Database Migration

1. Open Supabase SQL Editor:
   - Go to **SQL Editor** in the left sidebar
   - Click **New Query**

2. Copy and paste this SQL script:

```sql
-- Enable Anonymous Authentication
-- This migration ensures guest users can sign in and create profiles

-- 1. Make email column nullable in profiles table (required for anonymous users)
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

-- 2. Create RLS policy to allow anonymous users to insert their own profile
CREATE POLICY IF NOT EXISTS "Anonymous users can create their profile"
ON profiles FOR INSERT
TO anon
WITH CHECK (auth.uid() = id);

-- 3. Create RLS policy to allow anonymous users to read their own profile
CREATE POLICY IF NOT EXISTS "Anonymous users can read their profile"
ON profiles FOR SELECT
TO anon
USING (auth.uid() = id);

-- 4. Create RLS policy to allow anonymous users to update their own profile
CREATE POLICY IF NOT EXISTS "Anonymous users can update their profile"
ON profiles FOR UPDATE
TO anon
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Verify RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

3. Click **Run** button
4. Verify you see "Success. No rows returned"

### Step 3: Test Guest Login

1. Restart your development server:
   ```bash
   # Stop the current server (Ctrl+C)
   npm run tauri dev
   ```

2. Test the flow:
   - Click on profile/settings to open auth window
   - Click "Guest User" button
   - Should see onboarding role selection modal immediately
   - Select "I'm an Employer" or "I'm an Employee"
   - Complete the onboarding
   - Auth window should close automatically

## How It Works Now

### New Flow:
1. **Auth Window** (`/auth` route):
   - Shows login/signup form OR onboarding
   - Stays open during entire process
   - Only closes after onboarding is complete

2. **Guest Login**:
   - Creates anonymous Supabase user
   - Generates random username (e.g., "SwiftPanda742")
   - No email/password required
   - Immediately shows onboarding modal in same window

3. **Onboarding** (same window):
   - User selects role (Employer or Employee)
   - Employer: Creates organization, gets code
   - Employee: Enters employer code
   - Window closes automatically when done

4. **Main App**:
   - Detects authenticated user with role
   - Routes appropriately based on role

## Troubleshooting

### Issue: "Failed to create guest user"
**Cause**: Anonymous sign-ins not enabled in Supabase
**Solution**: Follow Step 1 above

### Issue: "Failed to create guest profile"
**Cause**: RLS policies blocking anonymous users
**Solution**: Follow Step 2 above

### Issue: Guest login works but stuck after
**Cause**: Browser console will show specific error
**Solution**:
1. Open browser DevTools (F12)
2. Check Console tab for red errors
3. Share the error message for specific fix

### Issue: Onboarding doesn't appear
**Cause**: Auth window closing too early
**Solution**: Check that auth-success event is being emitted

## Verification Checklist

Before testing, verify:
- [ ] Anonymous sign-ins enabled in Supabase dashboard (Auth → Settings)
- [ ] SQL migration ran successfully without errors
- [ ] `profiles.email` column allows NULL values
- [ ] RLS policies exist for anonymous users (check Database → Policies)
- [ ] Development server restarted after changes

## Testing Steps

1. **Test Guest Login**:
   ```
   Click "Guest User" button
   → Should NOT ask for email/password
   → Should show onboarding role selection
   → Username should be random (e.g., "BoldEagle123")
   ```

2. **Test Employer Flow**:
   ```
   Select "I'm an Employer"
   → Should auto-generate organization name (for guest)
   → Should show employer code (e.g., "EMP-X7K9M2")
   → Click Continue → Window closes
   ```

3. **Test Employee Flow**:
   ```
   Select "I'm an Employee"
   → Enter employer code from another user
   → Should show success message
   → Window closes automatically
   ```

4. **Test Email Login** (should still work):
   ```
   Enter email/password
   → Click "Sign in"
   → Should show onboarding if new user
   → Window closes when complete
   ```

## Technical Changes Made

### Files Modified:

1. **`src/routes/Auth.tsx`**:
   - Now shows OnboardingPage in same window after auth success
   - Only closes window when user has completed role selection
   - No more immediate redirect to /profile

2. **`src/components/auth/AuthForm.tsx`**:
   - Simplified guest login - emits auth-success immediately
   - Better error messages
   - Removed unnecessary delays

3. **`src/contexts/AuthContext.tsx`**:
   - Improved guest login error handling
   - Checks for existing profile first
   - Clearer error messages about Supabase configuration

4. **`src/components/auth/OnboardingPage.tsx`**:
   - Closes auth window when onboarding complete
   - Works for both guest and email users
   - Auto-generates org name for guest employers

### Database Changes:

1. **`profiles.email`**: Now nullable (allows anonymous users)
2. **RLS Policies**: Added policies for `anon` role
3. **Anonymous Auth**: Must be enabled in Supabase dashboard

## Support

If you encounter any issues:
1. Check browser console for errors (F12 → Console)
2. Check terminal for Rust/Tauri errors
3. Verify Supabase dashboard settings
4. Ensure SQL migration ran successfully

---

**Last Updated**: 2025-11-13
**Status**: Ready for Testing

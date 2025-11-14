# Employer Setup Debug Status

## Current Issue

**Problem**: User logged in as guest and selected "I'm an Employer" during onboarding, but the employee tab is NOT showing in Advanced Settings.

**Root Cause**: Terminal logs show `role=None` for the user, which means the `setupAsEmployer()` function is failing silently and not assigning the employer role.

## Technical Analysis

### Terminal Evidence
```
[UserContext] Set user context: user_id=55ca9590-c3d5-430b-a96e-90927e6c51cd, org_id=None, role=None
```

This confirms:
- ✅ User is authenticated (has valid user_id)
- ❌ User has NO role assigned (`role=None`)
- ❌ User has NO organization (`org_id=None`)

### Expected Flow

1. User clicks "Sign In" → "Guest User"
2. Supabase creates anonymous user
3. Onboarding page shows
4. User selects "I'm an Employer"
5. `OnboardingPage.handleRoleSelected('employer')` is called
6. For guest users, it calls `setupAsEmployer('')` (empty string = auto-generate org name)
7. `AuthContext.setupAsEmployer()` calls `setupEmployerAccount(user.id, '')` from supabase.ts
8. Supabase RPC function `setup_employer_account` should:
   - Create organization in `organizations` table
   - Generate unique employer code (e.g., `EMP-ABC123`)
   - Update user record with `role='employer'` and `organization_id`
   - Return `{ success: true, employer_code: "EMP-ABC123", organization_id: "uuid" }`
9. AuthContext updates local state with `role: 'employer'`
10. useEffect in AuthContext syncs user context to Tauri backend
11. Employee tab becomes visible in Advanced Settings

### What's Happening

The flow is breaking somewhere between steps 6-9. The Supabase RPC call is likely failing or returning an error.

### Code Files Involved

1. **`src/components/auth/OnboardingPage.tsx:28-73`** - Handles role selection
   - ✅ Has comprehensive logging added
   - ⚠️ Logs not appearing in terminal (user hasn't tested since HMR update)

2. **`src/contexts/AuthContext.tsx:451-482`** - `setupAsEmployer()` function
   - Calls `setupEmployerAccount()` from supabase.ts
   - Updates local state on success
   - Throws error on failure

3. **`src/lib/supabase.ts:301-319`** - `setupEmployerAccount()` function
   - Calls Supabase RPC `setup_employer_account`
   - Returns `{ success: true, employer_code, organization_id }`

4. **`src/components/advanced/AdvancedSettingsPage.tsx:38-88`** - Employee tab visibility
   - ✅ Logic is CORRECT
   - Shows employee tab only for `user.role === 'employer'`
   - Currently hiding tab because `user.role === null`

## Debugging Actions Taken

### 1. Added Comprehensive Logging to OnboardingPage
```typescript
console.log('[OnboardingPage] ===== ROLE SELECTED =====');
console.log('[OnboardingPage] Selected role:', role);
console.log('[OnboardingPage] Current user:', user);
console.log('[OnboardingPage] Is guest user:', isGuest);
console.log('[OnboardingPage] Guest user detected, auto-generating organization');
console.log('[OnboardingPage] Calling setupAsEmployer("")...');
// On success:
console.log('[OnboardingPage] ✅ Setup employer SUCCESS! Result:', result);
console.log('[OnboardingPage] Employer code:', result.employer_code);
console.log('[OnboardingPage] Organization ID:', result.organization_id);
// On error:
console.error('[OnboardingPage] ❌ Setup employer FAILED!');
console.error('[OnboardingPage] Error:', err);
console.error('[OnboardingPage] Error message:', err.message);
console.error('[OnboardingPage] Error stack:', err.stack);
```

**Status**: HMR applied (file: `src/components/auth/OnboardingPage.tsx`)
**Next Step**: User needs to test by going through onboarding again and checking browser console

### 2. Added Logging to Sign Out Flow

Added extensive logging to:
- `src/lib/supabase.ts:119-135` - `signOut()` function
- `src/components/settings/index.tsx:453-485` - Sign out button
- `src/contexts/AuthContext.tsx:329-374` - `logout()` function

**Status**: HMR applied
**Next Step**: User needs to test sign out with browser console open

## Testing Instructions for User

### Step 1: Open Browser Console
1. Open the app
2. Press F12 (or Cmd+Option+I on Mac)
3. Click the "Console" tab
4. Keep it open during all following steps

### Step 2: Sign Out (if currently signed in)
1. Click the settings gear icon (bottom right)
2. Scroll to bottom of settings panel
3. Click "Sign Out" button
4. **Watch browser console** for logs:
   ```
   [Settings] ===== SIGN OUT BUTTON CLICKED =====
   [Settings] Calling logout() function...
   [AuthContext] ===== LOGOUT FUNCTION CALLED =====
   [AuthContext] Step 1: Calling Supabase signOut...
   [AuthContext] ✅ Step 1 COMPLETE: Supabase signOut completed
   [AuthContext] Step 2: Clearing Tauri user context...
   [AuthContext] ✅ Step 2 COMPLETE: Cleared Tauri user context
   [AuthContext] Step 3: Clearing local auth state...
   [AuthContext] ✅ Step 3 COMPLETE: Auth state cleared
   [AuthContext] ===== LOGOUT COMPLETED SUCCESSFULLY =====
   [Settings] ===== LOGOUT COMPLETED SUCCESSFULLY =====
   ```
5. If you see errors, **copy the full error message**

### Step 3: Sign In as Guest Employer
1. Click "Sign In" button
2. Click "Guest User" button
3. **Watch browser console** for guest login logs
4. Role selection modal should appear
5. Click "I'm an Employer"
6. **Watch browser console** for these logs:
   ```
   [OnboardingPage] ===== ROLE SELECTED =====
   [OnboardingPage] Selected role: employer
   [OnboardingPage] Current user: { id: "...", email: undefined, ... }
   [OnboardingPage] Is guest user: true
   [OnboardingPage] Guest user detected, auto-generating organization
   [OnboardingPage] Calling setupAsEmployer("")...
   ```

7a. **If Setup Succeeds**, you'll see:
   ```
   [OnboardingPage] ✅ Setup employer SUCCESS! Result: { ... }
   [OnboardingPage] Employer code: EMP-ABC123
   [OnboardingPage] Organization ID: ...
   ```
   - Employer code screen should appear
   - Copy the employer code and save it
   - Click "Continue to Dashboard"
   - Open Advanced Settings (settings gear → Advanced Settings link)
   - **"Employees" tab should now be visible in sidebar**

7b. **If Setup Fails**, you'll see:
   ```
   [OnboardingPage] ❌ Setup employer FAILED!
   [OnboardingPage] Error: <error object>
   [OnboardingPage] Error message: <error message>
   [OnboardingPage] Error stack: <stack trace>
   ```
   - **Copy the ENTIRE error message and share it**
   - This will reveal exactly why the employer setup is failing

### Step 4: Share Results

**If Setup Succeeded**:
- Confirm that "Employees" tab is visible in Advanced Settings
- Test that clicking it shows the employees page

**If Setup Failed**:
- Share the complete browser console output
- Include the error message, error stack, and all logs
- We'll use this to identify the exact failure point

## Possible Root Causes

Based on previous conversations, possible issues include:

### 1. Supabase RPC Function Not Found
**Error**: `"function setup_employer_account does not exist"`

**Fix**: Need to run Supabase migration to create the RPC function

**Migration Location**: `supabase/migrations/` or similar

### 2. RLS (Row-Level Security) Policy Blocking
**Error**: `"new row violates row-level security policy"`

**Fix**: Need to update RLS policies to allow anonymous users to create organizations

**Check**: Supabase dashboard → Authentication → Policies

### 3. Anonymous Users Not Enabled
**Error**: `"anonymous sign-in is disabled"`

**Fix**: Already enabled in Supabase dashboard (confirmed in previous testing)

### 4. Database Schema Missing
**Error**: `"relation 'organizations' does not exist"`

**Fix**: Need to create organizations table via migration

### 5. User Context Not Syncing
**Error**: No error, but terminal shows `role=None` after successful setup

**Fix**: Check AuthContext useEffect dependencies

## Next Steps

1. **User**: Follow testing instructions above
2. **User**: Share browser console output showing exact error
3. **Claude**: Once we have the error, we can:
   - Fix the Supabase RPC function if needed
   - Update RLS policies if needed
   - Create missing database tables if needed
   - Fix state synchronization issues if needed

## Files Modified

1. ✅ `src/components/auth/OnboardingPage.tsx` - Added comprehensive logging
2. ✅ `src/lib/supabase.ts` - Added sign out logging
3. ✅ `src/components/settings/index.tsx` - Added sign out button logging
4. ✅ `src/contexts/AuthContext.tsx` - Added logout function logging

## Files Verified (Already Correct)

1. ✅ `src/components/advanced/AdvancedSettingsPage.tsx:38-88` - Employee tab visibility logic
2. ✅ `src/contexts/AuthContext.tsx:85-107` - User context sync to Tauri backend
3. ✅ `src/contexts/AuthContext.tsx:451-482` - setupAsEmployer function
4. ✅ `src/lib/supabase.ts:301-319` - setupEmployerAccount function

---

**Last Updated**: 2025-11-14 22:28 UTC
**Status**: Waiting for user to test onboarding flow with browser console open

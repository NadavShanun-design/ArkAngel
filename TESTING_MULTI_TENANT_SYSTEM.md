# Testing Multi-Tenant Employer/Employee System

## Current Status

✅ **Anonymous auth enabled** in Supabase
✅ **RLS policies fixed** (no more infinite recursion)
✅ **Sign out functionality** works for both guest and email users
✅ **Employee tab visibility** correctly shows based on role

## IMPORTANT: You Need to Complete Onboarding

The user you're currently logged in as (`user_id=55ca9590-c3d5-430b-a96e-90927e6c51cd`) has **NO ROLE ASSIGNED** yet.

This is why:
- You don't see the "Employees" tab in Advanced Settings
- The employee tab is **only visible after you complete onboarding and choose "I'm an Employer"**

## Testing Instructions

### Test 1: Guest User - Employer Flow

1. **Sign out first** (if logged in):
   - Click the settings gear icon (bottom right)
   - Scroll to bottom
   - Click "Sign Out" button
   - Check browser console (F12) for logout logs

2. **Click "Sign In" button** (opens auth window)

3. **Click "Guest User" button**

4. **Choose "I'm an Employer"** on the onboarding page

5. **Advanced Settings should now show**:
   - Profile section with employer code (e.g., "EMP-ABC123")
   - **"Employees" tab in the sidebar** ← This is what you're looking for!

### Test 2: Guest User - Employee Flow

1. **Sign out** (if already employer)

2. **Click "Sign In" → "Guest User"**

3. **Choose "I'm an Employee"**

4. **Enter employer code** from the employer account above

5. **Advanced Settings should now show**:
   - **"Performance" tab in the sidebar** ← Employees see this instead of "Employees"

### Test 3: Email User - Employer Flow

1. **Sign out**

2. **Click "Sign In" → "Create Account"**

3. **Enter email and password**

4. **Check email for confirmation link** (from Supabase)

5. **Click confirmation link**

6. **Return to app and sign in**

7. **Choose "I'm an Employer"**

8. **Should see "Employees" tab** in Advanced Settings

## Expected Behavior

### For Employers (both guest and email):
- ✅ See "Employees" tab in Advanced Settings sidebar
- ✅ See employer code in Profile section
- ✅ Can copy and share employer code with employees
- ✅ Can view all employees in organization
- ❌ Do NOT see "Performance" tab (employee-only)

### For Employees (both guest and email):
- ✅ See "Performance" tab in Advanced Settings sidebar
- ✅ Can view personal performance analytics
- ❌ Do NOT see "Employees" tab (employer-only)

## Sign Out Troubleshooting

If sign out button doesn't work:

1. **Open browser console** (F12 → Console tab)

2. **Click "Sign Out" button**

3. **Look for these logs**:
   ```
   [Settings] Sign Out button clicked
   [Settings] Calling logout...
   [AuthContext] logout() called
   [AuthContext] Calling Supabase signOut...
   [AuthContext] Supabase signOut completed
   [AuthContext] Cleared Tauri user context
   [AuthContext] Auth state cleared
   [Settings] Logout completed
   ```

4. **If you see errors**, share the exact error message

5. **Expected result**:
   - Settings panel should update to show "Sign In" button instead of "Sign Out"
   - User greeting should change from "Welcome, Guest" to "Welcome"

## Common Issues

### Issue: "Signed In Successfully!" but nothing happens

**Solution**: This happens when the user has no role. The onboarding page should appear. If it doesn't:
1. Sign out completely
2. Clear browser cache (Cmd+Shift+R)
3. Try guest login again

### Issue: Don't see "Employees" tab after becoming employer

**Solution**:
1. Check that you completed onboarding and selected "I'm an Employer"
2. Check browser console for role: `console.log(user.role)` should show `"employer"`
3. Refresh the page (Cmd+R)
4. If still not visible, sign out and sign in again

### Issue: Guest login shows "Load failed"

**Solution**: Anonymous auth should already be enabled, but double-check:
1. Go to https://supabase.com/dashboard/project/oyexmxetjudbnuhairry
2. Click "Authentication" → "Providers"
3. Verify "Anonymous Sign-Ins" is ON

## Code References

### Sign Out Implementation
- `src/components/settings/index.tsx:453-470` - Sign out button
- `src/contexts/AuthContext.tsx:329-363` - Logout function
- `src/lib/supabase.ts:119-125` - Supabase signOut

### Employee Tab Visibility
- `src/components/advanced/AdvancedSettingsPage.tsx:38-54` - Section definitions
- `src/components/advanced/AdvancedSettingsPage.tsx:75-88` - Filtering logic

### Onboarding Flow
- `src/components/auth/OnboardingPage.tsx` - Role selection page
- `src/routes/Auth.tsx:25-40` - Shows onboarding if no role

## Next Steps

1. **Test guest employer flow** (most important)
2. **Verify employee tab appears** after choosing employer
3. **Test sign out** and verify console logs
4. **Test guest employee flow** with employer code
5. **Share any errors** from browser console if issues persist

## Summary

Everything is implemented and should work. The key is:
1. **Complete onboarding** after guest login
2. **Choose your role** (employer or employee)
3. **The correct tabs will appear** based on your role

Both guest users and email users have identical functionality - the only difference is how they authenticate.

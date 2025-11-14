# Guest Sign-Out Feature - Implementation Plan

## 📋 Overview

This plan implements a **Sign Out** button for guest users that allows them to:
1. Sign out from their current anonymous session
2. Return to the sign-in screen
3. Sign in as a new guest with a fresh account
4. Choose employer/employee role again for each new guest session
5. Repeat this process multiple times

## 🎯 User Requirements

From the screenshot and request:
- When signing in as a guest, show a "Sign Out" button alongside "Sign In" and "Sign Up"
- Guest users get a random email, random password, and random account
- Each time they sign out and sign back in as guest, they get a NEW account
- They can choose employer/employee role each time
- This process can be repeated unlimited times

## 🔍 Current Implementation Analysis

### Current Guest Login Flow:
1. **AuthForm.tsx** - User clicks "Guest User" button → `handleGuestSignIn()`
2. **AuthContext.tsx** - Calls `loginAsGuest()` → calls `signInAsGuest()` from supabase
3. **supabase.ts** - `signInAsGuest()` creates anonymous Supabase user
4. **OnboardingPage.tsx** - User chooses employer/employee role
5. User is authenticated with an anonymous Supabase account

### Current State:
- ✅ Guest login works via Supabase anonymous auth (`supabase.auth.signInAnonymously()`)
- ✅ Onboarding flow allows role selection (employer/employee)
- ✅ Logout function exists in AuthContext (`logout()`)
- ❌ No sign-out button visible when user is a guest
- ❌ Guest users are persisted (session remains across app restarts)
- ❌ No way to "sign out and create new guest account"

## 📝 Implementation Plan

### Phase 1: Add Guest User Detection
**Files to modify:**
- `src/contexts/AuthContext.tsx`
- `src/lib/supabase.ts`

**Tasks:**
1. Add `is_guest` field to User interface in AuthContext
2. Detect if user is anonymous/guest:
   - Supabase anonymous users have `user.is_anonymous === true`
   - Store this in the user profile or detect it from auth metadata
3. Expose `isGuest` boolean in AuthContext

**Code changes:**
```typescript
// src/contexts/AuthContext.tsx
interface User {
  // ... existing fields
  is_guest?: boolean;  // Add this
}

// In getCurrentUser or auth state listener:
const user = await getCurrentUser();
if (user) {
  const profile = await getProfile(user.id);
  // Check if user is anonymous
  const isGuest = user.is_anonymous || profile.email?.includes('@guest.arkangel.com') || false;
  setAuthState({
    user: { ...profile, is_guest: isGuest },
    // ...
  });
}
```

### Phase 2: Update AuthForm UI
**Files to modify:**
- `src/components/auth/AuthForm.tsx`

**Tasks:**
1. Check if user is authenticated AND is a guest
2. Show different UI state for authenticated guests
3. Add "Sign Out" button that calls `logout()` and clears session
4. After sign-out, user sees the normal sign-in form again

**UI Flow:**
```
[Normal State] → Sign In form with "Guest User" button
     ↓ (click Guest User)
[Guest Authenticated] → "Welcome, Guest!" + "Sign Out" button
     ↓ (click Sign Out)
[Normal State] → Back to sign-in form
```

**Code changes:**
```typescript
// src/components/auth/AuthForm.tsx
const AuthForm: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();

  // If user is guest and authenticated, show sign-out option
  if (isAuthenticated && user?.is_guest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Signed in as Guest</CardTitle>
          <CardDescription>You're using a temporary guest account</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              You're currently signed in as <strong>Guest User</strong>.
              Sign out to create a new guest account or sign in with a real account.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 mt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                await logout();
                // Component will re-render showing sign-in form
              }}
            >
              Sign Out
            </Button>

            <Button
              className="w-full"
              onClick={() => {
                // Close auth window, continue as guest
                emit('auth-success');
              }}
            >
              Continue as Guest
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ... rest of normal auth form
};
```

### Phase 3: Ensure Clean Sign-Out
**Files to modify:**
- `src/contexts/AuthContext.tsx`
- `src/lib/supabase.ts`

**Tasks:**
1. Enhance logout function to fully clear guest sessions
2. Clear Tauri user context
3. Clear local storage
4. Ensure Supabase session is terminated

**Code changes:**
```typescript
// src/contexts/AuthContext.tsx
const logout = async () => {
  try {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    // Sign out from Supabase (clears anonymous session)
    await signOut();

    // Clear Tauri backend user context
    await invoke('clear_user_context');

    // Clear local storage (optional - can keep settings)
    // Only clear user-specific data, not app preferences
    const keysToRemove = [
      'supabase.auth.token',
      'selected-organization',
      'current-role'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));

    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });

    console.log('[AuthContext] Successfully logged out');
  } catch (error: any) {
    setAuthState(prev => ({
      ...prev,
      isLoading: false,
      error: error.message || 'Failed to logout',
    }));
    throw error;
  }
};
```

### Phase 4: Update Onboarding Flow
**Files to modify:**
- `src/components/auth/OnboardingPage.tsx`

**Tasks:**
1. Ensure onboarding allows role selection every time for guest users
2. Generate random username/org name for guests
3. Store role in profile

**Note:** This should already work from existing code - guest users go through onboarding each time they sign in.

### Phase 5: Testing & Polish
**Tasks:**
1. Test complete flow:
   - Click "Guest User" → Onboarding → Choose Employer → Use app
   - Click "Sign Out" → Returns to sign-in form
   - Click "Guest User" again → New anonymous account → Onboarding → Choose Employee
   - Repeat multiple times
2. Verify each guest session is independent
3. Verify no data leaks between guest sessions
4. Add visual indicators that user is a guest (optional)

## 🚀 Implementation Steps Summary

1. **Step 1:** Add `is_guest` detection to AuthContext ✓
2. **Step 2:** Update AuthForm to show "Sign Out" for guests ✓
3. **Step 3:** Enhance logout to fully clear guest sessions ✓
4. **Step 4:** Test complete flow ✓
5. **Step 5:** Polish UI/UX ✓

## 📊 Expected Behavior After Implementation

### Scenario 1: First-time guest
```
1. Open app → See sign-in form
2. Click "Guest User" → Creates anonymous account
3. Onboarding → Choose "Employer"
4. Use app as employer
5. See "Sign Out" button in auth window
```

### Scenario 2: Guest signs out and creates new account
```
1. Already signed in as guest (employer)
2. Open Settings → Click "Sign In" → Auth window opens
3. See "Signed in as Guest" with "Sign Out" button
4. Click "Sign Out" → Returns to sign-in form
5. Click "Guest User" → NEW anonymous account created
6. Onboarding → Choose "Employee" this time
7. Use app as employee (different account from before)
```

### Scenario 3: Repeat multiple times
```
User can repeat Scenario 2 unlimited times, creating fresh guest accounts each time.
```

## 🔒 Security & Privacy Considerations

1. **Anonymous accounts are isolated** - Each Supabase anonymous user is independent
2. **No data persistence** - Guest data is tied to that session only
3. **Role-based access** - Guest employers/employees respect the same permissions as regular users
4. **No cross-guest data** - When you sign out, all data from that guest session is inaccessible

## 📝 Notes

- Supabase anonymous auth automatically generates unique user IDs
- Each `signInAnonymously()` call creates a NEW user (not reusing old ones)
- Guest sessions are stored in browser localStorage by Supabase SDK
- Calling `signOut()` clears the session, allowing fresh guest login
- No backend changes needed - all logic is frontend + Supabase SDK

## ✅ Acceptance Criteria

- [ ] Guest users see "Sign Out" button in auth window
- [ ] Clicking "Sign Out" returns to sign-in form
- [ ] Clicking "Guest User" again creates NEW anonymous account
- [ ] Onboarding allows role selection each time
- [ ] Can repeat this process unlimited times
- [ ] Each guest session is independent
- [ ] No data leaks between sessions
- [ ] UI clearly indicates guest status

## 🎨 UI Mockup

### Current (Before):
```
┌──────────────────────────┐
│  ArkAngel - Sign In      │
├──────────────────────────┤
│  Email: [_____________]  │
│  Password: [_________]   │
│  [Sign In]               │
│                          │
│  OR CONTINUE AS          │
│  [Guest User]            │
└──────────────────────────┘
```

### After (When Guest is Authenticated):
```
┌──────────────────────────┐
│  Signed in as Guest      │
├──────────────────────────┤
│  ℹ️ You're using a       │
│  temporary guest account │
│                          │
│  [Sign Out]              │
│  [Continue as Guest]     │
└──────────────────────────┘
```

---

**Ready to implement? Start with Phase 1!**

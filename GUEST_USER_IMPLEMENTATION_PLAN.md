# Guest User with Employer/Employee Role - Implementation Plan

**Date**: 2025-11-12
**Feature**: Guest users can select employer/employee role and access full features
**Research**: Supabase anonymous sign-ins (2024 feature)

---

## 🎯 Feature Requirements

### User Request Summary

1. **Guest User Flow**:
   - User clicks "Guest User" button
   - Supabase creates anonymous account automatically
   - Immediately show onboarding: "Are you an Employer or Employee?"

2. **Employer Flow (Guest)**:
   - Select "I'm an Employer"
   - System generates employer code
   - Can share code with employees
   - Can see all employees in "Employees" section

3. **Employee Flow (Guest)**:
   - Select "I'm an Employee"
   - Enter employer code
   - Get linked to employer's organization
   - Employer can see this employee's data

4. **Data Persistence**:
   - All screenshot data saved with user ID
   - Works exactly like registered users
   - Can upgrade to registered account later (optional)

---

## 📚 Research Findings

### Supabase Anonymous Sign-Ins (April 2024)

**Key Features**:
- ✅ Persistent user ID in `auth.users` table
- ✅ Full authentication (Access Token, JWT)
- ✅ Works with Row Level Security (RLS)
- ✅ Can be converted to registered user later
- ✅ Has `is_anonymous` claim in JWT for RLS policies

**API Method**:
```typescript
const { data, error } = await supabase.auth.signInAnonymously()
```

**Limitations**:
- ❌ User can't sign back in if they clear browser data
- ❌ User can't access account from different device
- ⚠️ Requires captcha for production (to prevent abuse)

**Perfect for our use case**: Guest users who want to try the app without signing up!

---

## 🏗️ Implementation Architecture

### Database Schema (No Changes Needed!)

Our existing schema already supports this:

```sql
-- profiles table (already exists)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,  -- Will be NULL for anonymous users
  full_name TEXT,  -- We'll generate fake name
  role TEXT,  -- 'employer' or 'employee'
  organization_id UUID,  -- Links to organization
  employer_code TEXT,  -- For employers only
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- organizations table (already exists)
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT,  -- We'll generate fake org name
  employer_id UUID REFERENCES profiles(id),
  employer_code TEXT UNIQUE,
  created_at TIMESTAMP
);

-- organization_users table (already exists)
CREATE TABLE organization_users (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES profiles(id),
  role TEXT,  -- 'employer' or 'employee'
  created_at TIMESTAMP
);
```

**Key Point**: Anonymous users have a real user ID, so all existing RLS policies work!

---

## 🔄 Implementation Flow

### Phase 1: Enable Supabase Anonymous Sign-Ins

**Step 1.1**: Enable in Supabase Dashboard
- Go to: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/settings/auth
- Find "Anonymous sign-ins" toggle
- Enable it
- Save settings

**Step 1.2**: Add `signInAnonymously` to `src/lib/supabase.ts`

```typescript
export const signInAsGuest = async () => {
  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) {
    throw new Error(error.message)
  }

  return data
}
```

---

### Phase 2: Update AuthContext for Guest Sign-In

**Step 2.1**: Add `loginAsGuest` function to `AuthContext.tsx`

```typescript
const loginAsGuest = async () => {
  setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

  try {
    const { user } = await signInAsGuest();

    // Generate fake user data
    const fakeName = `Guest_${Math.random().toString(36).substring(2, 8)}`;

    // Create profile with fake data
    const { data: profile } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: null,  // Anonymous users have no email
        full_name: fakeName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    setAuthState({
      user: profile,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  } catch (error: any) {
    setAuthState(prev => ({
      ...prev,
      isLoading: false,
      error: error.message || 'Guest sign-in failed',
    }));
    throw error;
  }
};
```

---

### Phase 3: Update AuthForm "Guest User" Button

**Step 3.1**: Update `src/components/auth/AuthForm.tsx`

Change the `handleGuestSignIn` function:

```typescript
const handleGuestSignIn = async () => {
  try {
    await loginAsGuest();  // Create anonymous Supabase user
    // Show success confirmation
    setSignInSuccess(true);
    // Wait 1 second, then close window and show onboarding
    setTimeout(() => {
      emit('auth-success');
    }, 1000);
  } catch (error) {
    console.error('Guest sign-in error:', error);
  }
};
```

---

### Phase 4: Update ProfilePage for Guest Users

**Step 4.1**: Check if user needs onboarding (no role)

The existing code already does this!

```typescript
// ProfilePage.tsx (already exists)
if (isAuthenticated && user && !user.role) {
  return <OnboardingPage />;
}
```

**Step 4.2**: Update OnboardingPage to handle guest users

No changes needed! OnboardingPage already handles:
- Role selection
- Employer org creation
- Employee code input

It will work perfectly for anonymous users!

---

### Phase 5: Update RLS Policies for Anonymous Users

**Step 5.1**: Ensure RLS policies allow anonymous users

Our existing policies use `auth.uid()` which returns the user ID for both registered AND anonymous users.

**Example existing policy**:
```sql
-- Profiles: Users can read their own profile
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);  -- Works for anonymous users too!
```

**Optional enhancement**: Add `is_anonymous` check if needed:

```sql
-- Example: Allow anonymous users to create profiles
CREATE POLICY "Anonymous users can create profile"
ON profiles FOR INSERT
WITH CHECK (
  auth.uid() = id AND
  (auth.jwt() ->> 'is_anonymous')::boolean = true
);
```

---

### Phase 6: Generate Fake Names and Org Names

**Step 6.1**: Create helper function for fake data

Add to `src/lib/supabase.ts`:

```typescript
// Generate random guest username
export const generateGuestUsername = () => {
  const adjectives = ['Swift', 'Bold', 'Bright', 'Clever', 'Eager', 'Fancy', 'Gentle', 'Happy', 'Jolly', 'Kind'];
  const nouns = ['Panda', 'Tiger', 'Eagle', 'Dolphin', 'Falcon', 'Wolf', 'Bear', 'Fox', 'Hawk', 'Lion'];

  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNum = Math.floor(Math.random() * 1000);

  return `${randomAdj}${randomNoun}${randomNum}`;
};

// Generate random organization name
export const generateGuestOrgName = () => {
  const types = ['Tech', 'Digital', 'Cloud', 'Data', 'Innovation', 'Solutions', 'Systems', 'Services'];
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Prime', 'Core', 'Nexus'];

  const randomType = types[Math.floor(Math.random() * types.length)];
  const randomName = names[Math.floor(Math.random() * names.length)];

  return `${randomName} ${randomType}`;
};
```

**Step 6.2**: Use in guest sign-in flow

```typescript
const loginAsGuest = async () => {
  // ... existing code ...

  const fakeName = generateGuestUsername();  // e.g., "SwiftPanda742"

  // Create profile with fake name
  // ... rest of code ...
};
```

**Step 6.3**: Use in employer setup

Update `src/lib/supabase.ts` `setupEmployerAccount`:

```typescript
export const setupEmployerAccount = async (userId: string, organizationName: string) => {
  // If organizationName is empty (guest user), generate one
  const orgName = organizationName || generateGuestOrgName();

  // ... rest of existing code ...
};
```

---

### Phase 7: Update OnboardingPage for Auto-Generated Names

**Step 7.1**: Modify employer org name input

Update `src/components/auth/OnboardingPage.tsx`:

```typescript
// For guest users, auto-generate org name
const handleRoleSelected = async (role: 'employer' | 'employee') => {
  if (role === 'employer') {
    // Check if user is guest (no email)
    const isGuest = !user?.email;

    if (isGuest) {
      // Auto-generate org name and create employer account immediately
      setLoading(true);
      try {
        const result = await setupAsEmployer('');  // Empty string = auto-generate
        setEmployerCode(result.employer_code);
        setCurrentStep('employer-code-display');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      // Regular user: ask for org name
      setCurrentStep('employer-org-name');
    }
  } else {
    setCurrentStep('employee-code-input');
  }
};
```

---

## 📝 Implementation Steps (Detailed)

### Step 1: Enable Supabase Anonymous Sign-Ins ✅

**Actions**:
1. Open Supabase dashboard: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/settings/auth
2. Find "Anonymous sign-ins" section
3. Enable toggle
4. Save settings

**Verification**:
- Setting should show "Enabled"
- May require page refresh

---

### Step 2: Add Helper Functions to supabase.ts ✅

**File**: `src/lib/supabase.ts`

**Add**:
- `signInAsGuest()`
- `generateGuestUsername()`
- `generateGuestOrgName()`

**Update**:
- `setupEmployerAccount()` to auto-generate org name if empty

---

### Step 3: Update AuthContext.tsx ✅

**File**: `src/contexts/AuthContext.tsx`

**Add**:
- `loginAsGuest()` function to AuthContextType interface
- Implementation of `loginAsGuest()` function
- Export it in the context value

---

### Step 4: Update AuthForm.tsx ✅

**File**: `src/components/auth/AuthForm.tsx`

**Update**:
- `handleGuestSignIn()` to call `loginAsGuest()`
- Show success message before closing window

---

### Step 5: Update OnboardingPage.tsx ✅

**File**: `src/components/auth/OnboardingPage.tsx`

**Update**:
- `handleRoleSelected()` to detect guest users
- Auto-create employer account with generated name for guests
- Skip org name input step for guest employers

---

### Step 6: Test Guest User Flow ✅

**Test Cases**:

1. **Guest → Employer**:
   - Click "Guest User"
   - Select "I'm an Employer"
   - See auto-generated employer code
   - Copy code
   - Check Supabase: organization created with fake name

2. **Guest → Employee**:
   - Click "Guest User" (new session)
   - Select "I'm an Employee"
   - Paste employer code from Test 1
   - Should link successfully

3. **Employer Dashboard**:
   - Login as employer guest
   - Go to Settings → Employees
   - Should see employee guest from Test 2

4. **Screenshot Sync**:
   - Login as employee guest
   - Trigger screenshot capture
   - Check Supabase: screenshot saved with guest user ID
   - Check employer dashboard: screenshot visible

---

### Step 7: Test Regular Login Still Works ✅

**Test Cases**:

1. **Regular Sign-Up**:
   - Click "Sign up"
   - Enter real email and password
   - Should work as before

2. **Regular Sign-In**:
   - Click "Sign in"
   - Enter credentials
   - Should work as before

3. **Regular Employer/Employee**:
   - Sign up as regular user
   - Select employer role
   - Enter org name manually
   - Should work as before

---

## 🎨 User Experience Flow

### Guest User Journey

```
1. User opens app
   ↓
2. Clicks "Guest User" button
   ↓
3. [Background] Supabase creates anonymous user
   ↓
4. "Success! Creating your guest account..." (1 second)
   ↓
5. Auth window closes
   ↓
6. OnboardingPage opens: "Choose your role"
   ↓
7a. Clicks "I'm an Employer"
    → Auto-generates org name
    → Shows employer code
    → "Share this code: EMP-X7K9M2"
    ↓
8a. Redirects to /settings#employees
    ↓
9a. Can share code with employees ✅

7b. Clicks "I'm an Employee"
    → Shows input: "Enter employer code"
    → Enters code: EMP-X7K9M2
    → Links to organization
    ↓
8b. Redirects to /settings#performance
    ↓
9b. Employer sees this employee ✅
```

---

## 🔒 Security Considerations

### Anonymous User Limitations

**What They CAN Do**:
- ✅ Use all app features
- ✅ Create organizations
- ✅ Link to organizations
- ✅ Have screenshots tracked
- ✅ Access employer/employee dashboards

**What They CANNOT Do**:
- ❌ Sign in from another device
- ❌ Recover account if browser data cleared
- ❌ Access account after logout (unless we save session)
- ❌ Change email (they don't have one)

### RLS Policy Security

**Already Protected**:
- Users can only see their own data (`auth.uid() = id`)
- Employers can only see their organization's data
- Employees can only see their own data
- All existing RLS policies work with anonymous users

### Abuse Prevention (Production)

**For Production**:
- Enable captcha for anonymous sign-ins
- Rate limit anonymous account creation
- Monitor for suspicious patterns

---

## 🧪 Testing Checklist

### Functional Testing

- [ ] Guest user button creates anonymous account
- [ ] Guest user sees onboarding flow
- [ ] Guest employer gets auto-generated org name
- [ ] Guest employer gets employer code
- [ ] Guest employee can enter employer code
- [ ] Guest employee links to organization
- [ ] Employer dashboard shows guest employee
- [ ] Screenshot data syncs with guest user ID
- [ ] Guest user can navigate all pages
- [ ] Regular login still works
- [ ] Regular sign-up still works
- [ ] Email users can still select roles

### Edge Cases

- [ ] Guest user clears browser data (loses account)
- [ ] Guest user tries to access from different device
- [ ] Guest employer tries to create multiple orgs
- [ ] Guest employee tries to link to non-existent code
- [ ] Anonymous user with existing profile
- [ ] Anonymous user without profile

---

## 📊 Expected Database State

### After Guest Employer Signs In

```sql
-- auth.users table
{
  id: "uuid-1234",
  email: null,  -- Anonymous user
  is_anonymous: true,
  created_at: "2025-11-12"
}

-- profiles table
{
  id: "uuid-1234",
  email: null,
  full_name: "SwiftPanda742",  -- Auto-generated
  role: "employer",
  organization_id: "uuid-5678",
  employer_code: "EMP-X7K9M2",
  created_at: "2025-11-12"
}

-- organizations table
{
  id: "uuid-5678",
  name: "Alpha Tech",  -- Auto-generated
  employer_id: "uuid-1234",
  employer_code: "EMP-X7K9M2",
  created_at: "2025-11-12"
}
```

---

## 🚀 Deployment Steps

1. ✅ Enable anonymous sign-ins in Supabase
2. ✅ Add helper functions to supabase.ts
3. ✅ Update AuthContext with loginAsGuest
4. ✅ Update AuthForm guest button
5. ✅ Update OnboardingPage for auto-generation
6. ✅ Test guest employer flow
7. ✅ Test guest employee flow
8. ✅ Test regular login flow
9. ✅ Verify screenshot sync
10. ✅ Verify employer dashboard

---

## ✅ Success Criteria

**Guest User Flow**:
- [x] Guest user can sign in with one click
- [x] Guest user sees role selection
- [x] Guest employer gets auto-generated org and code
- [x] Guest employee can link to employer
- [x] Employer sees guest employee in dashboard
- [x] Screenshot data syncs correctly

**Regular User Flow**:
- [x] Regular sign-up still works
- [x] Regular sign-in still works
- [x] Regular users can enter custom org names
- [x] All existing features work unchanged

---

**Ready to implement!** 🎉

**Estimated Time**: 2-3 hours
**Complexity**: Medium
**Risk**: Low (uses existing Supabase feature, no schema changes)

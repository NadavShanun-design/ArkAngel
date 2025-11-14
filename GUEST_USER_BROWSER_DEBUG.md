# Guest User Browser Debug Guide

## Step 1: Open Browser Console

1. Open your ArkAngel app
2. Press **F12** (or Cmd+Option+I on Mac)
3. Click the **Console** tab

## Step 2: Test Anonymous Sign-In Directly

Paste this code into the console to test if Supabase anonymous sign-in works:

```javascript
// Test 1: Import Supabase client
const { createClient } = await import('@supabase/supabase-js');

// Test 2: Create client with your credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oyexmxetjudbnuhairry.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Anon Key exists:', !!supabaseKey);

const testClient = createClient(supabaseUrl, supabaseKey);

// Test 3: Try anonymous sign-in
console.log('Testing anonymous sign-in...');
const { data, error } = await testClient.auth.signInAnonymously();

if (error) {
  console.error('❌ Anonymous sign-in failed:', error);
} else {
  console.log('✅ Anonymous sign-in successful!');
  console.log('User ID:', data.user?.id);
  console.log('User data:', data.user);
  console.log('Session:', data.session);
}
```

## Expected Output (Success):

```
Supabase URL: https://oyexmxetjudbnuhairry.supabase.co
Anon Key exists: true
Testing anonymous sign-in...
✅ Anonymous sign-in successful!
User ID: <some-uuid>
User data: { id: "...", is_anonymous: true, ... }
Session: { access_token: "...", ... }
```

## Possible Errors:

### Error 1: "Anonymous sign-ins are disabled"

```
❌ Anonymous sign-in failed: {
  message: "Anonymous sign-ins are disabled"
}
```

**Solution**: Anonymous sign-ins are not enabled in Supabase dashboard
- Go to: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/settings/auth
- Scroll to "Anonymous sign-ins"
- Toggle ON
- Save

### Error 2: "Invalid API key"

```
❌ Anonymous sign-in failed: {
  message: "Invalid API key"
}
```

**Solution**: Check your `.env.local` file has the correct `VITE_SUPABASE_ANON_KEY`

### Error 3: Profile creation fails

If anonymous sign-in works but profile creation fails:

```javascript
// Test profile creation
const userId = data.user.id;
const fakeName = 'TestGuest123';

const { data: profile, error: profileError } = await testClient
  .from('profiles')
  .insert({
    id: userId,
    email: null,
    full_name: fakeName,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .select()
  .single();

if (profileError) {
  console.error('❌ Profile creation failed:', profileError);
} else {
  console.log('✅ Profile created successfully:', profile);
}
```

**Possible errors**:
- `null value in column 'email' violates not-null constraint` → Migration wasn't run
- `permission denied` → RLS policy blocking anonymous users

## Step 3: Check Current Auth State

```javascript
// Get current user
const { data: { user } } = await testClient.auth.getUser();
console.log('Current user:', user);

// Get session
const { data: { session } } = await testClient.auth.getSession();
console.log('Current session:', session);
```

## Step 4: Watch Console While Clicking Guest Button

1. Clear console (click trash icon or Cmd+K)
2. Click "Guest User" button
3. Watch for these logs:

**Expected logs:**
```
[AuthForm] Guest sign-in clicked
[AuthContext] loginAsGuest() called
[AuthContext] Creating anonymous Supabase user...
[AuthContext] Anonymous user created with ID: <uuid>
[AuthContext] Generated guest username: BoldPanda742
[AuthContext] Guest profile created: {...}
[AuthContext] Guest login successful
[AuthForm] Guest login successful
[AuthForm] Emitting auth-success event
```

**If stuck at "Signing in...":**
Look for error messages between the logs. Common errors:
- `Failed to create guest user - no user returned`
- `Failed to create guest profile: <error>`
- `Guest login failed. Please try again.`

## Step 5: Check Network Tab

1. Open **Network** tab in DevTools
2. Click "Guest User" button
3. Look for requests to:
   - `https://oyexmxetjudbnuhairry.supabase.co/auth/v1/signup`
   - `https://oyexmxetjudbnuhairry.supabase.co/rest/v1/profiles`

Check if they're failing (red status codes like 400, 403, 500)

## Step 6: Clear Auth State and Try Again

If you're stuck, try clearing the auth state:

```javascript
// Sign out current user
await testClient.auth.signOut();

// Clear localStorage
localStorage.clear();

// Reload page
location.reload();
```

Then try clicking "Guest User" again.

## Step 7: Manual Guest User Creation Test

Try the full flow manually in console:

```javascript
// Import everything needed
const { createClient } = await import('@supabase/supabase-js');

// Create client
const url = 'https://oyexmxetjudbnuhairry.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const client = createClient(url, key);

// Sign in anonymously
const { data: authData, error: authError } = await client.auth.signInAnonymously();
console.log('Auth result:', authData, authError);

if (!authError && authData.user) {
  // Generate fake name
  const adjectives = ['Swift', 'Bold', 'Bright'];
  const nouns = ['Panda', 'Tiger', 'Eagle'];
  const fakeName = adjectives[0] + nouns[0] + '123';

  // Create profile
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .insert({
      id: authData.user.id,
      email: null,
      full_name: fakeName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  console.log('Profile result:', profile, profileError);

  if (!profileError) {
    console.log('✅ FULL GUEST USER CREATION SUCCESS!');
    console.log('User ID:', authData.user.id);
    console.log('Username:', fakeName);
  }
}
```

## What to Share

After running these tests, share:

1. **Screenshot of console output** after clicking "Guest User"
2. **Any error messages** (copy full error text)
3. **Network tab** showing failed requests (if any)
4. **Result of Test 1** (direct anonymous sign-in test)

This will help identify exactly where the process is failing!

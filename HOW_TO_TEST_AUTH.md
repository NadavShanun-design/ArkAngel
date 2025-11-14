# How to Test Authentication

## The app is running! ✅

The white screen you're seeing is the auth window waiting for you to trigger it.

---

## How to Access the Auth Window:

The auth window doesn't open automatically. You need to trigger it from the main app:

### Option 1: Click Profile/Settings in Main App
1. The main app should be running (small bar at top of screen)
2. Look for a profile icon or settings button
3. Click it → Auth window opens

### Option 2: Open Auth Window Directly

Open your browser and go to:
```
http://localhost:1420/#/auth
```

This will show you the auth form directly.

---

## What You Should See:

### Auth Form (http://localhost:1420/#/auth):
```
┌────────────────────────────────┐
│          ArkAngel              │
│    Sign in to your account     │
│                                │
│  ┌─────────────────────────┐  │
│  │ Email address           │  │
│  │ [Enter your email]      │  │
│  │                         │  │
│  │ Password                │  │
│  │ [Enter your password]   │  │
│  │                         │  │
│  │  [Sign in button]       │  │
│  │                         │  │
│  │  Don't have an account? │  │
│  │       Sign up           │  │
│  │                         │  │
│  │  OR CONTINUE AS          │  │
│  │  [Guest User button]    │  │
│  └─────────────────────────┘  │
└────────────────────────────────┘
```

---

## Testing Guest Login:

1. Go to: `http://localhost:1420/#/auth`
2. Scroll down to see "Guest User" button
3. Click it
4. Should show onboarding modal
5. Select Employer or Employee

---

## Testing Email Sign-Up:

1. Go to: `http://localhost:1420/#/auth`
2. Click "Sign up"
3. Enter:
   - Email: `test@example.com`
   - Password: `TestPass123`
   - Name: `Test User`
4. Click "Create account"
5. Should immediately log in (no email needed)
6. Shows onboarding modal

---

## If You See White Screen:

The auth window is working, but might not be rendering properly. Try:

1. **Refresh the page** (Cmd+R)
2. **Open browser console** (Cmd+Option+I) and check for errors
3. **Navigate directly**: `http://localhost:1420/#/auth`
4. **Check if JavaScript loaded**: Look for console errors

---

## Main App Routes:

- `http://localhost:1420/` - Main app (toolbar)
- `http://localhost:1420/#/auth` - Auth form
- `http://localhost:1420/#/profile` - Profile page
- `http://localhost:1420/#/settings` - Settings page

---

## Expected Flow:

```
Main App (toolbar)
   ↓ (click profile/settings)
Opens Auth Window → http://localhost:1420/#/auth
   ↓ (login/guest)
Shows Onboarding Modal (same window)
   ↓ (complete role selection)
Window closes
   ↓
Back to Main App (with user logged in)
```

---

## Quick Test:

Open your browser and paste this:
```
http://localhost:1420/#/auth
```

You should see the login form with:
- Email input
- Password input
- Sign in button
- Sign up link
- Guest User button

If you see this, everything is working! ✅

---

## Debugging:

If the page is blank:
1. Open DevTools (Cmd+Option+I)
2. Go to Console tab
3. Look for errors (red text)
4. Share the errors with me

Common issues:
- JavaScript not loading → Check Console for errors
- CSS not loading → Page looks broken
- Supabase not connecting → Check Console for "Failed to fetch" errors

---

**The app is running and ready to test!**

Just navigate to `http://localhost:1420/#/auth` to see the auth form.

# Disable Email Confirmation for Development

**Date**: 2025-11-12
**Issue**: Users not receiving confirmation emails after sign-up
**Solution**: Disable email confirmation in Supabase for instant sign-ups during development

---

## 🎯 Quick Fix (Recommended for Development)

### Disable Email Confirmation in Supabase

**Why**: During development, email confirmation is unnecessary and slows down testing. Disabling it allows instant sign-ups without waiting for emails.

**Steps**:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry
   - Sign in with your Supabase account

2. **Navigate to Authentication Settings**
   - Click **"Authentication"** in the left sidebar
   - Click **"Settings"** (or **"Email Auth"**)
   - Look for **"Email Confirmations"** or **"Confirm email"** setting

3. **Disable Email Confirmation**
   - Find the toggle for **"Enable email confirmations"** or **"Confirm email"**
   - **Turn it OFF** (disabled)
   - Click **"Save"** at the bottom

4. **Test Sign-Up**
   - Try signing up with a new email
   - User should be created instantly without needing to confirm email ✅

---

## Alternative: Configure Email Provider (Production)

If you want email confirmation to work (for production), you need to configure an email provider.

### Option 1: Use Supabase Default Email (Development Only)

**Supabase provides a default email service for development**, but it has limitations:
- Limited to 3 emails per hour
- Not reliable for production
- May go to spam

**Check if it's enabled**:
1. Go to: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/settings/auth
2. Scroll to **"Email"** section
3. Should see "Using Supabase email service" (development only)

**If emails aren't sending**:
- Check your spam folder
- Try with a different email provider (Gmail, etc.)
- Consider using a custom SMTP provider

---

### Option 2: Custom SMTP Provider (Production Ready)

For production, configure a custom email provider:

**Popular Options**:
- **SendGrid** (Free tier: 100 emails/day)
- **Mailgun** (Free tier: 100 emails/day)
- **AWS SES** (Very cheap, $0.10 per 1000 emails)
- **Resend** (Free tier: 100 emails/day)

**Steps to Configure SMTP**:

1. **Get SMTP Credentials**
   - Sign up for an email provider (e.g., SendGrid)
   - Get your SMTP credentials:
     - SMTP Host (e.g., `smtp.sendgrid.net`)
     - SMTP Port (usually `587` or `465`)
     - SMTP Username
     - SMTP Password

2. **Configure in Supabase**
   - Go to: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/settings/auth
   - Scroll to **"SMTP Settings"**
   - Click **"Enable Custom SMTP"**
   - Fill in:
     ```
     Sender Email: noreply@yourdomain.com (or verified email)
     Sender Name: ArkAngel
     Host: smtp.sendgrid.net (or your provider)
     Port: 587
     Username: apikey (SendGrid uses "apikey" as username)
     Password: <your-sendgrid-api-key>
     ```
   - Click **"Save"**

3. **Test Email Sending**
   - Try signing up with a new account
   - Check inbox for confirmation email
   - Check spam folder if not received

---

## Current Configuration Analysis

Based on your code in `src/lib/supabase.ts:19-34`:

```typescript
export const signUp = async (email: string, password: string, userData?: { full_name?: string; phone?: string }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData,
      emailRedirectTo: window.location.origin + '/auth'
    }
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
```

**What this does**:
- Sends sign-up request to Supabase
- `emailRedirectTo` sets where users go after clicking confirmation link
- Currently set to: `http://localhost:1420/auth` (development) or `https://yourdomain.com/auth` (production)

**Issue**: If email confirmation is enabled but emails aren't being sent, users will be stuck in a "pending confirmation" state.

---

## Recommended Development Workflow

### For Development/Testing:

1. **Disable Email Confirmation** ✅ (Recommended)
   - Go to Supabase dashboard
   - Authentication → Settings
   - Disable "Confirm email"
   - Users created instantly

### For Production:

1. **Enable Email Confirmation** ✅
   - Configure custom SMTP provider
   - Test email delivery thoroughly
   - Customize email templates

---

## Troubleshooting

### Issue: "User created but can't sign in"

**Cause**: Email confirmation enabled, but email not confirmed

**Solution**:
```sql
-- Manually confirm user in Supabase SQL Editor
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'your-test@email.com';
```

---

### Issue: "Email goes to spam"

**Cause**: Using default Supabase email service

**Solutions**:
1. Configure custom SMTP with verified domain
2. Use reputable email provider (SendGrid, AWS SES)
3. Add SPF, DKIM, DMARC records to your domain

---

### Issue: "emailRedirectTo not working in Tauri"

**Cause**: Tauri apps have custom URL schemes, not HTTP

**Solution**: Update `emailRedirectTo` to handle Tauri protocol:

```typescript
// Update src/lib/supabase.ts
export const signUp = async (email: string, password: string, userData?: { full_name?: string; phone?: string }) => {
  // Detect if running in Tauri
  const isTauri = window.__TAURI__ !== undefined;

  // Use appropriate redirect URL
  const redirectUrl = isTauri
    ? 'tauri://localhost/auth'  // Tauri custom protocol
    : window.location.origin + '/auth';  // Web protocol

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData,
      emailRedirectTo: redirectUrl
    }
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
```

---

## Checking Current Email Confirmation Status

Run this in Supabase SQL Editor to check if users are waiting for email confirmation:

```sql
-- See all users and their email confirmation status
SELECT
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE
    WHEN email_confirmed_at IS NULL THEN 'Pending Confirmation'
    ELSE 'Confirmed'
  END as status
FROM auth.users
ORDER BY created_at DESC;
```

**If you see users with `email_confirmed_at = NULL`**, they're stuck waiting for email confirmation.

**To manually confirm them**:
```sql
-- Confirm all pending users (development only!)
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
```

---

## Summary: What to Do Now

### Fastest Solution (For Testing):

1. **Disable email confirmation** in Supabase dashboard:
   - https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/settings/auth
   - Turn OFF "Enable email confirmations"
   - Save settings

2. **Delete existing test users** (they're stuck in pending state):
   - Go to: https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/auth/users
   - Delete the user with email `paradooma@gmail.com`

3. **Try signing up again**:
   - User should be created instantly
   - Can sign in immediately
   - No email needed ✅

---

### For Production Deployment:

1. **Configure custom SMTP provider** (SendGrid, AWS SES, etc.)
2. **Enable email confirmation** in Supabase
3. **Test email delivery** thoroughly
4. **Customize email templates** in Supabase dashboard
5. **Update `emailRedirectTo`** to handle Tauri protocol

---

**Quick Link to Supabase Auth Settings**:
https://supabase.com/dashboard/project/oyexmxetjudbnuhairry/settings/auth

**Expected Result After Disabling**:
- Sign-up → User created instantly
- Can sign in immediately
- No confirmation email needed
- Perfect for development and testing! ✅

---

**Created By**: Claude Code
**Last Updated**: 2025-11-12
**Issue**: Email confirmations not being sent
**Solution**: Disable email confirmation for development

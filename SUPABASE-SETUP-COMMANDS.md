# Supabase Setup Commands - Run These in Your Terminal

## ✅ Supabase CLI is Already Installed!

I've installed the Supabase CLI for you. Now you need to run these commands **in your terminal** (not through me).

---

## Step 1: Login to Supabase

Open your **Mac Terminal** or **IDE Terminal** and run:

```bash
cd "/Users/nadavshanun/Downloads/ArkAngel-copilot-fix-5294b662-d677-4a0a-9a82-119bf5a02734 2"

supabase login
```

This will open a browser window where you'll authorize the CLI.

---

## Step 2: Link Your Project

```bash
supabase link --project-ref oyexmxetjudbnuhairry
```

When prompted for the database password, use your Supabase database password (from your Supabase dashboard).

---

## Step 3: Set Stripe Secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key

supabase secrets set STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

---

## Step 4: Deploy Edge Functions

```bash
supabase functions deploy stripe-create-checkout

supabase functions deploy stripe-webhook

supabase functions deploy stripe-create-portal
```

---

## Step 5: Verify Secrets

```bash
supabase secrets list
```

You should see:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET

---

## Step 6: Check Function URLs

```bash
supabase functions list
```

You should see your webhook URL:
```
https://oyexmxetjudbnuhairry.supabase.co/functions/v1/stripe-webhook
```

---

## Optional: View Function Logs

To monitor your functions in real-time:

```bash
supabase functions logs stripe-create-checkout --follow
```

Or for webhook:

```bash
supabase functions logs stripe-webhook --follow
```

---

## Troubleshooting

### If "supabase: command not found"

The CLI is installed at: `/opt/homebrew/bin/supabase`

Try:
```bash
export PATH="/opt/homebrew/bin:$PATH"
supabase --version
```

### If deployment fails

Check you're in the right directory:
```bash
pwd
# Should show: /Users/nadavshanun/Downloads/ArkAngel-copilot-fix-5294b662-d677-4a0a-9a82-119bf5a02734 2
```

### If you need to re-link

```bash
supabase link --project-ref oyexmxetjudbnuhairry --password YOUR_DB_PASSWORD
```

---

## After All Commands Complete

1. Your Edge Functions will be deployed
2. Your Stripe secrets will be stored securely
3. Your webhook endpoint will be: `https://oyexmxetjudbnuhairry.supabase.co/functions/v1/stripe-webhook`

Then come back and I'll help you configure the webhook in Stripe Dashboard and test the payment flow!

---

## Quick Copy-Paste All Commands

```bash
# Step 1: Navigate to project
cd "/Users/nadavshanun/Downloads/ArkAngel-copilot-fix-5294b662-d677-4a0a-9a82-119bf5a02734 2"

# Step 2: Login
supabase login

# Step 3: Link project
supabase link --project-ref oyexmxetjudbnuhairry

# Step 4: Set secrets
supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key
supabase secrets set STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Step 5: Deploy functions
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy stripe-create-portal

# Step 6: Verify
supabase secrets list
supabase functions list
```

# Stripe Integration - Deployment Guide

## Current Status: Ready for Testing ✅

All code has been implemented and is ready for testing with your Stripe sandbox environment!

## What's Been Completed

### ✅ Frontend Implementation
1. Beautiful payment UI with 3 subscription tiers (Free, Premium, Max)
2. Stripe service (`src/lib/stripe.ts`) for checkout and portal sessions
3. Full integration in PaymentsSection with working buttons
4. Subscription status display for authenticated users
5. Customer portal integration for managing subscriptions

### ✅ Backend Implementation
1. Supabase Edge Function for creating checkout sessions (`supabase/functions/stripe-create-checkout`)
2. Webhook handler for Stripe events (`supabase/functions/stripe-webhook`)
3. Customer portal session creator (`supabase/functions/stripe-create-portal`)

### ✅ Database Schema
1. Migration SQL ready (`supabase-migration-subscriptions.sql`)
2. All subscription fields added to User interface
3. Full TypeScript type safety

### ✅ Configuration
1. Stripe test keys added to `.env.local`
2. Environment variables properly configured

---

## Next Steps to Test

### Step 1: Create Products in Stripe Dashboard

1. Go to your Stripe Dashboard: https://dashboard.stripe.com/test/products
2. Click "Add product"

**Product 1: Premium Plan**
- Name: `Premium Plan`
- Description: `Unlimited AI conversations with priority support`
- Pricing: Recurring
- Price: `$4.99` USD
- Billing period: `Monthly`
- Click "Save product"
- **Copy the Price ID** (starts with `price_`) - you'll need this!

**Product 2: Max Plan**
- Name: `Max Plan`
- Description: `Ultimate AI experience with all features`
- Pricing: Recurring
- Price: `$14.99` USD
- Billing period: `Monthly`
- Click "Save product"
- **Copy the Price ID** (starts with `price_`) - you'll need this!

### Step 2: Update Price IDs in Environment

Open `.env.local` and update these lines with your actual Price IDs:

```bash
# Replace these placeholder values with your real Price IDs from Step 1
VITE_STRIPE_PRICE_PREMIUM=price_xxxxxxxxxxxxx  # Replace with Premium Price ID
VITE_STRIPE_PRICE_MAX=price_xxxxxxxxxxxxx       # Replace with Max Price ID
```

### Step 3: Run Database Migration

1. Log into your Supabase Dashboard
2. Go to **SQL Editor**
3. Open the file `supabase-migration-subscriptions.sql`
4. Copy all the SQL code
5. Paste it into the Supabase SQL Editor
6. Click **Run** to execute the migration

This will add all subscription columns to your `profiles` table.

### Step 4: Deploy Supabase Edge Functions

You need to deploy the Edge Functions to Supabase. Install Supabase CLI if you haven't:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Set environment variables for Edge Functions
supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key

# Deploy all Edge Functions
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy stripe-create-portal
```

**Note:** You'll need your Supabase project reference. Find it in your Supabase Dashboard URL:
`https://supabase.com/dashboard/project/[YOUR_PROJECT_REF]`

### Step 5: Configure Stripe Webhook

After deploying the webhook function, you need to configure Stripe to send events to it:

1. Get your webhook function URL:
   ```
   https://[YOUR_PROJECT_REF].supabase.co/functions/v1/stripe-webhook
   ```

2. Go to Stripe Dashboard → **Developers** → **Webhooks**
3. Click "Add endpoint"
4. Enter your webhook URL
5. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
6. Click "Add endpoint"
7. **Copy the Webhook Signing Secret** (starts with `whsec_`)

8. Add it to your Supabase secrets:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

### Step 6: Restart Your Dev Server

After updating the `.env.local` file with the Price IDs:

```bash
# Stop the current dev server (Ctrl+C)
# Then restart it
npm run tauri dev
```

---

## Testing the Integration

### Test Scenario 1: Subscribe to Premium Plan

1. Open ArkAngel app
2. Sign in with your account
3. Go to **Advanced Settings** → **Payments**
4. Click "Upgrade to Premium" on the Premium plan card
5. You should be redirected to Stripe Checkout
6. Use a test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Any billing ZIP code
7. Complete the checkout
8. You should be redirected back to the app
9. Check that your plan shows as "Premium" in the UI

### Test Scenario 2: Manage Subscription

1. After subscribing, you should see a "Manage Subscription" button
2. Click it
3. You should be redirected to the Stripe Customer Portal
4. Test updating payment method, canceling, etc.

### Test Scenario 3: Check Database

1. Go to Supabase Dashboard → **Table Editor** → **profiles**
2. Find your user record
3. Verify these fields are populated:
   - `subscription_tier` should be `premium` or `max`
   - `stripe_customer_id` should have a value (starts with `cus_`)
   - `stripe_subscription_id` should have a value (starts with `sub_`)
   - `subscription_status` should be `active`

---

## Stripe Test Cards

Use these test cards in sandbox mode:

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Payment declined |
| `4000 0000 0000 9995` | Payment requires authentication |

All test cards:
- Use any future expiration date (e.g., 12/25)
- Use any 3-digit CVC (e.g., 123)
- Use any billing ZIP code (e.g., 12345)

---

## Troubleshooting

### Issue: "Failed to create checkout session"

**Solution:**
1. Check that Edge Functions are deployed: `supabase functions list`
2. Verify Stripe secret key is set: `supabase secrets list`
3. Check Edge Function logs: `supabase functions logs stripe-create-checkout`

### Issue: Subscription not updating in database

**Solution:**
1. Check webhook is configured in Stripe Dashboard
2. Verify webhook signing secret is set in Supabase
3. Check webhook function logs: `supabase functions logs stripe-webhook`
4. Test webhook directly in Stripe Dashboard → Webhooks → Send test webhook

### Issue: Price IDs not working

**Solution:**
1. Verify you copied the correct Price IDs (not Product IDs)
2. Price IDs start with `price_`, not `prod_`
3. Make sure you're using test mode Price IDs with test API keys

### Issue: "CORS error" or "Network error"

**Solution:**
1. Ensure Edge Functions have CORS headers (they do in our code)
2. Check that Supabase URL in `.env.local` is correct
3. Verify Supabase project is active

---

## Going Live (Production)

When ready to go live with real payments:

1. **Switch to Live Mode in Stripe:**
   - Get live API keys from Stripe Dashboard (live mode)
   - Update `.env.local` with live keys
   - Create live products and get live Price IDs

2. **Update Webhook:**
   - Create a new webhook endpoint in Stripe (live mode)
   - Point it to your production Edge Function URL
   - Update webhook secret in Supabase

3. **Test Thoroughly:**
   - Test with real cards in live mode
   - Verify webhooks are working
   - Check database updates

4. **Enable Customer Portal:**
   - Configure Customer Portal settings in Stripe Dashboard
   - Choose which features customers can manage

---

## Support & Resources

- **Stripe Documentation:** https://docs.stripe.com
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **Stripe Test Mode:** https://dashboard.stripe.com/test
- **Test Cards:** https://stripe.com/docs/testing

---

## Summary

You now have a fully functional Stripe subscription system! Just need to:

1. ✅ Create products in Stripe Dashboard
2. ✅ Update Price IDs in `.env.local`
3. ✅ Run database migration
4. ✅ Deploy Edge Functions
5. ✅ Configure webhook
6. ✅ Test the flow

Everything is coded and ready to go! 🚀

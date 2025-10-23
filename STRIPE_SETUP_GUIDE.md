# 💳 Complete Stripe Setup Guide for ArkAngel

## 🎯 Goal
Connect ArkAngel to your **real Stripe account** so when someone buys Premium or Max tier, you actually get the money in your bank account.

---

## 📋 Current Status

✅ **What's Already Done:**
- Stripe integration code is complete
- Supabase Edge Functions are written (`stripe-create-checkout`, `stripe-webhook`, `stripe-create-portal`)
- Frontend payment UI is built
- Database schema supports subscriptions
- **Currently using:** Test mode keys (won't process real money)

❌ **What You Need to Do:**
1. Create a real Stripe account
2. Get your live API keys
3. Create products and prices
4. Deploy Supabase Edge Functions with live keys
5. Configure Stripe webhooks
6. Update your app with live keys

---

## 🚀 STEP-BY-STEP GUIDE

### **PART 1: Create & Activate Your Stripe Account**

#### Step 1: Sign Up for Stripe
1. Go to https://stripe.com
2. Click **"Start now"** or **"Sign up"**
3. Enter your email and create a password
4. Verify your email address

#### Step 2: Complete Business Verification
**⚠️ IMPORTANT:** You can't receive real money until you activate your account!

1. Log into Stripe Dashboard: https://dashboard.stripe.com
2. Click **"Activate your account"** (yellow banner at top)
3. Fill out the business information form:
   - **Business type:** Individual or Company (choose based on your situation)
   - **Legal business name:** Your name or company name
   - **Industry:** Software / SaaS
   - **Website:** Your website URL (or leave blank if you don't have one yet)
   - **Description:** "AI assistant software with subscription plans"
   - **Tax ID:** SSN (Individual) or EIN (Company)
   - **Business address:** Your address
   - **Phone number:** Your phone number

4. Add **bank account details** (where you'll receive money):
   - Routing number
   - Account number
   - Confirm account ownership

5. Add **personal information** (for identity verification):
   - Full name
   - Date of birth
   - SSN (last 4 digits or full)
   - Home address

6. Submit for review

**⏱ Activation Time:** Usually instant, but can take 1-2 business days

---

### **PART 2: Create Your Products & Prices**

#### Step 3: Create Premium Product
1. In Stripe Dashboard, go to **Products** → **Add product**
2. Fill in the details:
   - **Name:** ArkAngel Premium
   - **Description:** Premium tier with advanced features
   - **Pricing model:** Standard pricing
   - **Price:** $9.99 (or your price)
   - **Billing period:** Monthly
   - **Currency:** USD
3. Click **Save product**
4. **📝 COPY THE PRICE ID** (starts with `price_...`) - you'll need this later!

#### Step 4: Create Max Product
1. Click **Add product** again
2. Fill in the details:
   - **Name:** ArkAngel Max
   - **Description:** Maximum tier with all features unlocked
   - **Pricing model:** Standard pricing
   - **Price:** $19.99 (or your price)
   - **Billing period:** Monthly
   - **Currency:** USD
3. Click **Save product**
4. **📝 COPY THE PRICE ID** (starts with `price_...`) - you'll need this later!

---

### **PART 3: Get Your Live API Keys**

#### Step 5: Get Your Live Keys
⚠️ **CRITICAL:** Make sure you're viewing **Live** mode (not Test mode)!

1. In Stripe Dashboard, look at the **top-left corner**
2. Make sure it says **"Live"** (if it says "Test", click and switch to "Live")
3. Go to **Developers** → **API keys**
4. You'll see two keys:
   - **Publishable key** (starts with `pk_live_...`)
   - **Secret key** (starts with `sk_live_...`)

5. **📝 COPY BOTH KEYS** - you'll add them to your .env file

**🔒 SECURITY WARNING:**
- The **Secret Key** (`sk_live_...`) should NEVER be shared or committed to GitHub
- Only the **Publishable Key** (`pk_live_...`) is safe to use in frontend code

---

### **PART 4: Update Your Environment Variables**

#### Step 6: Update .env.local File
1. Open this file in your code editor:
   ```
   /Users/nadavshanun/Downloads/ArkAngel-copilot-fix-5294b662-d677-4a0a-9a82-119bf5a02734 2/.env.local
   ```

2. Replace the Stripe lines (16-21) with your LIVE keys:

**FIND THIS:**
```env
# Stripe Configuration (Test/Sandbox Keys)
VITE_STRIPE_PUBLISHABLE_KEY=your_test_publishable_key
STRIPE_SECRET_KEY=your_test_secret_key

# Stripe Price IDs
VITE_STRIPE_PRICE_PREMIUM=your_premium_price_id
VITE_STRIPE_PRICE_MAX=your_max_price_id
```

**REPLACE WITH (use your actual keys!):**
```env
# Stripe Configuration (LIVE KEYS - DO NOT SHARE!)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY_HERE

# Stripe Price IDs (from Step 3 & 4)
VITE_STRIPE_PRICE_PREMIUM=price_YOUR_PREMIUM_PRICE_ID
VITE_STRIPE_PRICE_MAX=price_YOUR_MAX_PRICE_ID
```

3. **Save the file**

---

### **PART 5: Deploy Supabase Edge Functions**

#### Step 7: Deploy Edge Functions to Supabase
These are the serverless functions that handle Stripe checkout and webhooks.

1. **Open Terminal** and navigate to your project:
   ```bash
   cd "/Users/nadavshanun/Downloads/ArkAngel-copilot-fix-5294b662-d677-4a0a-9a82-119bf5a02734 2"
   ```

2. **Login to Supabase:**
   ```bash
   supabase login
   ```
   This will open a browser window. Login with your Supabase account.

3. **Link to your Supabase project:**
   ```bash
   supabase link --project-ref oyexmxetjudbnuhairry
   ```

4. **Set your Stripe secret key as a Supabase secret:**
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY_HERE
   ```
   Replace `sk_live_YOUR_SECRET_KEY_HERE` with your actual live secret key.

5. **Deploy the Edge Functions:**
   ```bash
   supabase functions deploy stripe-create-checkout
   supabase functions deploy stripe-create-portal
   supabase functions deploy stripe-webhook
   ```

6. **Verify deployment:**
   You should see success messages like:
   ```
   Deployed Function stripe-create-checkout on project oyexmxetjudbnuhairry
   ```

---

### **PART 6: Configure Stripe Webhooks**

Webhooks allow Stripe to notify your app when payments succeed, fail, or subscriptions change.

#### Step 8: Create Webhook Endpoint
1. Go to Stripe Dashboard → **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. **Endpoint URL:**
   ```
   https://oyexmxetjudbnuhairry.supabase.co/functions/v1/stripe-webhook
   ```

4. **Events to listen to** - Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

5. Click **"Add endpoint"**

6. **📝 COPY THE WEBHOOK SIGNING SECRET** (starts with `whsec_...`)

#### Step 9: Add Webhook Secret to Supabase
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

#### Step 10: Redeploy Webhook Function
```bash
supabase functions deploy stripe-webhook
```

---

### **PART 7: Test the Payment Flow**

#### Step 11: Test Your Integration
1. **Rebuild your app** with the new live keys:
   ```bash
   npm run tauri build
   ```

2. **Launch the app** and sign in

3. **Go to Settings** → **Subscription**

4. **Click "Upgrade to Premium"**

5. **Use a test card** (Stripe provides these even in live mode for testing):
   - Card number: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `90210`)

6. **Complete checkout**

7. **Verify in Stripe Dashboard:**
   - Go to **Customers** - you should see the test customer
   - Go to **Subscriptions** - you should see the active subscription
   - Go to **Payments** - you should see the payment

8. **Verify in your app:**
   - Your subscription tier should update to "Premium"
   - Settings should show your active subscription

---

### **PART 8: Accept Real Payments**

#### Step 12: Go Live! 💰
Once testing works:

1. **Remove test card restrictions** (if you added any)

2. **Share your app** with real users (via the DMG file you created earlier)

3. **Real users can now pay** with real credit cards

4. **Money flows to your bank account:**
   - Stripe holds funds for 2-7 days initially (fraud protection)
   - After that, payouts are automatic (daily or weekly, you configure this)
   - Check **Stripe Dashboard → Balance** to see your money

---

## 📊 Monitoring & Managing Payments

### Where to View Everything:

**Stripe Dashboard:** https://dashboard.stripe.com
- **Payments:** See all successful charges
- **Customers:** See who has subscribed
- **Subscriptions:** Manage active/canceled subscriptions
- **Balance:** See your current balance and payout schedule
- **Payouts:** See when money was sent to your bank

**Supabase Dashboard:** https://oyexmxetjudbnuhairry.supabase.co
- **Database → profiles table:** See user subscription tiers
- **Edge Functions → Logs:** Debug webhook issues

---

## 💰 Payment Timeline

1. **Customer subscribes** → Charged immediately
2. **Stripe holds funds** → 2-7 days (first payments), then instant
3. **Automatic payout** → Sent to your bank (daily/weekly setting)
4. **Money in your account** → 1-2 business days after payout

---

## 🔧 Troubleshooting

### "Payment system is being set up" Error
- **Cause:** Edge Functions not deployed or Stripe keys not set
- **Fix:** Complete Steps 7-10 above

### Webhook Events Not Received
- **Cause:** Webhook signing secret not configured
- **Fix:** Complete Steps 8-10
- **Verify:** Check Supabase Edge Function logs for errors

### Subscription Not Updating in App
- **Cause:** Webhook not processing correctly
- **Fix:** Check Stripe Dashboard → Webhooks → View recent deliveries
- **Check:** Supabase logs for database update errors

### Test Card Declined
- **Cause:** Test cards only work in Test mode
- **Fix:** Use real card in Live mode, or switch back to Test mode for testing

---

## 🛡️ Security Best Practices

1. ✅ **NEVER commit `.env.local` to GitHub**
2. ✅ **Use different keys for development vs. production**
3. ✅ **Keep your Secret Key (`sk_live_...`) truly secret**
4. ✅ **Regularly check Stripe Dashboard for suspicious activity**
5. ✅ **Enable 2-factor authentication on Stripe account**

---

## 📞 Support

If something doesn't work:

1. **Check Stripe Dashboard** → Developers → Events (shows all API activity)
2. **Check Stripe Dashboard** → Developers → Webhooks (shows webhook delivery status)
3. **Check Supabase** → Edge Functions → Logs (shows function execution logs)
4. **Stripe Support:** https://support.stripe.com (they respond fast!)

---

## ✅ Checklist

Before going live, make sure:

- [ ] Stripe account is activated (not in test mode)
- [ ] Business verification is complete
- [ ] Bank account is connected
- [ ] Products & prices are created (Premium & Max)
- [ ] Live API keys are copied to `.env.local`
- [ ] Edge Functions are deployed to Supabase
- [ ] Stripe secret is set in Supabase secrets
- [ ] Webhook endpoint is configured in Stripe
- [ ] Webhook secret is set in Supabase secrets
- [ ] Test payment completes successfully
- [ ] App updates subscription tier after test payment
- [ ] App is rebuilt with live keys (`npm run tauri build`)

---

🎉 **You're all set! Users can now pay you real money through Stripe!**

import { loadStripe, Stripe } from '@stripe/stripe-js';

// Initialize Stripe with publishable key
let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      console.error('Stripe publishable key not found in environment variables');
      return null;
    }

    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

// Price IDs from environment variables
export const STRIPE_PRICES = {
  premium: import.meta.env.VITE_STRIPE_PRICE_PREMIUM || 'price_premium_placeholder',
  max: import.meta.env.VITE_STRIPE_PRICE_MAX || 'price_max_placeholder',
};

// Subscription tier type
export type SubscriptionTier = 'free' | 'premium' | 'max';

// Create a checkout session for a subscription
export const createCheckoutSession = async (
  priceId: string,
  userId: string,
  userEmail: string,
  tier: SubscriptionTier
): Promise<{ url: string } | { error: string }> => {
  console.log('[Stripe] createCheckoutSession called with:', { priceId, userId, userEmail, tier });

  try {
    // Check if Edge Function is deployed, otherwise use direct Stripe Checkout (client-side)
    const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-create-checkout`;
    console.log('[Stripe] Edge Function URL:', edgeFunctionUrl);
    console.log('[Stripe] Supabase URL from env:', import.meta.env.VITE_SUPABASE_URL);
    console.log('[Stripe] Supabase anon key present:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);

    try {
      // Try to use Edge Function first
      console.log('[Stripe] Attempting to call Edge Function...');
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          priceId,
          userId,
          userEmail,
          tier,
          successUrl: `${window.location.origin}/settings?subscription=success`,
          cancelUrl: `${window.location.origin}/settings?subscription=canceled`,
        }),
      });

      console.log('[Stripe] Edge Function response status:', response.status);
      console.log('[Stripe] Edge Function response ok:', response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('[Stripe] Edge Function returned success:', data);
        return { url: data.url };
      } else {
        const errorText = await response.text();
        console.error('[Stripe] Edge Function returned error:', errorText);
      }
    } catch (edgeFunctionError) {
      console.error('[Stripe] Edge Function call failed:', edgeFunctionError);
    }

    // Fallback: Show user-friendly error message
    // In production, Edge Functions should always be available
    console.error('[Stripe] Edge Functions not available - deployment required');
    return {
      error: 'Payment system is being set up. Please try again in a moment. If the issue persists, the backend Edge Functions need to be deployed.'
    };
  } catch (error) {
    console.error('[Stripe] Error creating checkout session:', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
};

// Create a customer portal session
export const createPortalSession = async (
  customerId: string
): Promise<{ url: string } | { error: string }> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-create-portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        customerId,
        returnUrl: `${window.location.origin}/settings`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || 'Failed to create portal session' };
    }

    const data = await response.json();
    return { url: data.url };
  } catch (error) {
    console.error('Error creating portal session:', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
};

// Get subscription status
export const getSubscriptionStatus = async (
  userId: string
): Promise<{ status: string; tier: SubscriptionTier } | { error: string }> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-subscription-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.message || 'Failed to get subscription status' };
    }

    const data = await response.json();
    return { status: data.status, tier: data.tier };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return { error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
};

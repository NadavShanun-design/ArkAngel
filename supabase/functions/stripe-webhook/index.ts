// Supabase Edge Function: Handle Stripe Webhooks
// Deploy with: supabase functions deploy stripe-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables')
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-12-18.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the signature from headers
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'No signature found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get the raw body
    const body = await req.text()

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id || session.metadata?.userId
        const tier = session.metadata?.tier

        if (userId && tier) {
          // Update user's subscription in database
          await supabase
            .from('profiles')
            .update({
              subscription_tier: tier,
              stripe_customer_id: session.customer as string,
              subscription_status: 'active',
            })
            .eq('id', userId)

          console.log(`Subscription created for user ${userId} with tier ${tier}`)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata.userId
        const tier = subscription.metadata.tier

        if (userId) {
          await supabase
            .from('profiles')
            .update({
              subscription_tier: tier,
              stripe_subscription_id: subscription.id,
              subscription_status: subscription.status,
              subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('id', userId)

          console.log(`Subscription ${subscription.status} for user ${userId}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata.userId

        if (userId) {
          // Revert to free tier
          await supabase
            .from('profiles')
            .update({
              subscription_tier: 'free',
              subscription_status: 'canceled',
              stripe_subscription_id: null,
            })
            .eq('id', userId)

          console.log(`Subscription canceled for user ${userId}, reverted to free tier`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Find user by stripe_customer_id and update status
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'past_due',
          })
          .eq('stripe_customer_id', customerId)

        console.log(`Payment failed for customer ${customerId}`)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Update subscription status to active
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'active',
          })
          .eq('stripe_customer_id', customerId)

        console.log(`Payment successful for customer ${customerId}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

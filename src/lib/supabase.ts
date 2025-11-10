import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
})

// Authentication functions
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

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) {
    throw new Error(error.message)
  }
  
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    throw new Error(error.message)
  }
}

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback)
}

// Profile management functions
export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error) {
    throw new Error(error.message)
  }
  
  return data
}

export const updateProfile = async (
  userId: string,
  updates: {
    full_name?: string;
    phone?: string;
    avatar_url?: string;
    bio?: string;
    location?: string;
    website?: string;
    design_accent?: string;
    design_gradient?: string;
    current_persona_id?: string;
    theme?: string;
    subscription_tier?: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    subscription_status?: string;
    subscription_current_period_end?: string;
  }
) => {
  const { data, error} = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}


// ==========================================
// USAGE TRACKING FUNCTIONS
// ==========================================

/**
 * Log feature usage for a user
 */
export const logUsage = async (
  userId: string,
  feature: string,
  amount: number,
  usageType: string,
  metadata?: Record<string, any>
) => {
  const { data, error } = await supabase.rpc('log_usage', {
    p_user_id: userId,
    p_feature: feature,
    p_amount: amount,
    p_usage_type: usageType,
    p_metadata: metadata || {},
  })

  if (error) {
    console.error('Failed to log usage:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Get today's usage for a feature
 */
export const getTodayUsage = async (
  userId: string,
  feature: string
): Promise<number> => {
  const { data, error } = await supabase.rpc('get_today_usage', {
    p_user_id: userId,
    p_feature: feature,
  })

  if (error) {
    console.error('Failed to get today usage:', error)
    throw new Error(error.message)
  }

  return data || 0
}

/**
 * Get this month's usage for a feature
 */
export const getMonthUsage = async (
  userId: string,
  feature: string
): Promise<number> => {
  const { data, error } = await supabase.rpc('get_month_usage', {
    p_user_id: userId,
    p_feature: feature,
  })

  if (error) {
    console.error('Failed to get month usage:', error)
    throw new Error(error.message)
  }

  return data || 0
}

/**
 * Get all usage for today for all features
 */
export const getAllTodayUsage = async (userId: string) => {
  const today = new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('usage_logs')
    .select('feature, amount')
    .eq('user_id', userId)
    .eq('date', today)

  if (error) {
    console.error('Failed to get all today usage:', error)
    throw new Error(error.message)
  }

  // Sum up usage by feature
  const usage: Record<string, number> = {}
  data.forEach((row) => {
    usage[row.feature] = (usage[row.feature] || 0) + parseFloat(row.amount)
  })

  return usage
}

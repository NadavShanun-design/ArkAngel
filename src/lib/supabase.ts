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
    detectSessionInUrl: true,  // Enable to handle email confirmation links
    flowType: 'pkce'  // Use PKCE flow for better security
  }
})

// ==========================================
// GUEST/ANONYMOUS USER HELPERS
// ==========================================

/**
 * Generate random guest username (e.g., "SwiftPanda742")
 */
export const generateGuestUsername = (): string => {
  const adjectives = ['Swift', 'Bold', 'Bright', 'Clever', 'Eager', 'Fancy', 'Gentle', 'Happy', 'Jolly', 'Kind'];
  const nouns = ['Panda', 'Tiger', 'Eagle', 'Dolphin', 'Falcon', 'Wolf', 'Bear', 'Fox', 'Hawk', 'Lion'];

  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNum = Math.floor(Math.random() * 1000);

  return `${randomAdj}${randomNoun}${randomNum}`;
};

/**
 * Generate random organization name (e.g., "Alpha Tech")
 */
export const generateGuestOrgName = (): string => {
  const types = ['Tech', 'Digital', 'Cloud', 'Data', 'Innovation', 'Solutions', 'Systems', 'Services'];
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Prime', 'Core', 'Nexus'];

  const randomType = types[Math.floor(Math.random() * types.length)];
  const randomName = names[Math.floor(Math.random() * names.length)];

  return `${randomName} ${randomType}`;
};

// ==========================================
// AUTHENTICATION FUNCTIONS
// ==========================================

/**
 * Sign in as guest (anonymous user)
 * Creates a Supabase anonymous user with no email/password
 */
export const signInAsGuest = async () => {
  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

/**
 * Sign up with email and password
 * Email confirmation is required - user will receive an email with a confirmation link
 */
export const signUp = async (email: string, password: string, userData?: { full_name?: string; phone?: string }) => {
  console.log('[Supabase] Signing up user:', email);

  // For desktop apps, redirect to a simple success page
  // Users will see "Email confirmed, go back to app and sign in"
  const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
  
  // Use hosted redirect page for production, localhost for development
  // The redirect page just shows success message - user goes back to app to sign in
  const redirectUrl = isTauri
    ? 'https://your-username.github.io/arkangel-auth-callback' // Replace with your hosted page URL
    : `${window.location.origin}/auth`; // Works for web version

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData,
      // Redirect URL after email confirmation
      emailRedirectTo: redirectUrl
    }
  })

  if (error) {
    console.error('[Supabase] Sign up error:', error);
    throw new Error(error.message)
  }

  console.log('[Supabase] Sign up successful:', data);
  console.log('[Supabase] User needs to confirm email:', data.user?.identities?.length === 0);

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
  console.log('[Supabase] signOut() called');

  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('[Supabase] Sign out error:', error);
      throw new Error(error.message)
    }

    console.log('[Supabase] Sign out successful');
  } catch (err) {
    console.error('[Supabase] Sign out exception:', err);
    throw err;
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

// ==========================================
// ORGANIZATION & ROLE MANAGEMENT FUNCTIONS
// ==========================================

/**
 * Set up employer account - creates organization and sets user role to 'employer'
 * Returns employer code to share with employees
 * If organizationName is empty, auto-generates one (for guest users)
 */
export const setupEmployerAccount = async (
  userId: string,
  organizationName: string
): Promise<{ success: boolean; employer_code: string; organization_id: string }> => {
  // Auto-generate org name if empty (for guest users)
  const orgName = organizationName || generateGuestOrgName();

  const { data, error } = await supabase.rpc('setup_employer_account', {
    p_user_id: userId,
    p_org_name: orgName
  })

  if (error) {
    console.error('Failed to setup employer account:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Link employee to organization using employer's invite code
 */
export const linkEmployeeToOrganization = async (
  userId: string,
  employerCode: string
): Promise<{ success: boolean; organization_id: string; employer_name: string }> => {
  const { data, error } = await supabase.rpc('link_employee_to_organization', {
    p_user_id: userId,
    p_employer_code: employerCode
  })

  if (error) {
    console.error('Failed to link employee to organization:', error)
    throw new Error(error.message)
  }

  if (!data.success) {
    throw new Error('Invalid employer code')
  }

  return data
}

/**
 * Get organization details by employer code
 */
export const getOrganizationByCode = async (employerCode: string) => {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, employer_id, created_at')
    .eq('employer_code', employerCode)
    .single()

  if (error) {
    console.error('Failed to get organization:', error)
    throw new Error('Invalid employer code')
  }

  return data
}

/**
 * Get user's organization details
 */
export const getUserOrganization = async (userId: string) => {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('organization_id, role, employer_code')
    .eq('id', userId)
    .single()

  if (userError) {
    console.error('Failed to get user organization:', userError)
    throw new Error(userError.message)
  }

  if (!user.organization_id) {
    return null
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', user.organization_id)
    .single()

  if (orgError) {
    console.error('Failed to get organization details:', orgError)
    throw new Error(orgError.message)
  }

  return {
    ...org,
    user_role: user.role,
    user_employer_code: user.employer_code
  }
}

/**
 * Get all employees in employer's organization
 */
export const getOrganizationEmployees = async (employerId: string) => {
  // First get the organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('employer_id', employerId)
    .single()

  if (orgError) {
    console.error('Failed to get organization:', orgError)
    throw new Error(orgError.message)
  }

  // Then get all employees in that organization
  const { data: employees, error: empError } = await supabase
    .from('users')
    .select('id, email, full_name, role, created_at')
    .eq('organization_id', org.id)
    .eq('role', 'employee')

  if (empError) {
    console.error('Failed to get employees:', empError)
    throw new Error(empError.message)
  }

  return employees
}

/**
 * Get employee analytics (for both employer viewing employees and employee viewing self)
 */
export const getEmployeeAnalytics = async (userId: string) => {
  const { data, error } = await supabase
    .from('employee_analytics')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('Failed to get employee analytics:', error)
    // Return empty analytics if not found
    if (error.code === 'PGRST116') {
      return {
        total_screenshots: 0,
        category_breakdown: {},
        timeline: [],
        most_used_category: null
      }
    }
    throw new Error(error.message)
  }

  return data
}

/**
 * Upload screenshot to Supabase Storage
 */
export const uploadScreenshot = async (
  userId: string,
  file: File,
  fileName: string
): Promise<string> => {
  const filePath = `${userId}/${fileName}`

  const { data, error } = await supabase.storage
    .from('screenshots')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    console.error('Failed to upload screenshot:', error)
    throw new Error(error.message)
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('screenshots')
    .getPublicUrl(filePath)

  return publicUrl
}

/**
 * Insert screenshot metadata to database
 */
export const insertScreenshotMetadata = async (
  userId: string,
  organizationId: string,
  screenshotData: {
    screenshot_id: string
    file_path: string
    timestamp: string
    width?: number
    height?: number
    file_size?: number
    caption?: string
    detected_category?: string
    storage_url?: string
  }
) => {
  const { data, error } = await supabase.rpc('insert_screenshot', {
    p_user_id: userId,
    p_organization_id: organizationId,
    p_screenshot_id: screenshotData.screenshot_id,
    p_file_path: screenshotData.file_path,
    p_timestamp: screenshotData.timestamp,
    p_width: screenshotData.width,
    p_height: screenshotData.height,
    p_file_size: screenshotData.file_size,
    p_caption: screenshotData.caption,
    p_detected_category: screenshotData.detected_category,
    p_storage_url: screenshotData.storage_url
  })

  if (error) {
    console.error('Failed to insert screenshot metadata:', error)
    throw new Error(error.message)
  }

  return data
}

/**
 * Subscribe to screenshot changes in real-time
 */
export const subscribeToScreenshots = (
  organizationId: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel('screenshots')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'screenshots',
        filter: `organization_id=eq.${organizationId}`
      },
      callback
    )
    .subscribe()
}

/**
 * Subscribe to employee analytics changes in real-time
 */
export const subscribeToEmployeeAnalytics = (
  organizationId: string,
  callback: (payload: any) => void
) => {
  return supabase
    .channel('employee_analytics')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'employee_analytics',
        filter: `organization_id=eq.${organizationId}`
      },
      callback
    )
    .subscribe()
}

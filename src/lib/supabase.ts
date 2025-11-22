/**
 * ============================================================================
 * SUPABASE CLIENT - MISSING RPC FUNCTIONS & BATCH SYNC
 * ============================================================================
 * 
 * CRITICAL MISSING FUNCTIONS:
 * 1. get_employee_analytics RPC - Needed for PerformancePage.tsx
 * 2. get_company_analytics RPC - Needed for CompanyInsights.tsx (production only)
 * 3. Batch screenshot insert - Screenshots sync one-at-a-time (very slow)
 * 4. Real-time subscription helpers - No built-in realtime setup
 * 5. Screenshot image upload to storage - Only metadata saved to DB
 * 
 * ISSUES:
 * 1. PerformancePage expects getEmployeeAnalytics() to return data from RPC
 * 2. If RPC doesn't exist, page shows "No data available"
 * 3. Screenshots synced individually, not in batch (inefficient)
 * 4. No pagination for screenshot queries
 * 5. No built-in error recovery for sync failures
 * 6. Storage uploads not handled by Supabase helper functions
 * 
 * SOLUTIONS - ADD MISSING RPC FUNCTIONS:
 * 
 *   // Create in Supabase SQL Editor:
 * 
 *   CREATE OR REPLACE FUNCTION get_employee_analytics(p_employee_id UUID)
 *   RETURNS json AS $$
 *   DECLARE
 *     v_total_screenshots INTEGER;
 *     v_category_breakdown JSON;
 *     v_timeline JSON;
 *     v_most_used_category TEXT;
 *   BEGIN
 *     SELECT COUNT(*) INTO v_total_screenshots
 *     FROM screenshots
 *     WHERE employee_id = p_employee_id;
 * 
 *     SELECT json_object_agg(
 *       COALESCE(detected_category, 'other'),
 *       json_build_object(
 *         'count', COUNT(*),
 *         'percentage', ROUND(COUNT(*)::NUMERIC / v_total_screenshots * 100, 2)
 *       )
 *     ) INTO v_category_breakdown
 *     FROM screenshots
 *     WHERE employee_id = p_employee_id
 *     GROUP BY detected_category;
 * 
 *     SELECT json_agg(
 *       json_build_object(
 *         'date', DATE(timestamp),
 *         'screenshots', COUNT(*),
 *         'most_used', MODE() WITHIN GROUP (ORDER BY detected_category)
 *       ) ORDER BY DATE(timestamp)
 *     ) INTO v_timeline
 *     FROM screenshots
 *     WHERE employee_id = p_employee_id
 *     GROUP BY DATE(timestamp);
 * 
 *     SELECT detected_category INTO v_most_used_category
 *     FROM screenshots
 *     WHERE employee_id = p_employee_id
 *     GROUP BY detected_category
 *     ORDER BY COUNT(*) DESC
 *     LIMIT 1;
 * 
 *     RETURN json_build_object(
 *       'total_screenshots', v_total_screenshots,
 *       'category_breakdown', v_category_breakdown,
 *       'timeline', v_timeline,
 *       'most_used_category', v_most_used_category
 *     );
 *   END;
 *   $$ LANGUAGE plpgsql SECURITY DEFINER;
 * 
 *   -- RLS Policy
 *   CREATE POLICY employee_can_view_own_analytics ON screenshots
 *   FOR SELECT TO authenticated
 *   USING (
 *     employee_id = auth.uid() OR
 *     organization_id IN (
 *       SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'employer'
 *     )
 *   );
 * 
 * SOLUTIONS - ADD BATCH SCREENSHOT SYNC:
 * 
 *   // Add to supabase.ts:
 *   export const batchSyncScreenshots = async (
 *     screenshots: Array<{
 *       id: string;
 *       employee_id: string;
 *       organization_id: string;
 *       file_url: string;
 *       timestamp: string;
 *       caption: string;
 *       detected_category: string;
 *     }>
 *   ) => {
 *     try {
 *       const { error } = await supabase
 *         .from('screenshots')
 *         .insert(screenshots);
 * 
 *       if (error) throw error;
 *       console.log(`[Supabase] Synced ${screenshots.length} screenshots in batch`);
 *     } catch (error) {
 *       console.error('[Supabase] Batch sync failed:', error);
 *       throw error;
 *     }
 *   };
 * 
 * SOLUTIONS - ADD REAL-TIME SUBSCRIPTIONS:
 * 
 *   export const subscribeToEmployeeScreenshots = (
 *     employeeId: string,
 *     callback: (payload: any) => void
 *   ) => {
 *     return supabase
 *       .from(`screenshots:employee_id=eq.${employeeId}`)
 *       .on('*', (payload) => {
 *         console.log('[Supabase] Screenshot change:', payload.eventType);
 *         callback(payload);
 *       })
 *       .subscribe();
 *   };
 * 
 *   export const subscribeToAnalytics = (
 *     employeeId: string,
 *     callback: (data: any) => void
 *   ) => {
 *     const subscription = supabase
 *       .from('screenshots')
 *       .on('INSERT', (payload) => {
 *         if (payload.new.employee_id === employeeId) {
 *           callback(payload.new);
 *         }
 *       })
 *       .subscribe();
 *     
 *     return () => subscription.unsubscribe();
 *   };
 * 
 * SOLUTIONS - ADD SCREENSHOT UPLOAD TO STORAGE:
 * 
 *   export const uploadScreenshotImage = async (
 *     file: Blob,
 *     path: string  // e.g., "screenshots/{userId}/{screenshotId}.png"
 *   ) => {
 *     const { data, error } = await supabase.storage
 *       .from('screenshots')
 *       .upload(path, file, {
 *         cacheControl: '3600',
 *         upsert: false,
 *       });
 * 
 *     if (error) throw error;
 *     return supabase.storage.from('screenshots').getPublicUrl(path);
 *   };
 * 
 * MISSING FEATURE - CASCADE DELETE & BATCH DELETE:
 * 
 * CASCADE DELETE ISSUE:
 * 1. Screenshots table has no cascade rules - orphaned records if employee deleted
 * 2. No audit trail when screenshots are deleted
 * 3. Supabase storage not cleaned up automatically
 * 
 * SOLUTION - Add CASCADE DELETE:
 *   ALTER TABLE screenshots ADD CONSTRAINT screenshots_employee_id_fkey
 *     FOREIGN KEY (employee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
 * 
 *   ALTER TABLE screenshots ADD CONSTRAINT screenshots_organization_id_fkey
 *     FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
 * 
 * BATCH DELETE ISSUE:
 * 1. WorkflowsPage.tsx only handles single delete operations
 * 2. Deleting multiple screenshots requires individual API calls
 * 3. No transactional safety if some deletes fail
 * 4. Storage cleanup not coordinated with DB deletion
 * 
 * SOLUTION - Add batchDeleteScreenshots function:
 *   export const batchDeleteScreenshots = async (
 *     screenshotIds: string[],
 *     employeeId: string,
 *     storagePaths: string[]
 *   ) => {
 *     try {
 *       const { error } = await supabase
 *         .from('screenshots')
 *         .delete()
 *         .eq('employee_id', employeeId)
 *         .in('id', screenshotIds);
 * 
 *       if (error) throw error;
 * 
 *       for (const path of storagePaths) {
 *         await supabase.storage.from('screenshots').remove([path]);
 *       }
 *     } catch (error) {
 *       console.error('[Supabase] Batch delete failed:', error);
 *       throw error;
 *     }
 *   };
 * ============================================================================
 */

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

/**
 * Get company-wide analytics for employer dashboard
 * 
 * PRODUCTION/ACTUAL DATA FLOW:
 * =============================
 * 1. AUTHENTICATION: Uses Supabase JWT token from current authenticated session
 *    - Token is automatically included in all requests via @supabase/supabase-js client
 *    - Supabase verifies token validity before processing RPC call
 * 
 * 2. RPC CALL: Makes PostgreSQL Remote Procedure Call to Supabase backend:
 *    - Function name: get_company_analytics
 *    - Parameter: p_employer_id (UUID of the employer/organization)
 *    
 * 3. BACKEND VERIFICATION (in PostgreSQL):
 *    - Checks auth.uid() is not NULL (user must be authenticated)
 *    - Verifies auth.uid() has role = 'employer'
 *    - Verifies p_employer_id matches user's organization_id (prevent cross-org access)
 *    - Enforces Row Level Security (RLS) policies
 * 
 * 4. DATA AGGREGATION (PostgreSQL queries):
 *    - COUNT(DISTINCT employee_id) WHERE organization_id = p_employer_id
 *    - COUNT(*) of screenshots for this organization
 *    - GROUP BY software_category to get category breakdown
 *    - Calculate percentage and employee count per category
 *    - Query activity timeline (last 7-30 days)
 *    - Rank employees by screenshot count
 * 
 * 5. RETURN: Structured JSON object matching CompanyAnalytics interface
 *    - Returns only data the employer is authorized to see (their organization only)
 * 
 * SECURITY NOTES:
 * - Employer can ONLY see analytics for their own organization (verified in RLS policy)
 * - Employee cannot access this function (role check fails)
 * - All queries filtered by organization_id to prevent data leaks
 * - Session token expires after configured time (default 24 hours)
 */
export const getCompanyAnalytics = async (employerId: string) => {
  /* ACTUAL PRODUCTION CALL:
   * Makes authenticated RPC request to Supabase PostgreSQL function
   */
  const { data, error } = await supabase.rpc('get_company_analytics', {
    p_employer_id: employerId
  })

  if (error) {
    console.error('Failed to get company analytics:', error)
    throw new Error(error.message)
  }

  return data
}

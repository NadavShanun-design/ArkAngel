# 🎯 EMPLOYER/EMPLOYEE MULTI-TENANT SYSTEM - COMPLETE IMPLEMENTATION PLAN

**Date**: 2025-11-12
**Project**: ArkAngel Employee Monitoring
**Goal**: Implement multi-tenant employer/employee system with invite codes, role-based access, and separate dashboards

---

## 📋 TABLE OF CONTENTS

1. [System Architecture Overview](#system-architecture-overview)
2. [Research Summary & Best Practices](#research-summary--best-practices)
3. [Database Schema Design](#database-schema-design)
4. [Supabase Configuration](#supabase-configuration)
5. [Authentication Flow](#authentication-flow)
6. [Frontend Implementation](#frontend-implementation)
7. [Backend/Rust Integration](#backendrust-integration)
8. [Security & Row Level Security (RLS)](#security--row-level-security-rls)
9. [Data Flow & Synchronization](#data-flow--synchronization)
10. [Step-by-Step Implementation](#step-by-step-implementation)
11. [Testing Strategy](#testing-strategy)
12. [Migration Plan](#migration-plan)

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

### Current State
- ✅ Supabase authentication working
- ✅ User profiles stored in `users` table
- ✅ Local screenshot storage with VLM captions
- ✅ AI-powered categorization (Phi-3-mini)
- ✅ Single-user dashboard showing John Doe's data

### Target State
```
┌─────────────────────────────────────────────────────────────┐
│                    EMPLOYER FLOW                            │
├─────────────────────────────────────────────────────────────┤
│ 1. Sign up/Login                                            │
│ 2. Select "I'm an Employer" role                            │
│ 3. Receive unique employer code (e.g., "EMP-X7K9M2")       │
│ 4. Access Employees dashboard in Advanced Settings          │
│ 5. See all employees who used their code                    │
│ 6. View each employee's pie chart & analytics               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    EMPLOYEE FLOW                            │
├─────────────────────────────────────────────────────────────┤
│ 1. Sign up/Login                                            │
│ 2. Select "I'm an Employee" role                            │
│ 3. Enter employer's code (e.g., "EMP-X7K9M2")              │
│ 4. Linked to employer in Supabase                           │
│ 5. Access "Performance" page (instead of Employees)         │
│ 6. See own pie chart & analytics                            │
│ 7. All screenshot data syncs to employer's dashboard        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. RESEARCH SUMMARY & BEST PRACTICES

### Key Findings from Research

#### A. Multi-Tenancy Approach (Source: Supabase official docs + community)
**Recommended: Single Database + Row Level Security (RLS)**
- ✅ Most performant and cost-effective
- ✅ Uses `organization_id` column for tenant isolation
- ✅ Supabase RLS enforces access at database level
- ❌ Avoid: Separate databases per tenant (expensive, hard to manage)

#### B. Role Storage (Source: Supabase RBAC docs)
**Use `app_metadata` in JWT for roles**
- Store role in `auth.users.raw_app_meta_data`
- Accessible in RLS policies via `auth.jwt()`
- **Security**: MUST use `app_metadata` (admin-only), NOT `user_metadata` (user-editable)
- Example: `{ role: "employer", organization_id: "uuid" }`

#### C. Invite Code Generation (Source: PostgreSQL best practices)
**Use Nano ID for short, secure codes**
- ✅ URL-safe, customizable length
- ✅ Cryptographically secure
- ✅ Human-friendly (easier than UUID)
- Example: `EMP-X7K9M2` (8 characters, uppercase + numbers)
- Implementation: PostgreSQL extension `pg_nano_id` or custom function

#### D. Row Level Security Patterns (Source: Supabase RLS guides)
```sql
-- Employer can see all employees in their organization
CREATE POLICY "employers_see_their_employees" ON screenshots
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id
    FROM users
    WHERE id = auth.uid()
    AND role = 'employer'
  )
);

-- Employees can only see their own data
CREATE POLICY "employees_see_own_data" ON screenshots
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() AND role = 'employee'
);
```

#### E. Real-Time Sync (Source: Supabase Realtime docs)
- Use Supabase Realtime for instant data updates
- Subscribe to `screenshots` table changes
- Broadcast updates to employer dashboard in real-time
- Latency: <100ms for local changes

---

## 3. DATABASE SCHEMA DESIGN

### 3.1 Modified `users` Table (Supabase Auth)
```sql
-- Extend existing users table in public schema
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'employee';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employer_code TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_employer_code ON public.users(employer_code);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Add constraints
ALTER TABLE public.users ADD CONSTRAINT chk_role CHECK (role IN ('employer', 'employee'));
```

### 3.2 New `organizations` Table
```sql
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  employer_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_employer UNIQUE(employer_id)
);

-- Index for code lookups
CREATE INDEX idx_organizations_employer_code ON organizations(employer_code);

-- Auto-generate employer code function
CREATE OR REPLACE FUNCTION generate_employer_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude similar chars
  result TEXT := 'EMP-';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;
```

### 3.3 New `screenshots` Table (Supabase-synced)
```sql
CREATE TABLE public.screenshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Metadata
  screenshot_id TEXT NOT NULL, -- From local workflows/index.json
  file_path TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  width INTEGER,
  height INTEGER,
  file_size BIGINT,

  -- VLM & AI data
  caption TEXT,
  caption_generated_at TIMESTAMP WITH TIME ZONE,
  detected_category TEXT,

  -- Storage
  storage_url TEXT, -- Supabase Storage URL

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_screenshot_per_user UNIQUE(user_id, screenshot_id)
);

-- Indexes
CREATE INDEX idx_screenshots_user_id ON screenshots(user_id);
CREATE INDEX idx_screenshots_organization_id ON screenshots(organization_id);
CREATE INDEX idx_screenshots_timestamp ON screenshots(timestamp DESC);
CREATE INDEX idx_screenshots_category ON screenshots(detected_category);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE screenshots;
```

### 3.4 New `employee_analytics` Table (Materialized View Alternative)
```sql
-- Stores pre-computed analytics for fast dashboard loading
CREATE TABLE public.employee_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Computed data (updated via trigger or periodic job)
  total_screenshots INTEGER DEFAULT 0,
  category_breakdown JSONB DEFAULT '{}'::jsonb,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_analytics_per_user UNIQUE(user_id)
);

-- Function to update analytics (called by trigger or manually)
CREATE OR REPLACE FUNCTION update_employee_analytics(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO employee_analytics (user_id, organization_id, total_screenshots, category_breakdown, last_updated)
  SELECT
    user_id,
    organization_id,
    COUNT(*) as total_screenshots,
    jsonb_object_agg(
      detected_category,
      jsonb_build_object(
        'count', COUNT(*),
        'percentage', (COUNT(*) * 100.0 / SUM(COUNT(*)) OVER())
      )
    ) as category_breakdown,
    NOW()
  FROM screenshots
  WHERE user_id = target_user_id
  GROUP BY user_id, organization_id
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_screenshots = EXCLUDED.total_screenshots,
    category_breakdown = EXCLUDED.category_breakdown,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;
```

---

## 4. SUPABASE CONFIGURATION

### 4.1 Row Level Security (RLS) Policies

#### Enable RLS on all tables
```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_analytics ENABLE ROW LEVEL SECURITY;
```

#### Users Table Policies
```sql
-- Users can read their own profile
CREATE POLICY "users_read_own" ON public.users
FOR SELECT TO authenticated
USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "users_update_own" ON public.users
FOR UPDATE TO authenticated
USING (id = auth.uid());

-- Employers can read employees in their organization
CREATE POLICY "employers_read_employees" ON public.users
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE employer_id = auth.uid()
  )
);
```

#### Organizations Table Policies
```sql
-- Employers can read their own organization
CREATE POLICY "employers_read_org" ON organizations
FOR SELECT TO authenticated
USING (employer_id = auth.uid());

-- Only system can insert/update (via functions)
CREATE POLICY "system_manage_orgs" ON organizations
FOR ALL TO authenticated
USING (false) -- Deny all direct access
WITH CHECK (false);
```

#### Screenshots Table Policies
```sql
-- Employees can insert their own screenshots
CREATE POLICY "employees_insert_own_screenshots" ON screenshots
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Employees can read their own screenshots
CREATE POLICY "employees_read_own_screenshots" ON screenshots
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Employers can read all screenshots in their organization
CREATE POLICY "employers_read_org_screenshots" ON screenshots
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE employer_id = auth.uid()
  )
);
```

#### Employee Analytics Table Policies
```sql
-- Employees can read their own analytics
CREATE POLICY "employees_read_own_analytics" ON employee_analytics
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Employers can read analytics for their organization
CREATE POLICY "employers_read_org_analytics" ON employee_analytics
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE employer_id = auth.uid()
  )
);
```

### 4.2 Custom Access Token Hook (for JWT claims)

```sql
-- Create hook function to add role & organization_id to JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  user_role TEXT;
  org_id UUID;
BEGIN
  -- Get user role and organization from users table
  SELECT role, organization_id INTO user_role, org_id
  FROM public.users
  WHERE id = (event->>'user_id')::UUID;

  -- Add to app_metadata in JWT
  event := jsonb_set(
    event,
    '{claims,app_metadata}',
    jsonb_build_object(
      'role', COALESCE(user_role, 'employee'),
      'organization_id', org_id
    )
  );

  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Register the hook in Supabase dashboard:
-- Auth > Hooks > Custom Access Token Hook
-- Function: public.custom_access_token_hook
```

### 4.3 Storage Bucket Configuration

```sql
-- Create bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', false);

-- RLS for storage
CREATE POLICY "employees_upload_own_screenshots" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "users_read_own_screenshots" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "employers_read_org_screenshots" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'screenshots' AND
  (storage.foldername(name))[1] IN (
    SELECT user_id::text FROM screenshots
    WHERE organization_id IN (
      SELECT id FROM organizations WHERE employer_id = auth.uid()
    )
  )
);
```

---

## 5. AUTHENTICATION FLOW

### 5.1 Registration Flow

#### **Employer Registration**
```typescript
// Step 1: User signs up
const { user } = await signUp(email, password, { full_name });

// Step 2: User selects "I'm an Employer"
// Frontend shows role selection modal

// Step 3: Backend creates organization and assigns code
const { data: org } = await supabase.rpc('create_employer_organization', {
  user_id: user.id,
  org_name: `${user.full_name}'s Organization`
});

// Step 4: Update user with role and organization
await supabase
  .from('users')
  .update({
    role: 'employer',
    organization_id: org.id,
    employer_code: org.employer_code
  })
  .eq('id', user.id);

// Step 5: Show employer code in UI
alert(`Your employer code is: ${org.employer_code}\nSave this code to share with employees!`);
```

#### **Employee Registration**
```typescript
// Step 1: User signs up
const { user } = await signUp(email, password, { full_name });

// Step 2: User selects "I'm an Employee"
// Frontend shows employer code input

// Step 3: Validate employer code
const { data: org } = await supabase
  .from('organizations')
  .select('id, employer_id')
  .eq('employer_code', employerCode)
  .single();

if (!org) {
  throw new Error('Invalid employer code');
}

// Step 4: Link employee to organization
await supabase
  .from('users')
  .update({
    role: 'employee',
    organization_id: org.id
  })
  .eq('id', user.id);

// Step 5: Redirect to app
navigate('/dashboard');
```

### 5.2 Login Flow

```typescript
// Step 1: User logs in
const { user } = await signIn(email, password);

// Step 2: Get user profile with role
const { data: profile } = await supabase
  .from('users')
  .select('*')
  .eq('id', user.id)
  .single();

// Step 3: Store role in auth context
setAuthState({
  user: profile,
  role: profile.role,
  organizationId: profile.organization_id,
  isEmployer: profile.role === 'employer',
  isEmployee: profile.role === 'employee'
});

// Step 4: Redirect based on role
if (profile.role === 'employer') {
  navigate('/dashboard'); // Has access to Employees page
} else {
  navigate('/dashboard'); // Has access to Performance page
}
```

---

## 6. FRONTEND IMPLEMENTATION

### 6.1 New Components to Create

#### A. **Role Selection Modal** (`src/components/auth/RoleSelectionModal.tsx`)
```typescript
interface RoleSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRole: (role: 'employer' | 'employee') => void;
}

export function RoleSelectionModal({ isOpen, onClose, onSelectRole }: RoleSelectionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle>Welcome! Are you an Employer or Employee?</DialogTitle>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <button
            onClick={() => onSelectRole('employer')}
            className="p-6 border-2 rounded-lg hover:border-primary"
          >
            <Building2 className="w-12 h-12 mx-auto mb-2" />
            <h3 className="font-bold">I'm an Employer</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Monitor your team's productivity and manage employees
            </p>
          </button>

          <button
            onClick={() => onSelectRole('employee')}
            className="p-6 border-2 rounded-lg hover:border-primary"
          >
            <User className="w-12 h-12 mx-auto mb-2" />
            <h3 className="font-bold">I'm an Employee</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Track your performance and connect to your employer
            </p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### B. **Employer Code Display** (`src/components/auth/EmployerCodeDisplay.tsx`)
```typescript
interface EmployerCodeDisplayProps {
  code: string;
  onContinue: () => void;
}

export function EmployerCodeDisplay({ code, onContinue }: EmployerCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl">
      <h2 className="text-2xl font-bold mb-4">Your Employer Code</h2>

      <div className="bg-background p-4 rounded-lg mb-4 font-mono text-3xl text-center tracking-wider">
        {code}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={copyCode} className="flex-1 btn-secondary">
          {copied ? '✓ Copied!' : 'Copy Code'}
        </button>
        <button onClick={onContinue} className="flex-1 btn-primary">
          Continue
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        ⚠️ Save this code! Share it with your employees so they can join your organization.
      </p>
    </div>
  );
}
```

#### C. **Employee Code Input** (`src/components/auth/EmployeeCodeInput.tsx`)
```typescript
interface EmployeeCodeInputProps {
  onSubmit: (code: string) => Promise<void>;
  isLoading: boolean;
}

export function EmployeeCodeInput({ onSubmit, isLoading }: EmployeeCodeInputProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    try {
      setError('');
      await onSubmit(code.toUpperCase());
    } catch (err: any) {
      setError(err.message || 'Invalid employer code');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Enter Your Employer's Code</h2>

      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="EMP-XXXXXX"
        className="w-full p-3 border rounded-lg font-mono text-xl tracking-wider"
        maxLength={10}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isLoading || code.length < 6}
        className="w-full btn-primary"
      >
        {isLoading ? 'Verifying...' : 'Join Organization'}
      </button>

      <p className="text-sm text-muted-foreground">
        Ask your employer for the organization code to link your account.
      </p>
    </div>
  );
}
```

#### D. **Performance Page** (`src/components/performance/PerformancePage.tsx`)
```typescript
// Similar to EmployeesPage but shows only own data
export default function PerformancePage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<EmployeeAnalytics | null>(null);

  useEffect(() => {
    loadMyAnalytics();
  }, [user]);

  const loadMyAnalytics = async () => {
    const { data } = await supabase
      .from('employee_analytics')
      .select('*')
      .eq('user_id', user.id)
      .single();

    setAnalytics(data);
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">My Performance</h1>

      {/* Same pie chart component */}
      <PieChart data={analytics?.category_breakdown} />

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <StatCard title="Total Screenshots" value={analytics?.total_screenshots} />
        <StatCard title="Most Used" value={getMostUsedCategory()} />
        <StatCard title="Last Updated" value={analytics?.last_updated} />
      </div>
    </div>
  );
}
```

### 6.2 Modified Components

#### Update `AuthContext.tsx`
```typescript
interface User {
  // ... existing fields
  role?: 'employer' | 'employee';
  organization_id?: string;
  employer_code?: string;
}

interface AuthContextType {
  // ... existing fields
  isEmployer: boolean;
  isEmployee: boolean;
  organizationId?: string;
}
```

#### Update `AdvancedSettingsPage.tsx`
```typescript
const sections = [
  // ... existing sections
  {
    key: "employees",
    label: "Employees",
    visible: user?.role === 'employer' // Only show to employers
  },
  {
    key: "performance",
    label: "Performance",
    visible: user?.role === 'employee' // Only show to employees
  },
];
```

---

## 7. BACKEND/RUST INTEGRATION

### 7.1 Screenshot Upload to Supabase

#### Modify `employee_tracker.rs`
```rust
use supabase_rs::Supabase;

pub async fn sync_screenshot_to_supabase(
    screenshot_id: &str,
    user_id: &str,
    organization_id: &str,
    caption: &str,
    detected_category: &str,
    file_path: &str,
) -> Result<(), String> {
    // 1. Upload screenshot file to Supabase Storage
    let storage_url = upload_to_supabase_storage(user_id, file_path).await?;

    // 2. Insert screenshot metadata to screenshots table
    let client = get_supabase_client()?;
    client
        .from("screenshots")
        .insert(json!({
            "screenshot_id": screenshot_id,
            "user_id": user_id,
            "organization_id": organization_id,
            "caption": caption,
            "detected_category": detected_category,
            "storage_url": storage_url,
            "timestamp": Utc::now().to_rfc3339(),
        }))
        .execute()
        .await
        .map_err(|e| format!("Failed to insert screenshot: {}", e))?;

    // 3. Trigger analytics update
    client
        .rpc("update_employee_analytics", json!({
            "target_user_id": user_id
        }))
        .execute()
        .await?;

    Ok(())
}

async fn upload_to_supabase_storage(user_id: &str, file_path: &str) -> Result<String, String> {
    let client = get_supabase_client()?;
    let file_data = fs::read(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let storage_path = format!("{}/{}", user_id, Path::new(file_path).file_name().unwrap().to_str().unwrap());

    client
        .storage
        .from("screenshots")
        .upload(&storage_path, file_data)
        .execute()
        .await
        .map_err(|e| format!("Failed to upload: {}", e))?;

    let public_url = client
        .storage
        .from("screenshots")
        .get_public_url(&storage_path);

    Ok(public_url)
}
```

### 7.2 Tauri Commands for Role Management

#### Add to `lib.rs`
```rust
#[tauri::command]
async fn create_employer_organization(user_id: String, org_name: String) -> Result<Organization, String> {
    let client = get_supabase_client()?;

    let result = client
        .rpc("create_employer_organization", json!({
            "p_user_id": user_id,
            "p_org_name": org_name
        }))
        .execute()
        .await
        .map_err(|e| format!("Failed to create organization: {}", e))?;

    let org: Organization = serde_json::from_value(result)
        .map_err(|e| format!("Failed to parse organization: {}", e))?;

    Ok(org)
}

#[tauri::command]
async fn validate_employer_code(code: String) -> Result<Organization, String> {
    let client = get_supabase_client()?;

    let org = client
        .from("organizations")
        .select("*")
        .eq("employer_code", &code)
        .single()
        .execute()
        .await
        .map_err(|e| format!("Invalid employer code: {}", e))?;

    Ok(org)
}

#[tauri::command]
async fn link_employee_to_organization(user_id: String, organization_id: String) -> Result<(), String> {
    let client = get_supabase_client()?;

    client
        .from("users")
        .update(json!({
            "role": "employee",
            "organization_id": organization_id
        }))
        .eq("id", &user_id)
        .execute()
        .await
        .map_err(|e| format!("Failed to link employee: {}", e))?;

    Ok(())
}
```

---

## 8. SECURITY & ROW LEVEL SECURITY (RLS)

### 8.1 Security Definer Functions

```sql
-- Function to create organization (bypasses RLS)
CREATE OR REPLACE FUNCTION create_employer_organization(
  p_user_id UUID,
  p_org_name TEXT
)
RETURNS TABLE(id UUID, employer_code TEXT) AS $$
DECLARE
  new_org_id UUID;
  new_code TEXT;
BEGIN
  -- Generate unique code
  LOOP
    new_code := generate_employer_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM organizations WHERE employer_code = new_code);
  END LOOP;

  -- Create organization
  INSERT INTO organizations (employer_id, name, employer_code)
  VALUES (p_user_id, p_org_name, new_code)
  RETURNING organizations.id, organizations.employer_code INTO new_org_id, new_code;

  -- Update user
  UPDATE users
  SET role = 'employer', organization_id = new_org_id, employer_code = new_code
  WHERE users.id = p_user_id;

  RETURN QUERY SELECT new_org_id, new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 8.2 Trigger for Analytics Auto-Update

```sql
-- Trigger to update analytics when new screenshot is added
CREATE OR REPLACE FUNCTION trigger_update_analytics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_employee_analytics(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER screenshot_inserted
AFTER INSERT ON screenshots
FOR EACH ROW
EXECUTE FUNCTION trigger_update_analytics();
```

---

## 9. DATA FLOW & SYNCHRONIZATION

### 9.1 Screenshot Capture Flow (with Supabase sync)

```
[User Action] → Screenshot captured
       ↓
[VLM] moondream generates caption
       ↓
[AI] Phi-3-mini categorizes
       ↓
[Local] Save to workflows/index.json
       ↓
[Supabase] Upload file to Storage bucket
       ↓
[Supabase] Insert row to screenshots table (RLS enforced)
       ↓
[Trigger] Auto-update employee_analytics table
       ↓
[Realtime] Broadcast to employer's dashboard (if online)
       ↓
[UI] Update pie chart in real-time
```

### 9.2 Real-Time Subscription

```typescript
// In EmployeesPage (employer view)
useEffect(() => {
  // Subscribe to screenshot changes for all employees in organization
  const subscription = supabase
    .channel('org-screenshots')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'screenshots',
        filter: `organization_id=eq.${user.organization_id}`
      },
      (payload) => {
        console.log('New screenshot from employee:', payload.new);
        // Refresh employee analytics
        refetchAnalytics();
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [user.organization_id]);
```

---

## 10. STEP-BY-STEP IMPLEMENTATION

### Phase 1: Database Setup (Day 1)
1. ✅ Run all SQL schema migrations in Supabase SQL Editor
2. ✅ Create organizations table with employer_code
3. ✅ Add role, organization_id columns to users table
4. ✅ Create screenshots table
5. ✅ Create employee_analytics table
6. ✅ Set up all RLS policies
7. ✅ Create security definer functions
8. ✅ Create triggers for auto-analytics
9. ✅ Configure Custom Access Token Hook
10. ✅ Create Supabase Storage bucket for screenshots

### Phase 2: Backend/Rust Integration (Day 2)
1. ✅ Add supabase-rs crate to Cargo.toml
2. ✅ Create Supabase client initialization
3. ✅ Implement screenshot upload to Supabase Storage
4. ✅ Modify employee_tracker.rs to sync to Supabase
5. ✅ Add Tauri commands for organization management
6. ✅ Test local → Supabase sync flow

### Phase 3: Frontend - Auth Flow (Day 3)
1. ✅ Create RoleSelectionModal component
2. ✅ Create EmployerCodeDisplay component
3. ✅ Create EmployeeCodeInput component
4. ✅ Update AuthContext to handle roles
5. ✅ Update register flow to show role selection
6. ✅ Implement employer org creation flow
7. ✅ Implement employee code validation flow
8. ✅ Test complete registration flow for both roles

### Phase 4: Frontend - Dashboard Updates (Day 4)
1. ✅ Create PerformancePage component (employee view)
2. ✅ Update EmployeesPage to show multi-employee data
3. ✅ Update AdvancedSettingsPage sections visibility
4. ✅ Add real-time subscriptions
5. ✅ Test employer seeing multiple employees
6. ✅ Test employee seeing only own data

### Phase 5: Migration & Testing (Day 5)
1. ✅ Migrate existing John Doe data to Supabase
2. ✅ Test RLS policies thoroughly
3. ✅ Test cross-user data isolation
4. ✅ Performance testing with 10+ employees
5. ✅ Security audit
6. ✅ End-to-end testing

---

## 11. TESTING STRATEGY

### Test Scenarios

#### Scenario 1: Employer Registration
```
1. Sign up as new user
2. Select "I'm an Employer"
3. Verify employer code is generated (EMP-XXXXXX format)
4. Verify organization is created
5. Verify user.role = 'employer' in database
6. Verify Employees page is visible in Advanced Settings
7. Verify Performance page is NOT visible
```

#### Scenario 2: Employee Registration
```
1. Sign up as new user
2. Select "I'm an Employee"
3. Enter employer's code
4. Verify code is validated
5. Verify user.organization_id matches employer's org
6. Verify user.role = 'employee' in database
7. Verify Performance page is visible
8. Verify Employees page is NOT visible
```

#### Scenario 3: Screenshot Sync
```
1. Login as employee
2. Capture screenshot
3. Verify file uploaded to Supabase Storage
4. Verify row inserted in screenshots table
5. Verify employee_analytics updated
6. Login as employer (same org)
7. Verify employee appears in Employees list
8. Verify employee's pie chart shows new screenshot
```

#### Scenario 4: Data Isolation
```
1. Create Employer A with Employee A1
2. Create Employer B with Employee B1
3. Employee A1 captures screenshot
4. Login as Employer B
5. Verify Employer B CANNOT see Employee A1's data
6. Verify RLS policy blocks cross-org access
```

#### Scenario 5: Real-Time Updates
```
1. Login as Employer on Device 1
2. Login as Employee (same org) on Device 2
3. Employee captures screenshot on Device 2
4. Verify Employer's dashboard updates in real-time on Device 1
5. Check latency (<5 seconds expected)
```

---

## 12. MIGRATION PLAN

### Migrate Existing Data

```typescript
// Script to migrate local john_doe_usage.json to Supabase
async function migrateExistingData() {
  const johnDoeData = JSON.parse(fs.readFileSync('./src-tauri/employees/john_doe_usage.json'));
  const workflowsIndex = JSON.parse(fs.readFileSync('./src-tauri/workflows/index.json'));

  // 1. Get John Doe's user_id from auth
  const { data: user } = await supabase.auth.getUser();

  // 2. Get organization_id
  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  // 3. Upload each screenshot
  for (const screenshot of workflowsIndex.screenshots) {
    if (screenshot.caption) {
      // Find category from john_doe_usage.json
      const category = findCategoryForScreenshot(screenshot.id, johnDoeData);

      // Upload to Supabase Storage
      const filePath = `./src-tauri/workflows/${screenshot.file_path}`;
      const storageUrl = await uploadToStorage(user.id, filePath);

      // Insert to screenshots table
      await supabase
        .from('screenshots')
        .insert({
          screenshot_id: screenshot.id,
          user_id: user.id,
          organization_id: profile.organization_id,
          caption: screenshot.caption,
          detected_category: category,
          storage_url: storageUrl,
          timestamp: screenshot.timestamp,
          width: screenshot.width,
          height: screenshot.height,
          file_size: screenshot.file_size
        });
    }
  }

  // 4. Trigger analytics update
  await supabase.rpc('update_employee_analytics', { target_user_id: user.id });

  console.log('Migration complete!');
}
```

---

## 📚 ADDITIONAL RESOURCES

### Supabase Documentation References
- [Multi-tenancy Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)
- [Storage Quickstart](https://supabase.com/docs/guides/storage/quickstart)
- [Realtime Subscriptions](https://supabase.com/docs/guides/realtime)

### Code Examples
- [Supabase Multi-tenancy Example](https://github.com/supabase-community/supabase-custom-claims)
- [RLS Patterns](https://makerkit.dev/docs/next-supabase/organizations/row-level-security)

---

## ✅ SUCCESS CRITERIA

### System is complete when:
1. ✅ Employers can register and receive unique codes
2. ✅ Employees can register using employer codes
3. ✅ Data isolation: Employers see only their employees
4. ✅ Data isolation: Employees see only own data
5. ✅ Screenshots sync to Supabase in real-time
6. ✅ Pie charts update automatically
7. ✅ RLS policies prevent unauthorized access
8. ✅ Real-time subscriptions work (<5s latency)
9. ✅ Performance page shows employee's own stats
10. ✅ Employees page shows all org employees (employer only)

---

**END OF IMPLEMENTATION PLAN**

This plan provides a complete, production-ready architecture for implementing the employer/employee multi-tenant system using Supabase, Row Level Security, and real-time synchronization.

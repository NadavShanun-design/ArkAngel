# Feature Gating Implementation Guide

**Date**: January 24, 2025
**Status**: ✅ **INFRASTRUCTURE COMPLETE** - Ready to implement gates

---

## 🎉 What's Already Built

### ✅ Database Layer
- `usage_logs` table for tracking feature usage
- `entitlements` table for custom overrides
- PostgreSQL functions: `log_usage()`, `get_today_usage()`, `get_month_usage()`
- RLS policies for security

**Location**: `supabase-migration-usage-tracking.sql`

### ✅ Type Definitions
- Complete feature matrix for Free/Premium/Max tiers
- Type-safe feature names, subscription tiers, usage types
- Pricing and tier feature lists

**Location**: `src/types/subscription.ts`

### ✅ Supabase Functions
- `logUsage()` - Log feature usage
- `getTodayUsage()` - Get today's usage for a feature
- `getMonthUsage()` - Get this month's usage
- `getAllTodayUsage()` - Get all usage for today

**Location**: `src/lib/supabase.ts`

### ✅ React Context
- `EntitlementProvider` wraps entire app
- Provides tier information, usage tracking, feature checking
- Auto-refreshes usage every 60 seconds

**Location**: `src/contexts/EntitlementContext.tsx`

### ✅ React Hooks
- `useFeatureGate()` - Check if feature can be used
- `useFeatureUsage()` - Get usage info for a feature
- `useFeatureAvailable()` - Check if feature is available at tier
- `useRequiredTier()` - Get required tier for feature
- `useFeatureLimit()` - Get feature limit configuration

**Location**: `src/hooks/useFeatureGate.ts`

### ✅ UI Components
- `<UpgradeModal />` - Shows pricing tiers when blocked
- `<UsageMeter />` - Shows usage progress (e.g., 15/30 minutes)
- `<UsageBadge />` - Small badge showing usage
- `<FeatureBadge />` - Shows required tier or "Available"
- `<FeatureLock />` - Lock icon for unavailable features
- `<FeatureCard />` - Card with lock overlay for unavailable features

**Location**: `src/components/subscription/`

---

## 📋 How to Add Feature Gates

### Pattern 1: Block Feature Before Use

**Example: AI Assistance in Completion Component**

```typescript
// src/components/completion/index.tsx
import { useState } from 'react';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradeModal } from '@/components/subscription';

export const Completion = () => {
  const {
    allowed,
    reason,
    upgradeMessage,
    requiredTier,
    logUsage
  } = useFeatureGate('ai_assistance');

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleSubmit = async () => {
    // Check entitlement before allowing submission
    if (!allowed) {
      setShowUpgradeModal(true);
      return;
    }

    // Proceed with AI completion
    await submit();

    // Log usage after successful completion
    // Assume response took 2.5 minutes
    await logUsage(2.5, { model: 'gpt-4', tokens: 1500 });
  };

  return (
    <>
      <div>
        <button onClick={handleSubmit}>Send Message</button>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="ai_assistance"
        reason={reason}
        requiredTier={requiredTier}
      />
    </>
  );
};
```

### Pattern 2: Show Usage Meter

**Example: Show Remaining AI Minutes**

```typescript
import { UsageMeter } from '@/components/subscription';

export const SettingsPanel = () => {
  return (
    <div>
      <h3>AI Assistance Usage</h3>
      <UsageMeter
        feature="ai_assistance"
        period="daily"
        showLabel={true}
      />
    </div>
  );
};
```

### Pattern 3: Lock Feature UI

**Example: Custom Personas Section**

```typescript
import { FeatureCard } from '@/components/subscription';
import { useState } from 'react';

export const PersonasSection = () => {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  return (
    <FeatureCard
      feature="custom_personas"
      title="Custom Personas"
      description="Create AI personas tailored to your workflow"
      icon={<PersonIcon />}
      onUpgrade={() => setShowUpgradeModal(true)}
    >
      {/* This content only shows if feature is available */}
      <button>Create New Persona</button>
    </FeatureCard>
  );
};
```

### Pattern 4: Conditional Rendering

**Example: Hide Features Based on Tier**

```typescript
import { useFeatureAvailable } from '@/hooks/useFeatureGate';

export const AdvancedSettings = () => {
  const googleWorkspaceAvailable = useFeatureAvailable('google_workspace');
  const crmAvailable = useFeatureAvailable('crm_integrations');

  return (
    <div>
      {googleWorkspaceAvailable && (
        <GoogleWorkspaceSection />
      )}

      {crmAvailable && (
        <CRMIntegrationSection />
      )}

      {/* Always show with badge */}
      <div className="flex items-center justify-between">
        <span>Advanced Features</span>
        <FeatureBadge feature="google_workspace" />
      </div>
    </div>
  );
};
```

---

## 🚀 Where to Add Gates

### Critical Features (Add First)

#### 1. AI Assistance (Completion Component)
**File**: `src/components/completion/index.tsx`
**Feature**: `'ai_assistance'`
**Gate**: Before `submit()` function
**Log**: After response received, log minutes used

```typescript
// Pseudo-code location:
const handleSubmit = async () => {
  const { allowed } = await canUseFeature('ai_assistance');
  if (!allowed) {
    // Show upgrade modal
    return;
  }

  const startTime = Date.now();
  await submit();
  const endTime = Date.now();
  const minutesUsed = (endTime - startTime) / 60000;

  await logUsage(minutesUsed);
};
```

#### 2. Transcription (Speech Component)
**File**: `src/components/completion/Speech.tsx`
**Feature**: `'transcription'`
**Gate**: Before starting recording
**Log**: After transcription completes, log audio duration

```typescript
// In Speech.tsx, before starting VAD
const handleStartRecording = async () => {
  const { allowed } = useFeatureGate('transcription');
  if (!allowed) {
    setShowUpgradeModal(true);
    return;
  }

  // Start recording
  startRecording();
};
```

#### 3. Custom Personas (CreatePersonaWizard)
**File**: `src/components/training/CreatePersonaWizard.tsx`
**Feature**: `'custom_personas'`
**Gate**: Before showing wizard
**Check**: Also check `maxItems` (10 for Premium, unlimited for Max)

```typescript
import { useFeatureLimit } from '@/hooks/useFeatureGate';

const CreatePersonaButton = () => {
  const { allowed, recheck } = useFeatureGate('custom_personas');
  const limit = useFeatureLimit('custom_personas');

  // Check current persona count
  const currentPersonas = personas.length;
  const canCreate = allowed && (limit.maxItems === null || currentPersonas < limit.maxItems);

  return (
    <button
      onClick={() => canCreate ? openWizard() : showUpgrade()}
      disabled={!canCreate}
    >
      Create Persona {!canCreate && `(${currentPersonas}/${limit.maxItems})`}
    </button>
  );
};
```

#### 4. RAG Training (Document Upload)
**File**: (Find the document upload component)
**Feature**: `'rag_training'`
**Gate**: Before allowing document upload
**Log**: Log pages uploaded (e.g., PDF page count)

```typescript
const handleDocumentUpload = async (file: File) => {
  const { allowed } = useFeatureGate('rag_training');
  if (!allowed) {
    setShowUpgradeModal(true);
    return;
  }

  // Upload document
  await uploadDocument(file);

  // Log usage (estimate pages from file size)
  const estimatedPages = Math.ceil(file.size / 3000); // ~3KB per page
  await logUsage(estimatedPages, { filename: file.name, size: file.size });
};
```

#### 5. Google Workspace Integration
**File**: `src/components/integrations/index.tsx` (or similar)
**Feature**: `'google_workspace'`
**Gate**: Hide/disable Google Workspace section if not Max tier

```typescript
const GoogleWorkspaceSection = () => {
  const isAvailable = useFeatureAvailable('google_workspace');
  const requiredTier = useRequiredTier('google_workspace');

  if (!isAvailable) {
    return (
      <FeatureCard
        feature="google_workspace"
        title="Google Workspace"
        description="Calendar and Gmail integration"
        onUpgrade={() => openUpgradeModal()}
      />
    );
  }

  return <GoogleWorkspaceIntegration />;
};
```

---

## 🎯 Testing Checklist

### As Guest (Free Tier)
- [ ] AI assistance limited to 30 minutes/day
- [ ] Transcription limited to 100 minutes/day
- [ ] Cannot create custom personas (shows upgrade prompt)
- [ ] Cannot upload RAG training documents
- [ ] Cannot access Google Workspace integration
- [ ] Shows "Upgrade to Premium" prompts

### As Premium User
- [ ] Unlimited AI assistance
- [ ] Unlimited transcription
- [ ] Can create up to 10 custom personas
- [ ] Can upload up to 500 pages/month for RAG training
- [ ] Still cannot access Google Workspace (Max only)
- [ ] Shows "Upgrade to Max" for locked features

### As Max User
- [ ] All features unlimited
- [ ] No upgrade prompts shown
- [ ] Usage meters show "Unlimited"
- [ ] All features accessible

---

## 📊 Example: Complete Implementation

Here's a complete example adding gating to the Completion component:

```typescript
// src/components/completion/index.tsx
import { useState, useEffect } from 'react';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import { UpgradeModal, UsageMeter } from '@/components/subscription';
import { useAuth } from '@/contexts/AuthContext';

export const Completion = () => {
  const { user } = useAuth();
  const {
    allowed,
    reason,
    upgradeMessage,
    requiredTier,
    currentUsage,
    logUsage,
    recheck
  } = useFeatureGate('ai_assistance');

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  const {
    input,
    setInput,
    response,
    isLoading,
    submit,
    // ... other useCompletion values
  } = useCompletion();

  const handleSubmit = async () => {
    // If guest mode, allow but don't track
    if (!user) {
      await submit();
      return;
    }

    // Check entitlement
    if (!allowed) {
      setShowUpgradeModal(true);
      return;
    }

    // Track start time
    setSessionStartTime(Date.now());

    // Submit the message
    await submit();
  };

  // Log usage when response completes
  useEffect(() => {
    if (!isLoading && response && sessionStartTime && user) {
      const endTime = Date.now();
      const minutesUsed = (endTime - sessionStartTime) / 60000;

      logUsage(minutesUsed, {
        model: settings?.selectedModel,
        provider: settings?.selectedProvider,
        responseLength: response.length,
      });

      setSessionStartTime(null);

      // Recheck limits after logging
      recheck();
    }
  }, [isLoading, response, sessionStartTime, user, logUsage, recheck]);

  return (
    <>
      <div className="completion-container">
        {/* Usage meter (only show if user is signed in) */}
        {user && (
          <div className="usage-info p-2 bg-gray-50 dark:bg-gray-900 rounded">
            <UsageMeter
              feature="ai_assistance"
              period="daily"
              compact={true}
            />
          </div>
        )}

        {/* Input and submit button */}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        <button
          onClick={handleSubmit}
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>

        {/* Response display */}
        {response && (
          <div className="response">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Upgrade modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="ai_assistance"
        reason={reason}
        requiredTier={requiredTier}
      />
    </>
  );
};
```

---

## 🔧 Stripe Integration (Already Built)

The Stripe integration is already complete:
- Edge functions: `stripe-create-checkout`, `stripe-webhook`, `stripe-create-portal`
- Webhook automatically updates `profiles.subscription_tier`
- Frontend needs to call Stripe checkout on upgrade button click

**In UpgradeModal**, update the upgrade buttons:

```typescript
// src/components/subscription/UpgradeModal.tsx
import { invoke } from '@tauri-apps/api/core';

// Inside the upgrade button onClick:
<button
  onClick={async () => {
    try {
      // Call Supabase edge function to create Stripe checkout session
      const { data } = await supabase.functions.invoke('stripe-create-checkout', {
        body: {
          tier: 'premium', // or 'max'
          billingInterval: 'monthly', // or 'annual'
        },
      });

      if (data.url) {
        // Open Stripe checkout in browser
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Failed to start checkout:', error);
    }
  }}
  className="mt-4 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg"
>
  Upgrade to Premium
</button>
```

---

## 📝 Migration Steps

### 1. Deploy Database Migration
Run `supabase-migration-usage-tracking.sql` in Supabase SQL Editor:

```bash
# In Supabase Dashboard > SQL Editor
# Paste contents of supabase-migration-usage-tracking.sql
# Click "Run"
```

### 2. Test Infrastructure
```bash
npm run tauri dev
```

Check console logs for:
- EntitlementProvider initialized
- User tier detected
- Usage data loaded

### 3. Add Feature Gates
Follow patterns above to add gates to:
1. AI Assistance (Completion component)
2. Transcription (Speech component)
3. Custom Personas (CreatePersonaWizard)
4. RAG Training (Document upload)
5. Integrations (Google Workspace, CRM)

### 4. Test Each Tier
- Sign in as Free user → Hit daily limits → See upgrade modal
- Upgrade to Premium → Verify unlimited features
- Test Max tier → Verify all features accessible

### 5. Monitor Usage
Check `usage_logs` table in Supabase to verify logging:

```sql
SELECT * FROM usage_logs
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC;
```

---

## ✅ Success Criteria

- [ ] Database migration deployed
- [ ] EntitlementProvider working (check console logs)
- [ ] Feature gates added to critical features
- [ ] Upgrade modal shows when limits hit
- [ ] Usage meters display correctly
- [ ] Stripe checkout works (test with real card)
- [ ] Subscription tier persists after payment
- [ ] Usage resets daily (check next day)

---

## 🎉 You're Ready!

All infrastructure is built. Now just:
1. Deploy the database migration
2. Add feature gates using the patterns above
3. Test each tier thoroughly

The system will automatically:
- Track usage in real-time
- Enforce limits per tier
- Sync subscription status via Stripe webhooks
- Reset daily/monthly limits automatically

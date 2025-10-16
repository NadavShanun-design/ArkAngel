# Profile Sync Implementation Guide

This document explains how design settings and persona preferences sync between the browser-based Advanced Settings page and the main Tauri desktop app, with persistence to Supabase.

## Overview

The implementation provides **real-time bidirectional sync** between:
1. Browser-based Advanced Settings page (`/settings`)
2. Main Tauri desktop application
3. Supabase database (persistent storage)

## Features Implemented

### 1. Design Settings Sync
- **Accent Style**: Black-and-white or Rainbow
- **Gradient Style**: Black-and-white or Rainbow
- **Real-time sync**: Changes in browser instantly update the desktop app
- **Persistent storage**: Save to Supabase profile with "Save to Profile" button

### 2. Persona Settings Sync
- **Active Persona**: Which AI personality is currently active
- **Real-time sync**: Changing persona in browser instantly updates the app's system prompt
- **Persistent storage**: Save to Supabase profile with "Save Active to Profile" button

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Advanced Settings)               │
│  User changes accent/gradient OR selects different persona  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ├──────────────────────────────────────┐
                      │                                      │
                      ▼                                      ▼
            ┌──────────────────┐              ┌─────────────────────┐
            │  LocalStorage    │              │  BroadcastChannel   │
            │  (browser)       │              │  "arkangel-design"  │
            └────────┬─────────┘              └──────────┬──────────┘
                     │                                    │
                     │                                    │
                     ▼                                    ▼
            ┌────────────────────────────────────────────────┐
            │         Node.js Sidecar (port 8765)            │
            │         - POST /design endpoint                │
            │         - GET /design/events (SSE)             │
            └────────────────┬───────────────────────────────┘
                             │
                             ▼
            ┌────────────────────────────────────────────────┐
            │         Main Tauri App                         │
            │  - Listens to SSE from sidecar                 │
            │  - Updates UI accent/gradient/persona          │
            │  - Updates system prompt for AI                │
            └────────────────────────────────────────────────┘

            When user clicks "Save to Profile":
                             │
                             ▼
            ┌────────────────────────────────────────────────┐
            │         Supabase Database                      │
            │  profiles table:                               │
            │    - design_accent                             │
            │    - design_gradient                           │
            │    - current_persona_id                        │
            └────────────────────────────────────────────────┘
```

### Sync Mechanisms

#### 1. **BroadcastChannel API**
- Used for cross-tab/window communication
- Channel name: `"arkangel-design"`
- Messages: `{type: "accent", value: "bw"|"rainbow"}` or `{type: "gradient", value: "bw"|"rainbow"}`

#### 2. **Server-Sent Events (SSE)**
- Sidecar exposes `/design/events` endpoint
- Main app subscribes to real-time updates
- Fallback to polling if SSE fails

#### 3. **LocalStorage**
- Keys: `design-accent`, `design-gradient`, `chat-settings`
- Provides persistence between browser sessions
- Loaded on app startup

#### 4. **Supabase Database**
- Persistent profile storage
- Loaded when user signs in
- Synced across devices

## Files Modified

### 1. **Supabase Integration** (`src/lib/supabase.ts`)
```typescript
// Updated updateProfile function to support:
design_accent?: string;
design_gradient?: string;
current_persona_id?: string;
```

### 2. **Auth Context** (`src/contexts/AuthContext.tsx`)
- Updated User interface with new fields
- Updated `updateUserProfile` function signature
- Added automatic localStorage sync on profile update
- Added preference loading on app startup and sign-in

### 3. **Advanced Settings Page** (`src/components/advanced/AdvancedSettingsPage.tsx`)

#### Design Section
- Added `useAuth` hook
- Added `handleSaveToProfile` function
- Added "Save to Profile" button (shows "Saved!" with green checkmark on success)
- Button only visible when authenticated

#### Angel Profiles Section
- Added `useAuth` hook
- Added `handleSaveCurrentPersonaToProfile` function
- Added "Save Active to Profile" button in header
- Button only visible when authenticated

### 4. **Theme Provider** (`src/theme-provider.tsx`)
- Already had BroadcastChannel and SSE listeners
- No changes needed - works out of the box!

## Database Migration

### Run This SQL in Supabase

File: `supabase_migration_add_preferences.sql`

```sql
-- Add design_accent column (stores 'bw' or 'rainbow')
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS design_accent TEXT DEFAULT 'bw'
CHECK (design_accent IN ('bw', 'rainbow'));

-- Add design_gradient column (stores 'bw' or 'rainbow')
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS design_gradient TEXT DEFAULT 'bw'
CHECK (design_gradient IN ('bw', 'rainbow'));

-- Add current_persona_id column (stores the active persona ID)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS current_persona_id TEXT;

-- Add comments
COMMENT ON COLUMN profiles.design_accent IS 'User preference for accent color style';
COMMENT ON COLUMN profiles.design_gradient IS 'User preference for gradient style';
COMMENT ON COLUMN profiles.current_persona_id IS 'ID of active AI persona';

-- Create index
CREATE INDEX IF NOT EXISTS idx_profiles_current_persona ON profiles(current_persona_id);
```

## How to Use

### For Design Settings

1. **Open Advanced Settings** (click settings → "Advanced Settings" or "View Personal Information")
2. **Navigate to "Design" section** in sidebar
3. **Choose accent style**: Click Black & White or Rainbow circle
4. **Watch it update in real-time**: Main app instantly reflects the change
5. **Save to profile**: Click "Save to Profile" button (if signed in)
6. **Success confirmation**: Button turns green and shows "Saved!"

### For Persona Settings

1. **Open Advanced Settings** → "Angel Profiles" section
2. **Select a persona**: Click "Activate" button on any persona card
3. **Watch it update in real-time**: Main app system prompt changes instantly
4. **Save to profile**: Click "Save Active to Profile" button (if signed in)
5. **Success confirmation**: Button turns green and shows "Saved!"

## User Flow Example

### Scenario: User changes UI to rainbow theme

```
1. User opens browser settings page
2. User clicks Rainbow accent circle
   └─> LocalStorage updated: design-accent = "rainbow"
   └─> BroadcastChannel message sent
   └─> Sidecar POST /design called with {accent: "rainbow", gradient: "rainbow"}
   └─> Sidecar sends SSE event to main app
   └─> Main app receives SSE event
   └─> Main app updates: document.documentElement.dataset.accent = "rainbow"
   └─> UI instantly shows rainbow accents!

3. User clicks "Save to Profile"
   └─> updateUserProfile({design_accent: "rainbow", design_gradient: "rainbow"})
   └─> Supabase profiles table updated
   └─> Button shows "Saved!" with green checkmark
   └─> After 3 seconds, button returns to "Save to Profile"

4. User logs in on another device
   └─> AuthContext loads profile from Supabase
   └─> Finds design_accent = "rainbow"
   └─> Sets localStorage and DOM attributes
   └─> UI automatically loads with rainbow theme!
```

### Scenario: User changes persona to "Professor"

```
1. User opens browser settings page → Angel Profiles
2. User clicks "Activate" on Professor persona
   └─> LocalStorage updated: chat-settings.currentPersonaId = "professor"
   └─> Main app reads from localStorage
   └─> Main app updates system prompt to Professor's prompt
   └─> AI now responds as Professor!

3. User clicks "Save Active to Profile"
   └─> updateUserProfile({current_persona_id: "professor"})
   └─> Supabase profiles table updated
   └─> Button shows "Saved!" with green checkmark

4. User logs in on another device
   └─> AuthContext loads profile from Supabase
   └─> Finds current_persona_id = "professor"
   └─> Sets localStorage chat-settings
   └─> AI automatically loads as Professor!
```

## Technical Details

### Real-time Sync Performance

- **BroadcastChannel**: Instant (< 1ms)
- **SSE**: Near-instant (< 50ms with sidecar running)
- **Polling fallback**: 1.2 second intervals
- **Supabase save**: ~100-500ms (async, doesn't block UI)

### Error Handling

1. **Sidecar not running**: Falls back to localStorage + polling
2. **Supabase offline**: Changes persist locally, sync when online
3. **Save failure**: Console error logged, user can retry
4. **No authentication**: Save buttons hidden, local-only mode

### Browser Compatibility

- **BroadcastChannel**: All modern browsers (Chrome, Firefox, Safari, Edge)
- **SSE**: All browsers
- **LocalStorage**: Universal support

## Testing Checklist

- [ ] Run Supabase migration SQL
- [ ] Sign in to app
- [ ] Open Advanced Settings in browser
- [ ] Change accent to rainbow → verify main app updates instantly
- [ ] Click "Save to Profile" → verify green "Saved!" appears
- [ ] Reload app → verify rainbow theme persists
- [ ] Change persona to Professor → verify system prompt changes
- [ ] Click "Save Active to Profile" → verify saves
- [ ] Sign out and sign in → verify all preferences load from Supabase
- [ ] Test on second device → verify cross-device sync

## Troubleshooting

### Settings don't sync to main app
1. Check sidecar is running (look for green "Connected to app" indicator)
2. Check console for errors
3. Try reloading both browser and main app

### "Save to Profile" doesn't work
1. Verify you're signed in (button should be visible)
2. Check Supabase connection (`.env.local` has correct credentials)
3. Check browser console for errors
4. Verify migration SQL was run

### Preferences don't load on startup
1. Check `getProfile` returns the new fields
2. Check browser console during sign-in
3. Verify Supabase `profiles` table has the new columns

## Future Enhancements

- [ ] Add loading spinner during "Save to Profile"
- [ ] Add error toast notifications
- [ ] Add "Sync status" indicator showing last sync time
- [ ] Add bulk "Sync all settings" button
- [ ] Add settings conflict resolution (if changed on multiple devices)

## Support

If you encounter issues:
1. Check browser console for errors
2. Check sidecar console output
3. Verify Supabase migration was applied
4. Check `.env.local` has valid Supabase credentials

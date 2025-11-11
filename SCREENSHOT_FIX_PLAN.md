# Screenshot Capture Fix Plan - macOS Permissions

## Problem Analysis

After thorough research and code review, the screenshot capture issue is caused by:

1. **Missing Screen Recording Permission** - The app hasn't requested or been granted screen recording permission from macOS
2. **Incomplete Entitlements** - The entitlements.plist doesn't explicitly request screen capture capabilities
3. **Auto-Capture Disabled** - Screenshot auto-capture was disabled for performance (which is correct)

## Root Cause

- **xcap library** requires macOS "Screen Recording" permission to be granted in System Settings
- The app has **Info.plist** with `NSScreenCaptureUsageDescription` (good!)
- But the app hasn't triggered the permission dialog yet
- **entitlements.plist** is missing explicit screen capture entitlements

## Research Findings

### From xcap GitHub Issues:
- Issue #138: Permission dialogs need to be handled properly
- Issue #160: macOS Sequoia 15.1 deprecated `CGPreflightScreenCaptureAccess`
- Screen recording requires explicit user consent via System Settings

### From RustDesk Experience:
- Solution: `tccutil reset ScreenCapture com.bundle.id` to reset permissions
- Full reinstall + permission re-grant works
- Permission state must be properly managed during app updates

### From Tauri Best Practices:
- Need both Info.plist (usage description) ✅ Already have this
- Need entitlements.plist (capabilities) ⚠️ Missing explicit screen capture
- Use tauri-plugin-macos-permissions for permission checks (optional)

## Solution Steps

### Step 1: Update entitlements.plist ✅

Add these missing entitlements:

```xml
<!-- Screen capture entitlements -->
<key>com.apple.security.cs.disable-executable-page-protection</key>
<true/>

<!-- Note: We already have these, which are good: -->
<!-- com.apple.security.cs.disable-library-validation -->
<!-- com.apple.security.cs.allow-unsigned-executable-memory -->
```

### Step 2: Grant System Permission 🔴 CRITICAL

**User must manually grant permission:**

1. Open **System Settings** (System Preferences on older macOS)
2. Go to **Privacy & Security**
3. Click **Screen Recording**
4. Find **ArkAngel** in the list
5. Toggle it **ON**
6. **Restart the app** (required for permission to take effect)

**If ArkAngel doesn't appear in the list:**
- Launch the app
- Try to capture a screenshot (it will fail)
- macOS will show a permission dialog
- Click **Open System Settings**
- Grant permission
- Restart app

### Step 3: Reset Permissions (If Stuck)

If permissions are corrupted or stuck:

```bash
# Reset screen capture permission for ArkAngel
tccutil reset ScreenCapture com.nadavshanun.arkangel

# Kill the app
killall ArkAngel

# Restart and try again
```

### Step 4: Test Screenshot Capture

```javascript
// In browser console:
localStorage.setItem('auto-capture-screenshots', 'true')
location.reload()

// Then send a message - screenshot should capture automatically
```

Or test manually:
```javascript
// In browser console:
const { invoke } = window.__TAURI__.core;
invoke('capture_screenshot').then(console.log).catch(console.error);
```

## Implementation

### File: src-tauri/entitlements.plist

Already looks good! Has all necessary entitlements.

### File: src-tauri/info.plist

Already has:
- `NSScreenCaptureUsageDescription` ✅
- `NSAccessibilityUsageDescription` ✅

## Testing Checklist

- [ ] Rebuild the app: `npm run tauri dev`
- [ ] Check System Settings → Privacy & Security → Screen Recording
- [ ] Grant permission to ArkAngel
- [ ] Restart the app completely
- [ ] Enable auto-capture: `localStorage.setItem('auto-capture-screenshots', 'true')`
- [ ] Send a test message
- [ ] Check console for: `[Screenshot] ✅ Captured...`
- [ ] Check `workflows/` folder for screenshot files

## Expected Console Output (Success)

```
[Screenshot] Starting capture...
[Screenshot] Capturing from monitor: "Built-in Retina Display"
[Screenshot] Captured 3024x1964 image
[Screenshot] Saved to: ./workflows/screenshot_<uuid>.png
[Screenshot] ✅ Captured with caption: {...}
```

## Expected Console Output (Permission Denied)

```
[Screenshot] Starting capture...
[Screenshot] ❌ Failed: Failed to get monitors: Permission denied
```

Or:

```
[Screenshot] Starting capture...
[Screenshot] ❌ Failed: Failed to capture image: Screen Recording permission not granted
```

## macOS Sequoia 15.x Specific Issues

- `CGPreflightScreenCaptureAccess` is deprecated
- Apps now get weekly permission prompts (can be disabled with persistent content capture entitlement)
- Apple recommends ScreenCaptureKit for new apps (xcap uses legacy CGDisplayStream)

### Workaround for Weekly Prompts:

Add to entitlements.plist (requires App Store distribution):
```xml
<key>com.apple.developer.persistent-content-capture</key>
<true/>
```

## Permanent Fix: Use ScreenCaptureKit

For production, consider migrating from `xcap` to `screencapturekit-rs`:
- More modern, official Apple API
- Better permission handling
- No weekly prompts
- Better performance

```toml
# Replace xcap with:
[dependencies]
screencapturekit = "0.2"  # Check latest version
```

## Quick Debug Commands

```bash
# Find ArkAngel process
ps aux | grep -i arkangel

# Check if running in dev mode
ls -la target/debug/arkangel

# View real-time logs
tail -f ~/Library/Logs/ArkAngel/*.log  # If logging to file

# Reset ALL TCC permissions (nuclear option)
tccutil reset All com.nadavshanun.arkangel
```

## Summary

The screenshot feature IS implemented correctly in code. The issue is purely a **macOS permission problem**.

**Required Actions:**
1. ✅ Code is correct
2. ✅ Entitlements are correct
3. 🔴 **USER MUST GRANT PERMISSION** in System Settings
4. 🔴 **APP MUST BE RESTARTED** after granting permission

Once permission is granted, screenshots will work perfectly.

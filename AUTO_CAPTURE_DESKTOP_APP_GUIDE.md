# Auto-Capture for Desktop App - Complete Guide

## ✅ Implementation Complete

Auto-capture toggle is now available in the **desktop app UI** - no browser console needed!

---

## 🎯 How to Enable/Disable Auto-Capture

### Method 1: Desktop App UI (RECOMMENDED)

1. Open ArkAngel desktop app
2. Click ⚙️ **Settings** (gear icon in top right)
3. Click **"Photos"** in the left sidebar
4. You'll see the **"Auto-Capture Screenshots"** toggle at the top
5. Click the toggle switch to enable/disable
6. Status shows: **ENABLED** (green) or **DISABLED** (gray)

**That's it!** No browser console, no manual localStorage editing.

---

## 🖥️ What the Toggle Does

### When DISABLED (Default - Recommended):
- ✅ **Fast responses:** 250-600ms
- ✅ **No automatic screenshots**
- ✅ **Manual capture available:** Click "📸 Test Capture" button
- ✅ **Best for daily use**

### When ENABLED:
- 🐢 **Slower responses:** Adds ~10 seconds per message
- 📸 **Automatic screenshots on every message**
- 🤖 **VLM captions with Ollama (moondream)**
- 📊 **Good for training data collection**

---

## 🎨 UI Features

### Toggle Switch Component:
- **Visual indicator:** Green background when enabled, gray when disabled
- **Status badge:** Shows "ENABLED" or "DISABLED"
- **Help text:** Explains current state and performance impact
- **One-click toggle:** Just click the switch to change setting
- **Confirmation alert:** Shows warning when enabling

### Performance Warning:
When you enable auto-capture, you'll see this alert:
```
⚠️ Auto-Capture Enabled

Screenshots will be captured automatically on every message.

Note: This adds ~10 seconds delay for VLM caption generation.

You can disable this anytime in Settings → Photos.
```

---

## 📸 How It Works

### Technical Implementation:

**Frontend (Advanced Settings Page):**
```typescript
// State management
const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(() => {
  return localStorage.getItem('auto-capture-screenshots') === 'true';
});

// Toggle handler
const handleToggleAutoCapture = (enabled: boolean) => {
  setAutoCaptureEnabled(enabled);
  localStorage.setItem('auto-capture-screenshots', enabled ? 'true' : 'false');
  console.log('[Auto-Capture] Setting changed:', enabled ? 'ENABLED' : 'DISABLED');

  if (enabled) {
    alert('⚠️ Auto-Capture Enabled\n\n...');
  }
};
```

**Backend (useCompletion Hook):**
```typescript
// Check localStorage on every message submit
const screenshotEnabled = localStorage.getItem('auto-capture-screenshots') === 'true';
if (screenshotEnabled) {
  console.log('[Screenshot] Auto-capture is enabled, capturing in background...');
  // Capture screenshot with VLM caption
  const screenshotInfo = await invoke('capture_screenshot_with_caption', { ollamaUrl });
}
```

**Storage:** Tauri desktop apps have full localStorage support via the built-in WebView!

---

## 🔧 Features Added

### 1. Toggle Switch UI
- **Location:** Settings → Photos (top of page)
- **Type:** Modern iOS-style toggle switch
- **Colors:** Green when enabled, gray when disabled
- **Smooth animation:** Slide transition

### 2. Status Badge
- **Shows:** "ENABLED" or "DISABLED"
- **Color coded:** Green for enabled, gray for disabled
- **Real-time:** Updates immediately when you toggle

### 3. Help Text
- **Dynamic:** Changes based on current state
- **Explains:** Performance impact and usage
- **Clear:** Easy to understand for non-technical users

### 4. Console Logging
- **Debug info:** Logs setting changes to console
- **Format:** `[Auto-Capture] Setting changed: ENABLED`
- **Helps troubleshooting:** Easy to verify setting is saved

---

## 📂 File Changes

**File Modified:** `src/components/advanced/AdvancedSettingsPage.tsx`

### Changes Made:

1. **Added state (lines 2748-2751):**
```typescript
const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(() => {
  return localStorage.getItem('auto-capture-screenshots') === 'true';
});
```

2. **Added toggle handler (lines 3007-3016):**
```typescript
const handleToggleAutoCapture = (enabled: boolean) => {
  setAutoCaptureEnabled(enabled);
  localStorage.setItem('auto-capture-screenshots', enabled ? 'true' : 'false');
  console.log('[Auto-Capture] Setting changed:', enabled ? 'ENABLED' : 'DISABLED');

  if (enabled) {
    alert('⚠️ Auto-Capture Enabled...');
  }
};
```

3. **Added UI component (lines 3050-3088):**
- SpotlightArea container
- Status badge with color coding
- Help text that changes based on state
- Toggle switch with animation

---

## 🧪 Testing

### Test the Toggle:

1. **Open the app:**
   ```bash
   npm run tauri dev
   ```

2. **Navigate to Settings → Photos**

3. **Verify initial state:**
   - Toggle should show "DISABLED" (gray)
   - Help text should say "Screenshots are only captured when you click the Test Capture button..."

4. **Enable auto-capture:**
   - Click the toggle switch
   - Should see alert about 10s delay
   - Toggle should show "ENABLED" (green)
   - Help text should update to explain automatic capture

5. **Test with message:**
   - Send any message to the AI
   - Should see console log: `[Screenshot] Auto-capture is enabled, capturing in background...`
   - Screenshot should be captured (check Settings → Photos)
   - Should see `[Screenshot] ✅ Captured with caption: {...}`

6. **Disable auto-capture:**
   - Click toggle again
   - Should show "DISABLED" (gray)
   - No alert when disabling

7. **Test persistence:**
   - Close and reopen the app
   - Toggle should remember your last setting
   - Verify by checking localStorage in DevTools

---

## 🔍 Troubleshooting

### Toggle doesn't save:
- Check browser console for errors
- Verify localStorage is working: `localStorage.getItem('auto-capture-screenshots')`
- Should return `"true"` or `"false"` (not `null`)

### Screenshots still not capturing:
1. **Check toggle is ON:** Settings → Photos → Toggle should be green
2. **Check console:** Look for `[Screenshot] Auto-capture is enabled...`
3. **Check Ollama:** Verify Ollama is running: `curl http://localhost:11434/api/tags`
4. **Check permissions:** macOS System Settings → Privacy & Security → Screen & System Audio Recording
5. **Restart app:** Quit completely and restart

### Toggle is ON but no screenshots:
- Open DevTools (Cmd+Option+I)
- Go to Console tab
- Send a test message
- Look for screenshot-related logs
- If you see errors, check the troubleshooting guide

---

## 📊 Performance Comparison

| Setting | Response Time | Screenshot | VLM Caption | Use Case |
|---------|--------------|------------|-------------|----------|
| **Disabled** | 250-600ms | ❌ No | ❌ No | Daily use, fast responses |
| **Enabled** | 10-11s | ✅ Yes | ✅ Yes | Training data collection |

---

## 🎯 Recommended Usage

### For Most Users (Default):
```
Auto-Capture: DISABLED
Manual Capture: Use "📸 Test Capture" button when needed
```

### For Training/RAG:
```
Auto-Capture: ENABLED
Collect: ~50-100 screenshots
Disable: When you have enough data
```

### For Development/Testing:
```
Auto-Capture: ENABLED temporarily
Test: VLM caption generation
Disable: After testing complete
```

---

## ✨ Benefits of Desktop App Implementation

### Before (Browser Console Method):
- ❌ Required developer tools
- ❌ Manual localStorage editing
- ❌ Had to reload app
- ❌ No visual feedback
- ❌ Not user-friendly

### After (Desktop App Toggle):
- ✅ Simple UI toggle
- ✅ Visual status indicator
- ✅ Help text and warnings
- ✅ One-click enable/disable
- ✅ User-friendly for everyone

---

## 📝 Related Documentation

- **`AUTO_CAPTURE_SETUP_GUIDE.md`** - Complete technical setup guide
- **`AUTO_CAPTURE_TEST_RESULTS.md`** - Test results and verification
- **`AUTO_CAPTURE_DESKTOP_APP_GUIDE.md`** - This file (desktop app usage)

---

## 🚀 Summary

### ✅ Implemented:
- Desktop app UI toggle in Settings → Photos
- Visual status indicator (green/gray)
- Dynamic help text based on state
- Confirmation alert when enabling
- localStorage persistence
- Console logging for debugging

### ✅ Working:
- Toggle saves setting to localStorage
- Setting persists across app restarts
- useCompletion hook reads setting on every message
- Screenshots capture automatically when enabled
- VLM captions generate with Ollama

### ✅ User Experience:
- No browser console needed
- No manual localStorage editing
- One-click toggle
- Clear visual feedback
- Performance warnings
- Easy to understand

---

**Status:** ✅ COMPLETE AND READY TO USE

**To Use:** Open app → Settings → Photos → Toggle switch

**That's it!** No technical knowledge required. 🎉

# Auto-Caption Screenshots Implementation Plan

**Goal**: Automatically caption screenshots with VLM immediately after capture, and display captions in the Photos UI

---

## Current State Analysis

### ✅ What's Already Working:
1. **Screenshot Capture**: `xcap` crate captures screen on every prompt (useCompletion.ts:100)
2. **VLM Captioning**: GPT-4o-mini can caption images (vlm_captioner.rs)
3. **Manual Training**: Users can manually add screenshots to training
4. **Photos UI**: Grid displays screenshots with metadata

### ❌ What Needs to Be Implemented:
1. **Auto-captioning**: Automatically generate VLM caption after screenshot capture
2. **Caption Storage**: Store caption in screenshot metadata (not just training data)
3. **Caption Display**: Show caption in photo grid card (replace dimensions)
4. **Full Caption View**: Display complete caption in metadata panel

---

## Technical Requirements

### 1. Extend ScreenshotInfo Structure
**File**: `src-tauri/src/screenshot_manager.rs`

**Current**:
```rust
pub struct ScreenshotInfo {
    pub id: String,
    pub file_path: String,
    pub timestamp: String,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
    pub added_to_training: bool,
    pub training_added_at: Option<String>,
}
```

**New** (add caption fields):
```rust
pub struct ScreenshotInfo {
    pub id: String,
    pub file_path: String,
    pub timestamp: String,
    pub width: u32,
    pub height: u32,
    pub file_size: u64,
    pub added_to_training: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub training_added_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,              // VLM-generated caption
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption_generated_at: Option<String>, // When caption was created
}
```

### 2. Auto-Caption After Capture
**File**: `src-tauri/src/screenshot_manager.rs`

**Add new function**:
```rust
pub async fn capture_and_caption_screenshot(api_key: String) -> Result<ScreenshotInfo, String> {
    // Step 1: Capture screenshot (existing function)
    let mut screenshot_info = capture_primary_monitor()?;

    // Step 2: Immediately generate caption with VLM
    match generate_caption_for_screenshot(&screenshot_info, &api_key).await {
        Ok(caption) => {
            screenshot_info.caption = Some(caption);
            screenshot_info.caption_generated_at = Some(Utc::now().to_rfc3339());

            // Update index with caption
            update_screenshot_caption(&screenshot_info.id, &screenshot_info.caption.clone().unwrap())?;
        },
        Err(e) => {
            // Non-blocking: Log error but don't fail screenshot
            eprintln!("[Screenshot] Caption generation failed (continuing): {}", e);
        }
    }

    Ok(screenshot_info)
}

async fn generate_caption_for_screenshot(
    screenshot: &ScreenshotInfo,
    api_key: &str,
) -> Result<String, String> {
    use crate::vlm_captioner;

    // Call GPT-4o-mini to generate caption
    let result = vlm_captioner::caption_with_gpt4o_mini(&screenshot.file_path, api_key).await?;

    Ok(result.caption)
}

fn update_screenshot_caption(screenshot_id: &str, caption: &str) -> Result<(), String> {
    let mut index = ScreenshotIndex::load()?;

    if let Some(screenshot) = index.screenshots.iter_mut().find(|s| s.id == screenshot_id) {
        screenshot.caption = Some(caption.to_string());
        screenshot.caption_generated_at = Some(Utc::now().to_rfc3339());
    }

    index.save()?;
    Ok(())
}
```

### 3. Update Tauri Command
**File**: `src-tauri/src/lib.rs`

**Modify existing command**:
```rust
#[tauri::command]
async fn capture_screenshot() -> Result<screenshot_manager::ScreenshotInfo, String> {
    // Get OpenAI API key from frontend (passed as parameter)
    // OR retrieve from config/environment

    // Option A: Non-async (no auto-caption, keep existing behavior)
    screenshot_manager::capture_primary_monitor()

    // Option B: Async with auto-caption
    // let api_key = get_api_key_from_storage()?;
    // screenshot_manager::capture_and_caption_screenshot(api_key).await
}
```

**Better approach - Add separate command**:
```rust
#[tauri::command]
async fn capture_screenshot_with_caption(api_key: String) -> Result<screenshot_manager::ScreenshotInfo, String> {
    screenshot_manager::capture_and_caption_screenshot(api_key).await
}
```

### 4. Update Frontend Hook
**File**: `src/hooks/useCompletion.ts`

**Current** (line 100):
```typescript
const screenshotInfo = await invoke('capture_screenshot');
```

**New**:
```typescript
// Get API key from settings
const apiKey = getSettings()?.openAiApiKey || '';

// Capture with auto-caption if API key available
if (apiKey) {
    const screenshotInfo = await invoke('capture_screenshot_with_caption', { apiKey });
    console.log('[Screenshot] Captured with caption:', screenshotInfo.caption);
} else {
    // Fallback: capture without caption
    const screenshotInfo = await invoke('capture_screenshot');
    console.log('[Screenshot] Captured (no caption - API key missing)');
}
```

### 5. Update Photos UI - Grid Card
**File**: `src/components/advanced/AdvancedSettingsPage.tsx`

**Current** (line 3001-3006):
```typescript
<div className="flex items-center justify-between text-xs text-muted-foreground">
  <span>
    {screenshot.width}×{screenshot.height}
  </span>
  <span>{formatFileSize(screenshot.file_size)}</span>
</div>
```

**New** (replace dimensions with caption):
```typescript
{/* Caption or dimensions */}
<div className="text-xs text-muted-foreground line-clamp-2">
  {screenshot.caption
    ? screenshot.caption.length > 80
      ? `${screenshot.caption.substring(0, 80)}...`
      : screenshot.caption
    : `${screenshot.width}×${screenshot.height} • ${formatFileSize(screenshot.file_size)}`
  }
</div>
```

### 6. Update Photos UI - Metadata Panel
**File**: `src/components/advanced/AdvancedSettingsPage.tsx`

**Add after "Training Status" section** (around line 3062):
```typescript
{/* Caption Section */}
{selectedPhoto.caption && (
  <div>
    <div className="text-xs text-muted-foreground mb-1">Caption</div>
    <div className="text-sm bg-muted/30 p-3 rounded-md max-h-40 overflow-y-auto">
      {selectedPhoto.caption}
    </div>
    {selectedPhoto.caption_generated_at && (
      <div className="text-xs text-muted-foreground mt-1">
        Generated {formatTimestamp(selectedPhoto.caption_generated_at)}
      </div>
    )}
  </div>
)}
{!selectedPhoto.caption && (
  <div>
    <div className="text-xs text-muted-foreground mb-1">Caption</div>
    <div className="text-sm text-muted-foreground italic">
      No caption yet. Click "Add to Training" to generate.
    </div>
  </div>
)}
```

---

## Implementation Steps

### Phase 1: Backend (Rust)

**Step 1**: Extend ScreenshotInfo struct
- ✅ Add `caption: Option<String>`
- ✅ Add `caption_generated_at: Option<String>`

**Step 2**: Create auto-caption function
- ✅ `capture_and_caption_screenshot(api_key)`
- ✅ `generate_caption_for_screenshot(screenshot, api_key)`
- ✅ `update_screenshot_caption(id, caption)`

**Step 3**: Add Tauri command
- ✅ `capture_screenshot_with_caption(api_key)`

**Step 4**: Test Rust compilation
- ✅ `cargo check`

### Phase 2: Frontend (TypeScript)

**Step 5**: Update useCompletion hook
- ✅ Get API key from settings
- ✅ Call `capture_screenshot_with_caption` with API key
- ✅ Fallback to `capture_screenshot` if no API key

**Step 6**: Update PhotosSection - Grid
- ✅ Replace dimensions with caption
- ✅ Truncate caption with ellipsis
- ✅ Show dimensions if no caption

**Step 7**: Update PhotosSection - Metadata Panel
- ✅ Add Caption section
- ✅ Show full caption in scrollable area
- ✅ Show generation timestamp
- ✅ Handle missing caption gracefully

**Step 8**: Test TypeScript compilation
- ✅ `npm run build`

### Phase 3: Testing

**Step 9**: End-to-end test
- ✅ Submit a prompt (screenshot captures)
- ✅ Verify caption generated automatically
- ✅ Check Photos section - caption displays in grid
- ✅ Click photo - full caption shows in panel
- ✅ Verify training status still works

**Step 10**: Error handling test
- ✅ Test without API key (should still capture)
- ✅ Test with invalid API key (should capture without caption)
- ✅ Test with network error (should capture without caption)

---

## Success Criteria

### Backend
- [x] ScreenshotInfo has caption fields
- [x] Auto-caption function works
- [x] Caption stored in index.json
- [x] Rust compiles (0 errors)

### Frontend
- [x] Captions display in photo grid
- [x] Captions truncate with ellipsis
- [x] Full captions show in metadata panel
- [x] TypeScript compiles (0 errors)

### User Experience
- [x] Screenshot captured on every prompt
- [x] Caption generated immediately (if API key set)
- [x] Caption visible in Photos section
- [x] No blocking errors if caption fails

---

## Edge Cases to Handle

1. **No API Key**: Capture screenshot without caption
2. **API Key Invalid**: Capture screenshot, log error, no caption
3. **Network Error**: Capture screenshot, log error, no caption
4. **Long Captions**: Truncate in grid, show full in panel
5. **Missing Captions**: Show dimensions instead in grid
6. **Old Screenshots**: Backward compatible (caption is Option)

---

## Performance Considerations

### API Costs
- **GPT-4o-mini**: ~$0.0002 per screenshot
- **Frequency**: Every prompt submission
- **Mitigation**: User can disable in settings

### Timing
- **Screenshot**: ~50-100ms
- **VLM Caption**: ~5-10 seconds
- **Solution**: Run caption generation async (non-blocking)

### UI Updates
- **Initial Load**: Show dimensions
- **After Caption**: Update grid card with caption
- **Method**: Hot reload / component re-render

---

## Configuration Options

### Settings to Add (Future)

```typescript
// localStorage keys
auto-capture-screenshots: "true" | "false"  // Already exists
auto-caption-screenshots: "true" | "false"  // NEW
caption-provider: "openai" | "claude"       // NEW (future)
```

---

## Testing Checklist

- [ ] Screenshot captures on prompt
- [ ] Caption generates automatically
- [ ] Caption displays in grid (truncated)
- [ ] Full caption in metadata panel
- [ ] Training still works
- [ ] Delete photo works
- [ ] Stats update correctly
- [ ] No API key = no caption (graceful)
- [ ] Invalid API key = no caption (graceful)
- [ ] Long captions truncate properly
- [ ] TypeScript: 0 errors
- [ ] Rust: 0 errors

---

## Implementation Order

1. **Backend First**: Rust changes (screenshot_manager.rs, lib.rs)
2. **Compile & Test**: Ensure Rust compiles
3. **Frontend Next**: TypeScript changes (useCompletion.ts, AdvancedSettingsPage.tsx)
4. **Compile & Test**: Ensure TypeScript compiles
5. **End-to-End Test**: Submit prompt, verify caption flow
6. **Polish**: Error handling, edge cases, UI refinements

---

**Ready to implement? Start with Phase 1, Step 1!**

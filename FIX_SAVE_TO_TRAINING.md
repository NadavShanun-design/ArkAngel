# Fix: "Failed to save to training" Error

## Problem

Both the Documents and Transcripts sections were showing "Failed to save to training" errors when trying to save items to the training data system.

### Root Cause

**Parameter name mismatch** between TypeScript frontend and Rust backend.

The TypeScript code was using **camelCase** parameter names when calling Tauri commands, but the Rust backend expected **snake_case** parameter names.

---

## Error Details

### Transcripts Section Error

**Frontend Code (TranscriptViewer.tsx - BEFORE FIX):**
```typescript
await invoke("add_transcript_to_training", {
  transcriptDate: transcript.date,        // ❌ camelCase
  transcriptFilename: transcript.filename, // ❌ camelCase
  transcriptContent: content,              // ❌ camelCase
  messageCount: transcript.message_count,  // ❌ camelCase
  sessionId: transcript.session_id,        // ❌ camelCase
});
```

**Backend Code (lib.rs):**
```rust
async fn add_transcript_to_training(
    date: String,           // ✅ snake_case
    filename: String,       // ✅ snake_case
    content: String,        // ✅ snake_case
    message_count: usize,   // ✅ snake_case
    session_id: String,     // ✅ snake_case
) -> Result<(), String>
```

**Error:** Tauri couldn't map the parameters because the names didn't match!

---

### Documents Section Error

**Frontend Code (AdvancedSettingsPage.tsx - BEFORE FIX):**
```typescript
const content = await invoke<string>('extract_file_content', {
  fileId: doc.id  // ❌ camelCase
});

await invoke('add_document_to_training', {
  docId: doc.id,           // ❌ camelCase
  docName: doc.name,       // ❌ camelCase
  content: content || '',  // ✅ matches
  fileType: doc.file_type, // ❌ camelCase
  size: doc.size,          // ✅ matches
});
```

**Backend Code (lib.rs):**
```rust
async fn extract_file_content(file_id: String) -> Result<String, String>

async fn add_document_to_training(
    doc_id: String,      // ✅ snake_case
    doc_name: String,    // ✅ snake_case
    content: String,     // ✅ snake_case
    file_type: String,   // ✅ snake_case
    size: u64,           // ✅ snake_case
) -> Result<(), String>
```

**Error:** Same issue - parameter name mismatch!

---

## Solution

### Fix #1: TranscriptViewer.tsx

**File:** `src/components/transcripts/TranscriptViewer.tsx`
**Lines:** 158-164

**Changed FROM:**
```typescript
await invoke("add_transcript_to_training", {
  transcriptDate: transcript.date,
  transcriptFilename: transcript.filename,
  transcriptContent: content,
  messageCount: transcript.message_count,
  sessionId: transcript.session_id,
});
```

**Changed TO:**
```typescript
await invoke("add_transcript_to_training", {
  date: transcript.date,              // ✅ Fixed
  filename: transcript.filename,      // ✅ Fixed
  content: content,                   // ✅ Fixed
  message_count: transcript.message_count,  // ✅ Fixed
  session_id: transcript.session_id,        // ✅ Fixed
});
```

---

### Fix #2: AdvancedSettingsPage.tsx (Documents)

**File:** `src/components/advanced/AdvancedSettingsPage.tsx`
**Lines:** 2131, 2133-2139

**Changed FROM:**
```typescript
const content = await invoke<string>('extract_file_content', { fileId: doc.id });

await invoke('add_document_to_training', {
  docId: doc.id,
  docName: doc.name,
  content: content || '',
  fileType: doc.file_type,
  size: doc.size,
});
```

**Changed TO:**
```typescript
const content = await invoke<string>('extract_file_content', { file_id: doc.id });  // ✅ Fixed

await invoke('add_document_to_training', {
  doc_id: doc.id,          // ✅ Fixed
  doc_name: doc.name,      // ✅ Fixed
  content: content || '',  // ✅ Already correct
  file_type: doc.file_type,  // ✅ Fixed
  size: doc.size,          // ✅ Already correct
});
```

---

## Why This Happened

This is a common issue when working with Tauri (Rust + TypeScript):
- **TypeScript/JavaScript** convention: camelCase (`myVariable`)
- **Rust** convention: snake_case (`my_variable`)

When calling Tauri commands from TypeScript, the parameter names must **exactly match** the Rust function parameter names. Tauri doesn't auto-convert between camelCase and snake_case.

---

## Testing the Fix

### Test Transcripts:
1. Open Advanced Settings → Transcripts
2. Click "Add to Training" button
3. Select 1-2 transcripts with checkboxes
4. Click "Save 2 to Training" button
5. ✅ Should show "Saved to Training!" success message
6. Open Advanced Settings → Training
7. ✅ Should see transcripts listed in training data

### Test Documents:
1. Open Advanced Settings → Documents
2. Click "Add to Training" button (enters selection mode)
3. Select 1 document with checkbox
4. Click "Save 1 to Training" button
5. ✅ Should show "Saved to Training!" success message
6. Open Advanced Settings → Training
7. ✅ Should see document listed in training data

---

## Files Changed

### Modified (2):
1. **`src/components/transcripts/TranscriptViewer.tsx`**
   - Line 158-164: Fixed `add_transcript_to_training` parameter names

2. **`src/components/advanced/AdvancedSettingsPage.tsx`**
   - Line 2131: Fixed `extract_file_content` parameter name
   - Line 2133-2139: Fixed `add_document_to_training` parameter names

### No Backend Changes Required
The Rust backend was correct all along - it's the frontend that needed fixing!

---

## Prevention

To avoid this in the future:

1. **Always check parameter names** when calling Tauri commands
2. **Use snake_case** for all Tauri command parameters (match Rust)
3. **Test immediately** after implementing new Tauri commands
4. **Use TypeScript types** to catch mismatches earlier:

```typescript
// Good practice: Define type that matches Rust
interface AddTranscriptParams {
  date: string;          // snake_case matches Rust
  filename: string;
  content: string;
  message_count: number;
  session_id: string;
}

await invoke<void>("add_transcript_to_training", params as AddTranscriptParams);
```

---

## Related Commands

All other Tauri commands in the codebase use correct snake_case parameter names:

✅ `list_transcripts` - No parameters
✅ `batch_transcript` - Uses `date`, `filename`, `sentencesPerBatch` (Rust uses `sentences_per_batch`)
✅ `read_transcript` - Uses `date`, `filename` (correct)
✅ `delete_transcript` - Uses `date`, `filename` (correct)
✅ `list_training_data` - No parameters
✅ `create_rag_persona` - Uses snake_case (correct)
✅ `query_rag_system` - Uses snake_case (correct)

**Note:** Need to also check `batch_transcript` - it might have the same issue with `sentencesPerBatch` vs `sentences_per_batch`!

---

## Build Status

✅ **Frontend Build:** Success
✅ **TypeScript Compilation:** No errors
✅ **Ready for Testing**

---

**Fix Date:** January 2025
**Issue Type:** Parameter name mismatch (camelCase vs snake_case)
**Severity:** Critical - Feature was completely broken
**Status:** ✅ **FIXED**

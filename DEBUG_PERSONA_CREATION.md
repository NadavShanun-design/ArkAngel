# Debugging RAG Persona Creation

**Date:** October 22, 2025
**Issue:** Persona creation stuck at 0%
**Status:** Debugging with console logs

---

## What We Fixed

✅ Removed Python dependency requirement (no more embeddings/FAISS)
✅ Created simple RAG manager that just links to training data
✅ Added comprehensive console logging to track execution
✅ Verified training data exists (2 items available)
✅ Verified Rust code compiles without errors
✅ Verified all Tauri commands are registered

---

## How to Test & Debug

### Step 1: Start the App with Dev Tools

```bash
cd /Users/nadavshanun/Downloads/ArkAngel2
npm run tauri dev
```

When the app opens:
1. Right-click anywhere → **Inspect**
2. Go to **Console** tab
3. Keep this open during testing

### Step 2: Try Creating a Persona

1. Go to **Advanced Settings** → **Training** tab
2. Click **"Start Training"** button
3. **Step 1:** Check both training items (or click "Select All (2)")
4. Click **"Next"**
5. **Step 2:** Enter name: `Debug Test`
6. Click **"Create Persona"**

### Step 3: Watch the Console

You should see these logs appear:

```
[CreatePersona] Starting persona creation...
[CreatePersona] Name: Debug Test
[CreatePersona] Description: 
[CreatePersona] Selected items: Array(2) ["training_document_...", "training_transcript_..."]
[CreatePersona] Tauri invoke loaded
[CreatePersona] Calling create_rag_persona...
```

**If successful:**
```
[CreatePersona] Persona created successfully: {id: "rag_...", name: "Debug Test", ...}
```

**If failed:**
```
[CreatePersona] ERROR creating persona: [error message here]
[CreatePersona] Error type: string/object/Error
[CreatePersona] Error details: {full JSON dump of error}
```

---

## What Each Log Means

| Log Message | Meaning | If Missing... |
|------------|---------|---------------|
| `Starting persona creation...` | Button was clicked, function started | Button not wired up correctly |
| `Name: ...` | Got the persona name | State not set |
| `Selected items: Array(2)` | Got the training items | Selection not working |
| `Tauri invoke loaded` | Tauri API imported successfully | Build issue or missing dependency |
| `Calling create_rag_persona...` | About to call Rust backend | - |
| `Persona created successfully` | Backend returned persona object | **Most likely where it's failing** |
| `ERROR creating persona` | Backend threw an error | **Check this error message** |

---

## Common Errors & Fixes

### Error: "Failed to initialize RAG manager"

**Meaning:** Rust can't find the training_data directory

**Fix:**
```bash
# Verify it exists
ls -la training_data/

# If missing, recreate it
mkdir -p training_data
```

### Error: "Training item not found: training_document_..."

**Meaning:** The selected training item doesn't exist in training_data/

**Fix:**
```bash
# Check what items exist
cat training_data/training_index.json | jq '.items[].id'

# Should show:
# "training_document_7976fe8d-8ef8-45ea-af3b-dea2e59939eb"
# "training_transcript_2025-09-17_7108d21b"
```

### Error: "invalid args 'trainingItemIds'"

**Meaning:** Parameter naming mismatch between frontend and backend

**Check:** Frontend should use camelCase:
```typescript
await invoke('create_rag_persona', {
  name: personaName,              // ✅ camelCase
  description: personaDescription, // ✅ camelCase
  trainingItemIds: Array.from(selectedItems), // ✅ camelCase
});
```

### No Error, Just Stuck at 0%

**Meaning:** Code is hanging somewhere, not throwing an error

**Debug:**
1. Check which log appears last
2. If "Calling create_rag_persona..." is last → Backend is hanging
3. Check terminal running `tauri dev` for Rust panic/error messages

---

## Backend Verification

Check if persona file was created:

```bash
ls -la rag_personas/
```

**Expected:** Empty directory before creation, one `rag_*.json` file after

**If file exists:**
```bash
cat rag_personas/rag_*.json
```

Should show:
```json
{
  "id": "rag_abc123...",
  "name": "Debug Test",
  "description": "",
  "created_at": "2025-10-22T...",
  "updated_at": "2025-10-22T...",
  "training_item_ids": [
    "training_document_7976fe8d-8ef8-45ea-af3b-dea2e59939eb",
    "training_transcript_2025-09-17_7108d21b"
  ],
  "source_count": 2
}
```

---

## Terminal Output

While testing, also watch the terminal running `npm run tauri dev`.

**Look for:**
```
[SimpleRAG] Created persona: Debug Test with 2 sources
```

**Or errors like:**
```
Error: No such file or directory (os error 2)
thread 'main' panicked at 'Failed to...'
```

---

## Next Steps Based on Results

### If It Works!
- ✅ Progress goes 0% → 10% → 100% in < 1 second
- ✅ Success screen appears
- ✅ File created in `rag_personas/`
- **Next:** Test using the persona in chat

### If It Fails with Error
- Copy the full error message from console
- Copy any Rust error from terminal
- Check the "Common Errors" section above
- Report back with error details

### If It Hangs (No Error, Stuck at 0%)
- Note which log appears last
- Check terminal for Rust messages
- Try killing and restarting the app
- Check if `rag_personas/` directory exists and is writable

---

## Quick Checklist

Before reporting an issue, verify:

- [ ] Training data exists: `ls training_data/` shows 2 files
- [ ] Training index valid: `cat training_data/training_index.json` is valid JSON
- [ ] RAG personas dir exists: `ls rag_personas/` works (even if empty)
- [ ] App is running: `npm run tauri dev` succeeded
- [ ] Dev tools open: Console tab visible
- [ ] Logs appear: At least `[CreatePersona] Starting...` shows up
- [ ] Error captured: Full error message copied from console/terminal

---

**Once you complete these steps, we'll have the exact error and can fix it immediately.**

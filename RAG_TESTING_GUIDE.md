# RAG Persona Creation - Debugging & Testing Guide

**Date:** October 22, 2025
**Status:** Ready for testing with comprehensive logging

---

## Overview

This guide helps debug and test the instant RAG persona creation system. The system NO LONGER requires Python dependencies - it creates personas in < 1 second by simply linking to training data.

**Status:** ✅ Backend implementation complete
**Status:** ✅ Console logging added for debugging
**Status:** 🔍 Awaiting user testing

---

## Prerequisites

1. **Application running:**
   ```bash
   cd /Users/nadavshanun/Downloads/ArkAngel2
   npm run tauri dev
   ```

2. **Training data exists** (already present in your system):
   - `training_document_7976fe8d-8ef8-45ea-af3b-dea2e59939eb.json`
   - `training_transcript_2025-09-17_7108d21b.json`

3. **Developer tools open** to view console logs

---

## Complete Testing Workflow

### Phase 1: Upload and Prepare Training Data

#### Test 1.1: Upload Documents
1. Open Advanced Settings → **Documents** section
2. Click "Upload File" button
3. Upload a test document (PDF, TXT, or code file)
4. **Expected:** File appears in documents list with metadata (name, size, type)

#### Test 1.2: Add Documents to Training
1. In Documents section, toggle "Selection Mode" on
2. Check the box next to your uploaded document
3. Click "Add to Training" button
4. Click "Save to Training" in the dialog
5. **Expected:** Success message appears
6. **Backend Check:** Verify `training_data/training_document_*.json` file exists

#### Test 1.3: Add Transcripts to Training (Optional)
1. Open Advanced Settings → **Transcripts** section
2. Select one or more conversation transcripts
3. Click "Add to Training" button
4. Select transcripts and click "Save to Training"
5. **Expected:** Success message appears
6. **Backend Check:** Verify `training_data/training_transcript_*.json` file exists

---

### Phase 2: Create RAG Persona

#### Test 2.1: Open Training Page
1. Open Advanced Settings → **Training** section
2. **Expected:** See list of training items with filters (All, Documents, Transcripts)
3. **Expected:** See live counts for each filter

#### Test 2.2: Launch Create Persona Wizard
1. Click "Start Training" button at the top
2. **Expected:** Create Persona Wizard opens with Step 1

#### Test 2.3: Step 1 - Select Training Data
1. **Expected:** See all documents and transcripts with checkboxes
2. Check off one or more items
3. **Expected:** Selection counter updates (e.g., "3 items selected")
4. Try quick selection buttons:
   - Click "Select All" → all items checked
   - Click "Deselect All" → all items unchecked
   - Click "All Documents" → only documents checked
   - Click "All Transcripts" → only transcripts checked
5. Select at least 1-2 items
6. Click "Next" button

#### Test 2.4: Step 2 - Configure Persona
1. **Expected:** See name and description inputs
2. **Expected:** See training data summary (e.g., "2 documents, 1 transcript")
3. Enter a name (e.g., "Technical Documentation Expert")
4. Enter a description (e.g., "Trained on product docs and API specs")
5. Click "Create Persona" button

#### Test 2.5: Step 3 - Processing
1. **Expected:** Animated progress bar appears
2. **Expected:** Phase indicators show progress:
   - "Extracting text from sources..."
   - "Chunking text into semantic units..."
   - "Generating embeddings..."
   - "Finalizing RAG system..."
3. **Wait 30-120 seconds** (depends on data size)
4. **Console Check:** Open DevTools console and look for:
   ```
   [Wizard] Starting persona creation...
   [Wizard] Creating RAG persona...
   [Wizard] Persona created: <uuid>
   ```

#### Test 2.6: Step 4 - Success
1. **Expected:** Success screen appears with:
   - Checkmark icon
   - "Persona Created Successfully!"
   - Persona name and description
   - Source count and chunk count
2. **Backend Check:** Verify `rag_systems/<uuid>/` directory exists with:
   - `metadata.json` (persona info, sources, config)
   - `chunks.json` (all text chunks)
   - `index.faiss` (FAISS vector index)
3. Click "Done" button

#### Test 2.7: Verify Persona Display
1. **Expected:** Wizard closes, back at Training page
2. **Expected:** New RAG persona card appears at top with:
   - Name
   - Description
   - Source count (e.g., "3 sources")
   - Chunk count (e.g., "120 chunks")
   - Embedding model (e.g., "all-MiniLM-L6-v2")
   - Created date
   - Delete button (trash icon)
   - "Use in Angel Profiles" button (star icon)

---

### Phase 3: Link RAG Persona to Angel Profile

#### Test 3.1: Create or Edit Angel Profile
1. Open Advanced Settings → **Angel Profiles** section
2. **Option A - Create New:**
   - Click "+ Create New Persona" button
   - Enter name (e.g., "Documentation Helper")
   - Enter system prompt (e.g., "You help users understand technical documentation")
3. **Option B - Edit Existing:**
   - Click "Edit" button on an existing persona
   - Note the current name and prompt

#### Test 3.2: Enable RAG for Profile
1. Scroll down to "Enable RAG" section (below prompt)
2. Check the "Enable RAG (Retrieval-Augmented Generation)" checkbox
3. **Expected:** RAG system dropdown appears

#### Test 3.3: Select RAG System
1. **Expected:** Dropdown shows available RAG personas from Training page
2. **Expected:** Each option shows: `<name> (<source_count> sources, <chunk_count> chunks)`
3. Select your RAG persona from dropdown
4. Click "Save" button

#### Test 3.4: Verify RAG Linkage
1. **Expected:** Angel profile saved successfully
2. **Expected:** Editing the profile again shows RAG still enabled and selected
3. **LocalStorage Check:** Open DevTools → Application → Local Storage → `personas` key
   - Find your persona object
   - Verify `ragEnabled: true`
   - Verify `ragSystemId: "<uuid>"`
   - Verify `ragQueryTopK: 5`

---

### Phase 4: Test RAG-Enabled Chat

#### Test 4.1: Select RAG-Enabled Persona
1. Open Advanced Settings → **Angel Profiles** section
2. Click "Use" button on your RAG-enabled persona
3. **Expected:** Persona becomes active (highlighted)
4. Close settings and return to chat interface

#### Test 4.2: Send Test Query
1. In the chat interface, type a question related to your training data
   - Example: If you uploaded Python docs, ask "How do I create a class in Python?"
   - Example: If you uploaded meeting notes, ask "What were the key decisions from last week?"
2. Send the message

#### Test 4.3: Monitor RAG Query (Console)
1. Open DevTools → Console
2. **Expected:** See RAG query logs:
   ```
   [useCompletion] RAG enabled, querying RAG system: <uuid>
   [useCompletion] Retrieved 5 RAG chunks
   [useCompletion] RAG context injected into system prompt
   ```
3. **Expected:** Backend Rust logs show:
   ```
   [rag_system_manager] Querying RAG system...
   [rag_system_manager] Calling Python embedding service...
   [rag_system_manager] Retrieved top-5 chunks
   ```

#### Test 4.4: Verify Contextual Response
1. **Expected:** AI response uses information from your training data
2. **Expected:** Response is specific to your uploaded documents
3. **Compare:** Send the same question with a non-RAG persona
   - The response should be generic without specific context

#### Test 4.5: Test with Multiple Queries
1. Ask 3-5 different questions related to your training data
2. **Expected:** Each query retrieves relevant chunks and provides contextual answers
3. **Verify:** Console shows RAG query logs for each message

---

### Phase 5: Edge Cases and Error Handling

#### Test 5.1: RAG Query Failure
1. Stop the Python service (if running separately) or corrupt a file
2. Send a message with RAG-enabled persona
3. **Expected:** Console shows error: `[useCompletion] RAG query failed: <error>`
4. **Expected:** Chat continues without RAG context (graceful degradation)
5. **Expected:** User still receives a response (not broken)

#### Test 5.2: No RAG Systems Available
1. Delete all RAG personas from Training page
2. Open Advanced Settings → Angel Profiles → Create or Edit
3. Enable RAG checkbox
4. **Expected:** See warning: "No RAG systems available. Create one in the Training section first."
5. **Expected:** Cannot save with RAG enabled but no system selected

#### Test 5.3: Delete RAG Persona
1. Open Advanced Settings → Training section
2. Click trash icon on a RAG persona card
3. **Expected:** Button changes to "Confirm?"
4. Click again to confirm
5. **Expected:** Persona deleted from UI
6. **Backend Check:** Verify `rag_systems/<uuid>/` directory is deleted
7. Open Advanced Settings → Angel Profiles
8. Edit a profile that was using the deleted RAG system
9. **Expected:** RAG dropdown no longer shows deleted system

---

## Performance Benchmarks

### Expected Performance Metrics

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Embedding Generation | ~2-5s per 100 texts | CPU-based, first run slower (model download) |
| FAISS Index Creation | <1s for 1000 vectors | Very fast for small datasets |
| RAG Query (top-5) | <1s | Includes embedding + FAISS search |
| Persona Creation | 30-120s | Depends on source count and size |

### Performance Tests

#### Test P1: Small Dataset (1-5 documents)
1. Create RAG persona with 1-5 small documents (~10 pages each)
2. **Expected:** Persona creation completes in <60 seconds
3. **Expected:** RAG queries return in <1 second

#### Test P2: Medium Dataset (10-20 documents)
1. Create RAG persona with 10-20 medium documents (~50 pages each)
2. **Expected:** Persona creation completes in 60-120 seconds
3. **Expected:** RAG queries still return in <2 seconds

#### Test P3: Large Dataset (50+ documents)
1. Create RAG persona with 50+ large documents
2. **Expected:** Persona creation may take 2-5 minutes
3. **Expected:** RAG queries may take 2-3 seconds
4. **Note:** Consider chunking strategy optimization if queries are slow

---

## Debugging & Troubleshooting

### Issue 1: Python Service Not Found
**Symptoms:** Persona creation fails with "Python not found" error

**Fix:**
```bash
# Verify Python is installed
python3 --version

# Install dependencies
cd sidecar/python_embeddings
python3 -m pip install -r requirements.txt

# Test service manually
echo '["Hello world"]' | python3 embedding_service.py embed
```

### Issue 2: First Persona Creation Very Slow
**Symptoms:** First persona takes 5+ minutes to create

**Explanation:** `all-MiniLM-L6-v2` model is being downloaded (~80MB) on first run

**Fix:** Wait for download to complete. Subsequent persona creations will be much faster.

### Issue 3: RAG Query Returns No Results
**Symptoms:** Console shows "Retrieved 0 RAG chunks"

**Possible Causes:**
1. Query is completely unrelated to training data
2. FAISS index is corrupted
3. Embedding model mismatch

**Debug Steps:**
1. Check `rag_systems/<uuid>/metadata.json` for correct config
2. Check `rag_systems/<uuid>/chunks.json` has content
3. Try recreating the RAG persona
4. Test with a more specific query

### Issue 4: Chat Response Doesn't Use RAG Context
**Symptoms:** RAG query succeeds but response is generic

**Possible Causes:**
1. LLM ignoring injected context
2. Context format incorrect
3. System prompt too long (context truncated)

**Debug Steps:**
1. Check console for "RAG context injected" log
2. Temporarily log the `systemPrompt` variable to see injected context
3. Verify chunks are relevant to the query
4. Try with a different LLM model

---

## Success Criteria Checklist

Use this checklist to verify full RAG integration:

### ✅ Phase 1: Training Data
- [ ] Documents upload successfully
- [ ] Documents convert to RAG-optimized JSON format
- [ ] Transcripts convert to RAG-optimized JSON format
- [ ] Training page displays all items with filters

### ✅ Phase 2: Persona Creation
- [ ] Create Persona Wizard opens and works
- [ ] Step 1: Select training data with checkboxes
- [ ] Step 2: Configure name and description
- [ ] Step 3: Progress bar shows real-time updates
- [ ] Step 4: Success screen displays metadata
- [ ] Backend creates `rag_systems/<uuid>/` directory with all files

### ✅ Phase 3: RAG Display
- [ ] Training page shows RAG persona cards at top
- [ ] Cards display name, description, source/chunk counts
- [ ] Delete functionality works with confirmation
- [ ] "Use in Angel Profiles" button exists

### ✅ Phase 4: Angel Profile Integration
- [ ] Angel Profiles section has RAG checkbox
- [ ] RAG system dropdown shows available personas
- [ ] Saving persona stores RAG fields in localStorage
- [ ] Editing persona reloads RAG settings correctly

### ✅ Phase 5: Chat Integration
- [ ] Selecting RAG-enabled persona works
- [ ] Sending message triggers RAG query (console logs)
- [ ] Retrieved chunks injected into system prompt
- [ ] AI response uses context from training data
- [ ] Multiple queries work consecutively

### ✅ Phase 6: Error Handling
- [ ] RAG query failure doesn't break chat
- [ ] Missing RAG systems show warning message
- [ ] Deleted RAG personas removed from dropdowns
- [ ] Invalid queries return gracefully

---

## Testing Summary Report Template

After completing all tests, fill out this report:

```markdown
## RAG System Testing Report

**Date:** [Date]
**Tester:** [Name]
**App Version:** [Version]

### Test Results

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Training Data | ✅ / ❌ | [Notes] |
| Phase 2: Persona Creation | ✅ / ❌ | [Notes] |
| Phase 3: RAG Display | ✅ / ❌ | [Notes] |
| Phase 4: Angel Profile Integration | ✅ / ❌ | [Notes] |
| Phase 5: Chat Integration | ✅ / ❌ | [Notes] |
| Phase 6: Error Handling | ✅ / ❌ | [Notes] |

### Performance Metrics

- Persona Creation Time: [Time]
- RAG Query Time: [Time]
- Chunk Retrieval Accuracy: [Rating]

### Issues Found

1. [Issue description]
2. [Issue description]

### Recommendations

1. [Recommendation]
2. [Recommendation]

### Overall Assessment

[Summary of testing results and readiness for production]
```

---

## Next Steps After Testing

If all tests pass:

1. **Production Deployment:**
   - Build production app: `npm run tauri build`
   - Test production build with RAG workflow
   - Distribute to users

2. **User Documentation:**
   - Create user-facing guide for RAG features
   - Add tooltips in UI for RAG settings
   - Provide example use cases

3. **Future Enhancements:**
   - Add RAG persona export/import
   - Support for incremental updates to RAG systems
   - Advanced chunking strategies (semantic segmentation)
   - Support for more embedding models
   - Cloud sync for RAG personas

---

**Implementation Complete:** January 2025
**Total Features:** 6 phases, 30+ test cases
**Technology:** React + Rust + Python + FAISS + sentence-transformers

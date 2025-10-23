# RAG System Testing Guide

## ✅ What Was Fixed

The RAG persona creation was completely broken - stuck at "Step 0 of 5" with no logs. Here's what we fixed:

### Root Cause
**Wrong Tauri API usage**: Used `emit_all()` which doesn't exist in Tauri 2.x. Should be `emit()`.

### Fixes Applied
1. **✅ Corrected event emission** - Changed all `emit_all()` to `emit()` (Tauri 2.x broadcasts to all windows by default)
2. **✅ Added error handling** - No more silent failures with `let _ = ...`
3. **✅ Comprehensive logging** - Both Rust console and browser console now show detailed logs
4. **✅ Frontend timing** - Added 100ms delay to ensure event listeners are ready

## 🧪 How to Test

Since the dev server keeps crashing due to sidecar issues, here's how to test manually:

### Option 1: Direct Cargo Run (Recommended)
```bash
# Terminal 1: Start frontend
cd /Users/nadavshanun/Downloads/ArkAngel2
npm run dev

# Terminal 2: Start backend separately
cd /Users/nadavshanun/Downloads/ArkAngel2/src-tauri
cargo run
```

### Option 2: Skip Sidecar Build
```bash
# If sidecar is already running on port 8765:
cd /Users/nadavshanun/Downloads/ArkAngel2
PORT_IN_USE=true npm run tauri dev
```

### Option 3: Fix Sidecar First
```bash
cd /Users/nadavshanun/Downloads/ArkAngel2/sidecar
npm install  # or npm ci if you have package-lock.json
npm run build

# Then run normally:
cd ..
npm run tauri dev
```

## 📊 Testing Steps

### 1. Open DevTools
**Cmd+Option+I** to see console logs

### 2. Navigate to Training Data
1. Click Settings (⚙️)
2. Go to "Training Data" tab
3. Add test data if none exists

### 3. Create Persona
1. Click "Create RAG Persona"
2. Select training items
3. Click "Next"
4. Enter name: "Test Persona"
5. Click "Create Persona"

### 4. Verify Logs Appear

**Browser Console should show:**
```
========================================
🚀 [CreatePersona] STARTING PERSONA CREATION
========================================
[CreatePersona] ✅ Tauri invoke API loaded
[CreatePersona] 📡 Setting up event listener for "rag_progress"...
[CreatePersona] ✅ Progress event listener registered
[CreatePersona] 📡 Setting up event listener for "app_log"...
[CreatePersona] ✅ Log event listener registered

🎯 [CreatePersona] RAG PROGRESS EVENT RECEIVED!
[CreatePersona] Status: Validating training data...
[CreatePersona] Step: 1 / 5
[CreatePersona] Percentage: 20%

📝 [CreatePersona] LOG EVENT: { level: "info", source: "RAG", message: "🚀 Starting RAG persona creation..." }
```

**Terminal should show:**
```
[SimpleRAG] Emitting startup logs to frontend...
[SimpleRAG] ✅ Startup log emitted
[SimpleRAG] Emitting rag_progress event...
[SimpleRAG] ✅ Progress event 1 emitted successfully
[SimpleRAG] Step 1/5: Validating 2 training items
[SimpleRAG] Validating item 1/2...
```

### 5. Check UI Updates
- ✅ Progress bar: 0% → 20% → 40% → 60% → 80% → 100%
- ✅ Step indicator: 0/5 → 1/5 → 2/5 → 3/5 → 4/5 → 5/5
- ✅ Status messages updating
- ✅ Checkmarks appearing
- ✅ "Show Logs" button works
- ✅ Success screen appears

## 🔍 Debugging

### If Events Don't Fire

**Check 1: Emitter trait imported**
```rust
// In simple_rag_manager.rs (line 6)
use tauri::Emitter;  // ✅ Must be present
```

**Check 2: Event names match**
```rust
// Rust side:
app_handle.emit("rag_progress", event)  // ✅

// Frontend:
listen('rag_progress', callback)  // ✅ Same name
```

**Check 3: Command registered**
```rust
// In lib.rs invoke_handler:
create_rag_persona,  // ✅ Must be listed
```

### If Progress Stays at 0%

**Browser Console:**
```javascript
// Should see:
[CreatePersona] 🎬 Calling create_rag_persona Tauri command...

// If you see error instead:
❌ [CreatePersona] ERROR OCCURRED!
```

**Terminal:**
```bash
# Should see:
=== [SimpleRAG] Starting RAG Persona Creation ===

# If nothing appears, check:
- Is Rust backend running?
- Any panic/error in terminal?
```

### Common Issues

**Issue**: "No logs yet. Waiting for activity..."
- **Cause**: Events not reaching frontend
- **Fix**: Check event listener setup logs in console

**Issue**: Console shows invoke but no terminal logs
- **Cause**: Rust command not being called
- **Fix**: Check `invoke_handler` in `lib.rs` includes `create_rag_persona`

**Issue**: Terminal shows events emitted but frontend doesn't receive
- **Cause**: Event channel mismatch or listener not set up
- **Fix**: Verify event names match exactly (case-sensitive!)

## 📁 Files Changed

### Rust Backend:
```
src-tauri/src/simple_rag_manager.rs
├── Added: Comprehensive logging
├── Fixed: emit() instead of emit_all()
├── Added: Error handling for all emits
└── Enhanced: Progress tracking
```

### Frontend:
```
src/components/training/CreatePersonaWizard.tsx
├── Added: Extensive console logging
├── Added: 100ms delay before invoke
├── Fixed: Separate event listeners
└── Enhanced: Error reporting
```

### Documentation:
```
RAG_SYSTEM_FIXED.md - What was fixed and why
RAG_LOGGING_SYSTEM.md - Original logging system docs
TESTING_GUIDE.md - This file
```

## 🎯 Success Criteria

A successful RAG persona creation will:
1. ✅ Show logs in browser console
2. ✅ Show logs in terminal
3. ✅ Progress from 0% to 100%
4. ✅ Complete all 5 steps with checkmarks
5. ✅ Display success screen
6. ✅ Create persona file in `rag_personas/` folder

## 🚀 Next Steps

If testing is successful:
1. Verify persona file exists: `ls rag_personas/`
2. Check persona can be loaded in UI
3. Test persona selection in chat
4. Verify RAG context injection works

## 📞 Support

If you still encounter issues:
1. Check both console and terminal logs
2. Verify all files were saved
3. Try `cargo clean && cargo build`
4. Restart dev server completely

---

**Status**: ✅ Fixes Applied, Ready for Testing
**Date**: 2025-01-22
**Tauri Version**: 2.7.0

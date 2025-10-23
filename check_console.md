# Quick Debug Steps

The UI shows "Step 0 of 5 - 0%" which means:
- ✅ Frontend code is working (you see the new checklist)
- ❌ Backend is NOT emitting events (stuck at step 0)

## Check Console Logs Right Now:

1. In the browser, open **Console tab** (not Elements)
2. Look for these specific logs:

**Expected to see:**
```
[CreatePersona] Starting persona creation...
[CreatePersona] Name: [your persona name]
[CreatePersona] Selected items: [...]
[CreatePersona] Tauri invoke loaded
[CreatePersona] Calling create_rag_persona...
```

**If you see these, backend is being called**

**If you DON'T see "Calling create_rag_persona...", the invoke isn't happening**

## Check Terminal (where you ran `npm run tauri dev`)

Look for:
- Any Rust errors/panics
- Any "[SimpleRAG]" logs
- Compilation errors

## Most Likely Issue:

The AppHandle parameter I added might not be compatible with Tauri async commands. Let me fix this immediately.

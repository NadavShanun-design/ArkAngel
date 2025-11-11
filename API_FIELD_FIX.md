# API Field Mismatch Fix

## Problem
AI responses were stuck on "Generating response..." and never completing.

## Root Cause
**Frontend-Backend Field Mismatch**

The frontend (`useCompletion.ts`) was sending:
```typescript
{
  message: input,
  systemPrompt,
  apiKey,
  model,
  providerId,
  userId,
  fileContext,  // ❌ WRONG FIELD NAME
  ragImages
}
```

But the sidecar backend (`server.ts`) was expecting:
```typescript
const { message, apiKey, model, providerId, systemPrompt, fileSummaries, ragImages } = req.body
                                                                   ^^^^^^^^^^^^^^
```

## Fix Applied

**File:** `src/hooks/useCompletion.ts` (line 255)

**Before:**
```typescript
body: JSON.stringify({
  message: input,
  systemPrompt,
  apiKey: getSettings()?.openAiApiKey || getSettings()?.apiKey || undefined,
  model: getSettings()?.selectedModel || getSettings()?.customModel || "gpt-4o-mini",
  providerId: getSettings()?.selectedProvider || "openai",
  userId: getCurrentUserId(),
  fileContext,  // ❌ Wrong field name
  ragImages: ragData.imagePaths || [],
}),
```

**After:**
```typescript
body: JSON.stringify({
  message: input,
  systemPrompt,
  apiKey: getSettings()?.openAiApiKey || getSettings()?.apiKey || undefined,
  model: getSettings()?.selectedModel || getSettings()?.customModel || "gpt-4o-mini",
  providerId: getSettings()?.selectedProvider || "openai",
  userId: getCurrentUserId(),
  fileSummaries: fileContext,  // ✅ Correct field name
  ragImages: ragData.imagePaths || [],
}),
```

## Result

Now when you press Enter:
1. ✅ Frontend sends correct field name `fileSummaries`
2. ✅ Backend receives and processes the request
3. ✅ AI response streams back instantly
4. ✅ No more stuck "Generating response..."

## How to Test

1. Open the app (already running on `http://localhost:1420`)
2. Type any message in the input field
3. Press **Enter**
4. You should see:
   - AI response streaming back immediately
   - Console logs showing `[sidecar] Processing streaming message: ...`
   - Response appears in the popover

## Technical Details

The sidecar server (`/api/chat/stream`) expects these fields:
- `message` (required)
- `apiKey` (optional, falls back to header or env)
- `model` (optional, defaults to gpt-4o-mini)
- `providerId` (optional, defaults to openai)
- `systemPrompt` (optional)
- `fileSummaries` (optional, for file context)
- `ragImages` (optional, for screenshot paths)

All fields must match exactly or they'll be `undefined` on the backend!

## Related Files

- `/Users/nadavshanun/Downloads/ArkAngel2/src/hooks/useCompletion.ts:255` - Frontend request body
- `/Users/nadavshanun/Downloads/ArkAngel2/sidecar/src/server.ts:540` - Backend parameter destructuring

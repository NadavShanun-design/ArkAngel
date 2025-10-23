# Agent Debugging Guide

## Current Issue

User is seeing "Agent is processing..." but not the detailed thoughts, screenshots, and actions.

## Debugging Steps

### 1. Check Browser Console

Open DevTools (Cmd+Option+I) and look for:

```
🔍 UI-TARS Update Received: {
  status: 'running',
  thought: '...',
  action: '...',
  loopCount: 1,
  hasScreenshot: true,
  messageLength: 234,
  fullResponse: {...}
}
```

### 2. Check Tauri Console

Look at the terminal running `npm run tauri dev` for:

```
[UITars] Response: status=running, message=Thought: I need to...
```

### 3. Manual Service Test

```bash
cd src-tauri/uitars-service
echo '{"instruction":"test","config":{"provider":"openai","apiKey":"YOUR_KEY","model":"gpt-4o"}}' | node dist/index.js
```

Expected output:
```json
{"success":true,"message":"UI-TARS service ready","status":"completed"}
{"success":true,"message":"Thought: ...","status":"running","thought":"...","action":"...","loopCount":1}
```

## Common Issues

### Issue 1: No API Key

**Symptom:** Agent starts but never sends updates

**Fix:** Make sure you've entered a valid API key in the Agent settings

### Issue 2: Service Not Running

**Symptom:** "Failed to start UI-TARS agent"

**Fix:**
```bash
cd src-tauri/uitars-service
npm install
npm run build
```

### Issue 3: Events Not Received

**Symptom:** Console shows no "🔍 UI-TARS Update Received" logs

**Fix:** Check that the service is spawning correctly. Look for:
```
[UITars] Starting service at /path/to/uitars-service
[UITars] Service spawned successfully
```

### Issue 4: Thought/Action Empty

**Symptom:** Console shows updates but thought/action are undefined

**Possible Causes:**
1. AI model response format changed
2. Regex pattern not matching
3. Model not following expected format

**Debug:**
```javascript
// Check what the raw message looks like
console.log('Raw message:', response.message);
```

## Expected Message Format

The AI should respond in this format:

```
Thought: I need to open the Calculator app. I can see the macOS dock at the bottom.
Action: click(start_box='[1245, 980, 1285, 1020]')
```

Our regex extracts:
- `Thought:` section → `thought` field
- `Action:` section → `action` field

## Quick Fix Checklist

- [ ] Valid API key entered
- [ ] Agent status shows "Running"
- [ ] Browser console open (Cmd+Option+I)
- [ ] Looking at console for "🔍 UI-TARS Update Received"
- [ ] Service rebuilt (`npm run build` in uitars-service)
- [ ] Frontend rebuilt (`npm run build` in root)
- [ ] macOS permissions granted (Screen Recording + Accessibility)

## Next Steps

If still not working:

1. **Copy console logs** - Send the full output from browser console
2. **Copy service output** - Send what the manual test outputs
3. **Check API key** - Verify it's valid with the provider
4. **Try different model** - Some models may format responses differently

## Emergency Fallback

If detailed updates still don't show, at least the enhanced "Agent is processing" box now shows:

- 🟢 Taking screenshot
- 🔵 Analyzing visual elements
- 🟣 Planning next action
- 🟡 Waiting for response

This gives better visibility than the old simple "processing..." message.

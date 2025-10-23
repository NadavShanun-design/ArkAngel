# How to See What the Agent is Thinking

## What I've Added

### 1. Enhanced "Processing" Display

Instead of just "Agent is processing...", you now see:

```
🤖 Agent is actively processing your request...

● Taking screenshot of your screen
● Analyzing visual elements
● Planning next action with AI model
● Waiting for detailed response...

💡 Updates will appear above when the agent starts thinking
```

### 2. Debug Console Logging

Every time the agent sends an update, it will log to the browser console:

```javascript
🔍 UI-TARS Update Received: {
  status: 'running',
  thought: 'I need to open Calculator...',
  action: 'click(start_box="[1245, 980, 1285, 1020]")',
  loopCount: 1,
  hasScreenshot: true,
  messageLength: 234
}
```

### 3. Detailed Message Display

When updates come through, they'll show as:

```markdown
📊 Step 1/25

🧠 Agent Thinking:
I need to open the Calculator app. Looking at the screen,
I can see the macOS dock at the bottom...

🎯 Planned Action:
click(start_box='[1245, 980, 1285, 1020]')

📸 What Agent Sees:
[Screenshot image here]
```

---

## How to See It Working

### Step 1: Open Browser Console

1. Click anywhere in the app
2. Press **Cmd+Option+I** (or Cmd+Opt+J)
3. Click the **"Console"** tab
4. Keep this open while testing

### Step 2: Make Sure Agent Has API Key

1. Go to Advanced Settings → Agent
2. Make sure you've entered a VALID API key
3. The key must be real (starts with `sk-` for OpenAI, etc.)

### Step 3: Send a Command

```
"Open Calculator and compute 234 × 567"
```

### Step 4: Watch the Console

You should see logs like:

```
[UITars] Sending command: Open Calculator...
🔍 UI-TARS Update Received: { status: 'running', thought: '...', ... }
🔍 UI-TARS Update Received: { status: 'running', thought: '...', ... }
...
```

---

## Why You Might Not See Updates

### Issue #1: No Valid API Key

**Symptom:** Agent starts but never processes

**Solution:**
- Make sure you've entered a REAL API key
- Test your API key works with the provider
- OpenAI keys start with `sk-`
- Claude keys start with `sk-ant-`

### Issue #2: Service Not Getting Responses

**Symptom:** Console shows "Waiting for detailed response..." forever

**Possible Causes:**
1. API key is invalid
2. Model name is wrong
3. Network issues
4. Provider is down

**Solution:**
- Double-check your API key
- Try a different model
- Check your internet connection

### Issue #3: Wrong Response Format

**Symptom:** Console logs show empty `thought` and `action`

**Cause:** The AI model isn't responding in the expected format

**Expected Format:**
```
Thought: <reasoning here>
Action: <action here>
```

**Solution:**
- This depends on the AI model following the system prompt
- Some models may format responses differently
- Check console logs to see the raw message

---

## Testing Checklist

Before testing, make sure:

- [ ] ✅ Agent is "Running" (green status)
- [ ] ✅ Valid API key entered
- [ ] ✅ Browser console is open (Cmd+Option+I)
- [ ] ✅ You're looking at the Console tab
- [ ] ✅ macOS permissions granted:
  - Screen Recording
  - Accessibility

---

## What to Look For

### In the Browser Console:

1. **Service Starting:**
```
[UITars] Starting service at /path/to/uitars-service
[UITars] Service spawned successfully
```

2. **Command Sent:**
```
[UITars] Sending command: Open Calculator...
```

3. **Updates Received:**
```
🔍 UI-TARS Update Received: {
  status: 'running',
  thought: 'I need to...',
  action: 'click(...)',
  loopCount: 1,
  hasScreenshot: true
}
```

4. **Message Created:**
The chat should show a new message with the thought, action, and screenshot.

### In the Chat UI:

You should see messages like:

```
📊 Step 1/25

🧠 Agent Thinking:
[The agent's reasoning]

🎯 Planned Action:
[The action it will take]

📸 What Agent Sees:
[Screenshot image]
```

---

## If It's Still Not Working

### Debug Mode: Check What's Actually Happening

1. **Open DevTools Console** (Cmd+Option+I)

2. **Send a command** to the agent

3. **Look for these logs:**

```javascript
// Should see this when updates arrive:
🔍 UI-TARS Update Received: { ... }

// Check if thought/action are present:
thought: "I need to open Calculator..."
action: "click(start_box='[1245, 980, 1285, 1020]')"

// If these are empty/undefined, the AI isn't responding in the right format
```

4. **Check the full response:**

Look for `fullResponse` in the console log. This shows everything the service sent.

### If Console Shows Empty Updates

The service is working, but the AI model isn't responding in the expected format.

**Try:**
1. Different AI provider (switch from OpenAI to Claude, etc.)
2. Different model (try `gpt-4o` instead of `gpt-4o-mini`)
3. Wait longer (first request can be slow)

### If Console Shows Nothing

The service isn't sending events.

**Check:**
1. Is the agent status "Running"?
2. Did you get a "Failed to start" error?
3. Look for [UITars] logs in the Tauri console

---

## Emergency Fallback

Even if detailed updates don't show immediately, the enhanced processing box now displays:

```
🤖 Agent is actively processing your request...

🟢 Taking screenshot of your screen
🔵 Analyzing visual elements
🟣 Planning next action with AI model
🟡 Waiting for detailed response...

💡 Updates will appear above when the agent starts thinking
```

This gives you:
- Visual confirmation it's working
- Progress indicators
- Clear status updates

Much better than the old simple "Agent is processing..." message!

---

## Next Steps

1. **Restart the app:**
```bash
npm run tauri dev
```

2. **Open console FIRST** (Cmd+Option+I)

3. **Go to Agent settings**

4. **Enter a VALID API key**

5. **Start the agent**

6. **Send a test command:**
```
"Open Calculator"
```

7. **Watch the console** for logs

8. **Report what you see:**
   - Are there `🔍 UI-TARS Update Received` logs?
   - What does the `fullResponse` contain?
   - Is `thought` and `action` populated?

---

## Files Changed

1. ✅ `src/components/advanced/AdvancedSettingsPage.tsx`
   - Added enhanced processing display
   - Added console.log debugging
   - Already has detailed message formatting

2. ✅ `src-tauri/uitars-service/src/agent.ts`
   - Already parses thought/action
   - Already sends detailed updates

3. ✅ Both rebuilt successfully

---

**Next:** Restart the app, open console, and try the test command!

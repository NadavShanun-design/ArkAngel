# ✅ Composio Integration Testing Checklist

## Pre-Testing Setup

- [ ] Composio API key obtained from https://app.composio.dev/
- [ ] OpenAI API key ready
- [ ] `.env` file created in `sidecar/` with all required keys
- [ ] Dependencies installed (`npm install` in sidecar)
- [ ] Sidecar built (`npm run build` in sidecar)

---

## Phase 1: Installation Verification

### 1.1 Check Dependencies
```bash
cd sidecar
cat package.json | grep composio
```
**Expected**: Should show `composio-core` and `langchain` dependencies

### 1.2 Check TypeScript Compilation
```bash
npm run build
```
**Expected**: No TypeScript errors, files created in `dist/`

### 1.3 Start Sidecar
```bash
npm start
```
**Expected Output**:
```
🚀 MCP Chat Server running on http://localhost:8765
[Feature Flags] Status:
  USE_COMPOSIO: ✅ Enabled (or ❌ Disabled)
```

---

## Phase 2: API Endpoint Testing

### 2.1 Health Check
```bash
curl http://localhost:8765/api/health
```
**Expected**: `{"status":"ok","timestamp":"..."}`

### 2.2 Composio Health Check
```bash
curl http://localhost:8765/api/composio/health
```
**Expected** (if configured):
```json
{
  "configured": true,
  "healthy": true,
  "status": "ok",
  "message": "Composio is configured and accessible"
}
```

**Expected** (if not configured):
```json
{
  "configured": false,
  "healthy": false,
  "status": "not_configured",
  "message": "COMPOSIO_API_KEY not set"
}
```

### 2.3 Get User Tools (before any connections)
```bash
curl http://localhost:8765/api/integrations/test_user
```
**Expected**: `{"tools":[],"count":0}`

---

## Phase 3: OAuth Connection Testing

### 3.1 Initiate Slack Connection
```bash
curl -X POST http://localhost:8765/api/integrations/connect \
  -H "Content-Type: application/json" \
  -d '{"tool":"SLACK","userId":"test_user"}'
```

**Expected Response**:
```json
{
  "redirectUrl": "https://composio.dev/oauth/...",
  "connectionId": "conn_..."
}
```

### 3.2 Complete OAuth Flow
- [ ] Copy `redirectUrl` from response
- [ ] Open URL in browser
- [ ] Complete OAuth authorization
- [ ] Verify redirect to `http://localhost:1420/settings?integration=success`

### 3.3 Verify Connection
```bash
curl http://localhost:8765/api/integrations/test_user
```
**Expected**: Should now show Slack in connected tools

---

## Phase 4: Tool Execution Testing

### 4.1 Test Direct Chat (without tools)
**In ArkAngel UI**, try:
```
What is 2+2?
```
**Expected**: Normal AI response, no tools called

### 4.2 Test Tool-Required Query
**In ArkAngel UI**, try:
```
What are the benefits of using Slack for team communication?
```
**Expected**: AI response without calling tools (informational query)

### 4.3 Test Slack Integration (if connected)
**In ArkAngel UI**, try:
```
Send a test message to #general on Slack
```
**Expected**:
- UI shows "Using tool: slack.send_message"
- Message appears in Slack
- Success confirmation in UI

### 4.4 Test GitHub Integration (if connected)
**In ArkAngel UI**, try:
```
Create a GitHub issue titled "Test integration"
```
**Expected**:
- Tool execution indicator
- Issue created in GitHub
- Issue URL returned

---

## Phase 5: Feature Flag Testing

### 5.1 Disable Composio
Edit `sidecar/.env`:
```bash
USE_COMPOSIO=false
```
Restart sidecar.

### 5.2 Test Legacy Mode
**In ArkAngel UI**, send a message.
**Expected**: Falls back to mcp-use Google Workspace integration

### 5.3 Re-enable Composio
Edit `sidecar/.env`:
```bash
USE_COMPOSIO=true
```
Restart sidecar.

### 5.4 Frontend Toggle (Alternative)
**In browser console**:
```javascript
localStorage.setItem('use_composio', 'true')
```
Reload app.

---

## Phase 6: Error Handling

### 6.1 Test Invalid Tool
```bash
curl -X POST http://localhost:8765/api/integrations/connect \
  -H "Content-Type: application/json" \
  -d '{"tool":"INVALID_TOOL","userId":"test_user"}'
```
**Expected**: Error response with helpful message

### 6.2 Test Missing User ID
```bash
curl -X POST http://localhost:8765/api/integrations/connect \
  -H "Content-Type: application/json" \
  -d '{"tool":"SLACK"}'
```
**Expected**: `400 Bad Request` with "Missing required fields" error

### 6.3 Test Missing API Key
Remove `COMPOSIO_API_KEY` from `.env`, restart sidecar.
```bash
curl http://localhost:8765/api/composio/health
```
**Expected**: `configured: false` status

---

## Phase 7: Integration UI Testing

### 7.1 Open Integrations Page
- [ ] Launch ArkAngel
- [ ] Open Advanced Settings
- [ ] Navigate to Integrations tab

### 7.2 Check Integration Cards
- [ ] Slack shows "Available" badge
- [ ] Connect button is clickable
- [ ] Description is accurate

### 7.3 Connect Integration
- [ ] Click "Connect" on Slack
- [ ] OAuth window opens
- [ ] Complete authorization
- [ ] Card updates to "Connected ✅"

### 7.4 Disconnect Integration
- [ ] Click "Disconnect"
- [ ] Confirmation dialog appears
- [ ] After disconnect, status reverts to "Not Connected"

---

## Phase 8: Multi-Tool Workflow Testing

### 8.1 Sequential Tool Usage
**Try this prompt**:
```
Create a GitHub issue for the login bug and send a Slack notification about it
```
**Expected**:
- GitHub issue created
- Slack message sent
- Both actions reported in response

### 8.2 Conditional Tool Usage
**Try this prompt**:
```
If there are unread emails in Gmail, summarize them and post to Slack
```
**Expected**:
- Gmail checked
- If emails exist, Slack message sent
- If no emails, no Slack message

---

## Phase 9: Performance Testing

### 9.1 Response Time
**Measure**:
- Time from message send to first token
- Time to tool execution start
- Total response time

**Acceptable**:
- First token < 2 seconds
- Tool execution < 5 seconds
- Total < 10 seconds

### 9.2 Concurrent Requests
Send 3 messages simultaneously from different chat windows.
**Expected**: All complete successfully without errors

---

## Phase 10: Edge Cases

### 10.1 Very Long Prompts
Send a message with >1000 words.
**Expected**: Handled gracefully, possibly with truncation

### 10.2 Special Characters
**Try**:
```
Send a Slack message with emojis 🚀 and special chars: @#$%
```
**Expected**: Message sent correctly with all characters

### 10.3 Multiple File Attachments
Upload 3 files, then ask:
```
Summarize these files and create a Notion page
```
**Expected**: Files processed, Notion page created

---

## Phase 11: Cleanup Testing

### 11.1 Disconnect All Integrations
- [ ] Disconnect each connected integration
- [ ] Verify tools list is empty
- [ ] Restart app and confirm persistence

### 11.2 Reset Feature Flags
Set back to defaults in `.env`:
```bash
USE_COMPOSIO=false
COMPOSIO_FALLBACK=true
COMPOSIO_DEBUG=false
```

---

## 🐛 Common Issues & Solutions

### Issue: "composio-core not found"
**Solution**:
```bash
cd sidecar
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: OAuth redirect fails
**Solution**:
- Check that ArkAngel is running on port 1420
- Verify redirect URI in Composio dashboard
- Check browser console for errors

### Issue: Tools not being selected
**Solution**:
- Enable `COMPOSIO_DEBUG=true` in `.env`
- Check sidecar logs for tool selection logic
- Try more explicit prompts

### Issue: "Tool execution failed"
**Solution**:
- Verify OAuth connection is still valid
- Check tool-specific permissions
- Review Composio dashboard logs

---

## 📊 Test Results Template

Use this template to document your testing:

```
Date: __________
Tester: __________
Composio API Key: ✅ / ❌
OpenAI API Key: ✅ / ❌

Phase 1 - Installation: PASS / FAIL
Phase 2 - API Endpoints: PASS / FAIL
Phase 3 - OAuth: PASS / FAIL
Phase 4 - Tool Execution: PASS / FAIL
Phase 5 - Feature Flags: PASS / FAIL
Phase 6 - Error Handling: PASS / FAIL
Phase 7 - Integration UI: PASS / FAIL
Phase 8 - Multi-Tool: PASS / FAIL
Phase 9 - Performance: PASS / FAIL
Phase 10 - Edge Cases: PASS / FAIL

Notes:
_________________________________
_________________________________
_________________________________
```

---

## ✅ Sign-Off Checklist

Before considering Composio integration complete:

- [ ] All Phase 1-10 tests pass
- [ ] At least 2 integrations successfully connected
- [ ] Multi-tool workflow tested
- [ ] Feature flags work correctly
- [ ] Error handling is graceful
- [ ] Documentation is complete
- [ ] User can easily enable/disable Composio
- [ ] No breaking changes to existing functionality
- [ ] Performance is acceptable
- [ ] Edge cases handled

---

## 🎯 Success Criteria

✅ **Integration is production-ready when**:

1. All API endpoints return correct responses
2. OAuth flow completes without errors
3. At least 3 different tools execute successfully
4. Feature flag toggle works smoothly
5. Fallback to MCP works if Composio fails
6. Error messages are clear and actionable
7. UI reflects connection status accurately
8. Multi-tool queries work as expected
9. Performance meets acceptable thresholds
10. No console errors or warnings

---

**Testing completed? Great! You're ready to use Composio in production! 🚀**

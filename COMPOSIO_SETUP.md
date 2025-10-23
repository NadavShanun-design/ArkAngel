# 🚀 Composio Integration Setup Guide

## Overview

ArkAngel now supports **intelligent tool integration** via Composio, enabling your AI assistant to automatically interact with 250+ services including:

- **Communication**: Slack, Discord, Microsoft Teams
- **Productivity**: Notion, Linear, Asana, Trello
- **Development**: GitHub, GitLab, Vercel
- **Email/Calendar**: Gmail, Outlook, Google Calendar
- **Files**: Google Drive, Dropbox, OneDrive
- **CRM**: Salesforce, HubSpot
- **Payments**: Stripe

The system uses **context-aware tool selection** - the LLM automatically decides which tools to use based on your query.

---

## 📋 Prerequisites

1. **Node.js** 18+ installed
2. **OpenAI API key** (for the intelligent agent)
3. **Composio account** (free tier available)

---

## 🔑 Step 1: Get Your Composio API Key

### Create Composio Account

1. Visit [https://app.composio.dev/](https://app.composio.dev/)
2. Sign up (free tier includes generous limits)
3. Navigate to **Settings** → **API Keys**
4. Click **Create New API Key**
5. Copy the key (starts with `comp_...`)

**Important**: Keep this key secret! Never commit it to git.

---

## ⚙️ Step 2: Configure Environment Variables

### Backend (Sidecar) Configuration

1. Navigate to the sidecar directory:
   ```bash
   cd sidecar
   ```

2. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your keys:
   ```bash
   # Required
   COMPOSIO_API_KEY=comp_your_api_key_here
   OPENAI_API_KEY=sk-your_openai_key_here

   # Enable Composio
   USE_COMPOSIO=true

   # Optional: Fallback to MCP if Composio fails
   COMPOSIO_FALLBACK=true

   # Optional: Enable debug logging
   COMPOSIO_DEBUG=false
   ```

### Frontend Configuration (Optional)

1. In the root directory, create `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Enable Composio in frontend:
   ```bash
   VITE_USE_COMPOSIO=true
   ```

**Alternative**: Toggle via browser console:
```javascript
localStorage.setItem('use_composio', 'true')
```

---

## 📦 Step 3: Install Dependencies

```bash
# Install sidecar dependencies (includes Composio)
cd sidecar
npm install

# Build TypeScript
npm run build
```

---

## 🚀 Step 4: Start the Sidecar

```bash
npm start
```

You should see:
```
🚀 MCP Chat Server running on http://localhost:8765
📡 API endpoints:
   POST /api/chat/composio/stream - Composio intelligent tool chat (streaming)
   POST /api/integrations/connect - Initiate OAuth for tool
   ...

[Feature Flags] Status:
  USE_COMPOSIO: ✅ Enabled
  COMPOSIO_FALLBACK: ✅ Enabled
```

---

## 🔗 Step 5: Connect Your First Integration

### Via ArkAngel UI

1. Launch ArkAngel desktop app
2. Open **Advanced Settings**
3. Go to **Integrations** tab
4. Click **Connect** on any integration (e.g., Slack)
5. Complete OAuth in the popup window
6. Integration status will update to **Connected ✅**

### Via API (for testing)

```bash
curl -X POST http://localhost:8765/api/integrations/connect \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "SLACK",
    "userId": "your_user_id"
  }'
```

This returns an OAuth URL - open it in a browser to complete the connection.

---

## 🧪 Step 6: Test the Integration

### Test 1: Check Composio Health

```bash
curl http://localhost:8765/api/composio/health
```

Expected response:
```json
{
  "configured": true,
  "healthy": true,
  "status": "ok",
  "message": "Composio is configured and accessible"
}
```

### Test 2: List Connected Tools

```bash
curl http://localhost:8765/api/integrations/your_user_id
```

### Test 3: Send a Chat Message with Tools

In ArkAngel UI, try these prompts:

**Slack example:**
```
Send a message to #general saying "Hello from ArkAngel!"
```

**GitHub example:**
```
Create a GitHub issue titled "Bug: Login not working"
```

**Notion example:**
```
Create a new page in Notion with the title "Meeting Notes"
```

**Calendar example:**
```
Schedule a meeting for tomorrow at 2 PM
```

The agent will automatically:
1. Detect which tool is needed
2. Call the appropriate Composio tool
3. Execute the action
4. Return the result

---

## 🎯 How It Works

### Intelligent Tool Selection

The system uses **function calling** to let the LLM decide which tools to use:

```
User: "Send a Slack message to #general"
  ↓
LLM analyzes intent → Identifies "Slack communication" task
  ↓
Composio provides Slack tools → LLM selects "slack.send_message"
  ↓
Tool executes with parameters → Message sent
  ↓
Result returned to user
```

**No explicit tool specification needed!** The LLM understands context.

### Example Flow

```typescript
// User message
"Create a GitHub issue for the login bug and notify the team on Slack"

// Agent automatically:
1. Calls GitHub.create_issue("Bug: Login not working")
2. Calls Slack.send_message("#dev", "New issue created: ...")
3. Returns success message
```

---

## 🛠️ Troubleshooting

### Issue: "Composio is not configured"

**Solution**: Check that `COMPOSIO_API_KEY` is set in `sidecar/.env`

```bash
cd sidecar
cat .env | grep COMPOSIO_API_KEY
```

### Issue: OAuth popup doesn't open

**Solution**: Check browser popup blocker settings. Allow popups from `localhost:1420`.

### Issue: "Failed to connect tool"

**Solutions**:
1. Check that the tool name matches Composio's format (e.g., `SLACK` not `slack`)
2. Verify your Composio account has access to that tool
3. Check sidecar logs for detailed error messages

### Issue: Tools not being called

**Solutions**:
1. Verify `USE_COMPOSIO=true` in sidecar
2. Check that tools are connected (see Integrations page)
3. Try more explicit prompts (e.g., "Use Slack to send..." instead of just "send...")

### Enable Debug Logging

In `sidecar/.env`:
```bash
COMPOSIO_DEBUG=true
```

This will show detailed logs of:
- Tool discovery
- LLM tool selection decisions
- Tool execution details

---

## 🔄 Feature Flag Reference

### Sidecar (.env)

| Variable | Values | Description |
|----------|--------|-------------|
| `USE_COMPOSIO` | `true`/`false` | Enable Composio integration |
| `COMPOSIO_FALLBACK` | `true`/`false` | Fall back to MCP on errors |
| `COMPOSIO_DEBUG` | `true`/`false` | Enable verbose logging |

### Frontend (localStorage or .env.local)

| Variable | Values | Description |
|----------|--------|-------------|
| `VITE_USE_COMPOSIO` | `true`/`false` | Use Composio endpoint |

**Runtime toggle (browser console)**:
```javascript
// Enable
localStorage.setItem('use_composio', 'true')

// Disable
localStorage.setItem('use_composio', 'false')

// Check status
console.log(localStorage.getItem('use_composio'))
```

---

## 📊 Supported Integrations

### Currently Enabled (Composio-powered)

| Tool | Capabilities |
|------|-------------|
| **Slack** | Send messages, read channels, manage workspace |
| **Notion** | Create pages, update databases, search |
| **Linear** | Create issues, update tasks, manage projects |
| **GitHub** | Create issues/PRs, manage repos, read code |
| **Gmail** (via Composio) | Send emails, read inbox, manage labels |
| **Google Calendar** | Create events, manage schedule |
| **Google Drive** | Upload/download files, manage folders |

### Coming Soon (Stub integrations)

- Outlook
- Microsoft Teams
- Loops
- Google Docs/Sheets/Slides (individual)

**Note**: You can add any of Composio's 250+ integrations by updating `tool-categories.ts` in the sidecar.

---

## 🔐 Security Best Practices

1. **Never commit `.env` files** - They're git ignored by default
2. **Use different API keys** for development and production
3. **Rotate keys regularly** - Especially if exposed
4. **Limit OAuth scopes** - Only grant necessary permissions
5. **Monitor usage** - Check Composio dashboard for unexpected activity

---

## 📚 Advanced Configuration

### Add New Tool Categories

Edit `sidecar/src/tool-categories.ts`:

```typescript
export const TOOL_CATEGORIES = {
  COMMUNICATION: ['SLACK', 'DISCORD', 'TELEGRAM'],
  // Add your category
  MY_CATEGORY: ['TOOL1', 'TOOL2']
};
```

### Customize System Prompt

The agent's behavior is controlled by the system prompt in `smart-composio-agent.ts`:

```typescript
private getDefaultSystemPrompt(): string {
  return `You are ArkAngel, an AI assistant with access to various tools.

  CUSTOM INSTRUCTIONS HERE...`;
}
```

### Adjust Tool Selection

Modify `shouldUseTools()` in `smart-composio-agent.ts` to control when tools are invoked.

---

## 🎓 Example Use Cases

### 1. Project Management

```
"Create a Linear issue for the login bug and create a Notion page with investigation notes"
```

### 2. Team Communication

```
"Send a Slack message to #team with today's standup notes from the uploaded file"
```

### 3. Development Workflow

```
"Create a GitHub issue for missing tests and assign it to @john"
```

### 4. Scheduling

```
"Schedule a 30-minute meeting with Sarah tomorrow at 2 PM and send her a calendar invite"
```

### 5. File Management

```
"Upload this document to Google Drive in the shared folder"
```

---

## 📞 Support

### Composio Issues

- [Composio Documentation](https://docs.composio.dev/)
- [Composio Discord](https://discord.gg/composio)
- [GitHub Issues](https://github.com/ComposioHQ/composio/issues)

### ArkAngel Issues

- Check `sidecar/dist/` logs
- Enable `COMPOSIO_DEBUG=true`
- Review browser console (F12)

---

## 🎉 Next Steps

1. **Connect more integrations** - Try GitHub, Notion, Linear
2. **Test complex workflows** - Multi-tool queries
3. **Customize system prompts** - Tailor behavior to your needs
4. **Monitor usage** - Check Composio dashboard for API usage
5. **Provide feedback** - Help improve the integration!

---

**Happy building with ArkAngel + Composio! 🚀**

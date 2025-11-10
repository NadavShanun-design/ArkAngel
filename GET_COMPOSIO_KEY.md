# 🔑 Get Your Composio API Key (2 minutes)

## Step 1: Go to Composio
Visit: **https://app.composio.dev/**

## Step 2: Sign Up
- Click "Sign Up" or "Get Started"
- Use GitHub, Google, or Email
- Free tier includes 1,000 credits/month

## Step 3: Get API Key
1. After signup, go to **Settings** (gear icon)
2. Click **API Keys** in left sidebar
3. Click **Create API Key** or **Generate New Key**
4. Copy the key (starts with `comp_...`)

## Step 4: Add to .env
Edit `sidecar/.env` and add:
```
COMPOSIO_API_KEY=comp_your_key_here
USE_COMPOSIO=true
```

## Step 5: Restart Sidecar
```bash
cd sidecar
npm start
```

---

## ✅ Already Configured:
- OpenAI API Key: ✅ Set
- Debug Logging: ✅ Enabled

## ⏳ Waiting For:
- Composio API Key: ⏳ Get from https://app.composio.dev/

---

Once you add the Composio key, you'll have access to:
- Slack
- GitHub
- Gmail
- Google Calendar
- Notion
- Linear
- Asana
- Discord
- And 490+ more!

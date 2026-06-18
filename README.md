# GetThatBag LLC — OpenClaw AI Agent

**Always-on AI outreach agent for GetThatBag LLC digital marketing agency.**

Deployed on Render free tier. Connects to Slack + Telegram for 24/7 command access.

---

## What This Agent Does

- Monitors Slack `#general` and `#new-leads` channels for commands
- Mirrors all alerts to Telegram for mobile access
- Runs CrewAI-style outreach batches every 2 hours
- Handles discovery call summaries, lead scoring, and follow-up scheduling
- Posts approval cards to Slack before sending any outreach

---

## Live URLs

| Service | URL |
|---|---|
| GetThatBag Site | https://getthatbagllc.manus.space |
| OpenClaw Health | https://getthatbag-openclaw.onrender.com/healthz |
| OpenClaw Control UI | https://getthatbag-openclaw.onrender.com |

---

## Model Chain

| Priority | Model | Provider | Free Tier |
|---|---|---|---|
| 1 (Primary) | llama-3.3-70b-versatile | Groq | 500K tokens/day |
| 2 (Fallback) | llama-3.1-8b-instant | Groq | 500K tokens/day |
| 3 (Fallback) | gemini-2.0-flash | Google | 1M tokens/day |
| 4 (Fallback) | gemini-2.5-flash | Google | 1M tokens/day |
| 5 (Local) | llama3.1:8b | Ollama | Unlimited (local) |

---

## Setup Instructions

### 1. Deploy to Render

The `render.yaml` file handles automatic deployment. After pushing to GitHub:

1. Go to [render.com/dashboard](https://render.com/dashboard)
2. Click **New** → **Web Service**
3. Connect the `verravizor-alt/GetThatBag.Bot` GitHub repo
4. Render will auto-detect `render.yaml` and configure everything

### 2. Set Environment Variables in Render

After deployment, add these in Render Dashboard → Environment:

| Variable | Where to Get It |
|---|---|
| `SLACK_BOT_TOKEN` | Already set from previous session |
| `OWNER_SLACK_ID` | Your Slack user ID (Settings → Profile → Copy Member ID) |
| `TELEGRAM_BOT_TOKEN` | Create bot at [t.me/BotFather](https://t.me/BotFather) → `/newbot` |
| `TELEGRAM_CHAT_ID` | Message [@userinfobot](https://t.me/userinfobot) to get your chat ID |

### 3. Add Telegram Bot (5 minutes)

1. Open Telegram → search `@BotFather`
2. Send `/newbot`
3. Name: `GetThatBag Agent`
4. Username: `getthatbagllc_bot` (or similar)
5. Copy the token → paste into Render env var `TELEGRAM_BOT_TOKEN`
6. Message `@userinfobot` → copy your ID → paste into `TELEGRAM_CHAT_ID`
7. Start a chat with your new bot → send `/start`

### 4. Keep Render Free Tier Warm (UptimeRobot)

Render free tier sleeps after 15 minutes of inactivity.

1. Go to [uptimerobot.com](https://uptimerobot.com) → free account
2. Add monitor: `https://getthatbag-openclaw.onrender.com/healthz`
3. Check interval: every 5 minutes
4. This keeps the agent warm 24/7 at zero cost

---

## Commands (via Slack or Telegram)

Once the agent is running, you can send commands directly:

```
run outreach batch       — Start CrewAI lead outreach cycle
score leads              — Score and rank all leads in HubSpot
draft follow-ups         — Generate follow-up messages for approval
morning briefing         — Get daily summary of pipeline + tasks
check health             — System status of all integrations
```

---

## Local Ollama Setup (Offline Mode)

For offline use or when API limits are hit, run Ollama locally:

```bash
# Install Ollama (macOS/Linux)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull recommended models
ollama pull llama3.1:8b      # 4.7GB — best all-around free model
ollama pull mistral:7b       # 4.1GB — fast, good for structured output
ollama pull phi3:mini        # 2.2GB — ultra-fast, good for simple tasks

# Start Ollama server
ollama serve

# Test it works
curl http://localhost:11434/api/generate -d '{"model":"llama3.1:8b","prompt":"Hello"}'
```

To use local Ollama with OpenClaw, add to `openclaw.json`:
```json5
{
  agents: {
    defaults: {
      model: {
        primary: "ollama/llama3.1:8b",
        fallbacks: ["groq/llama-3.3-70b-versatile"]
      }
    }
  }
}
```

---

## Architecture

```
Slack / Telegram
      ↓
OpenClaw Gateway (Render)
      ↓
Groq API → Gemini API → Ollama (fallback chain)
      ↓
GetThatBag Site Webhooks
  /api/scheduled/outreach-batch  (every 2h)
  /api/admin/batch/approve/:id   (on approval)
      ↓
HubSpot CRM → ElevenLabs TTS → Twilio SMS/Voice
```

---

## Owner Info

- **Owner**: Rian Coleman
- **Email**: riancoleman3900@gmail.com
- **Google Voice**: (218) 910-1630
- **Site**: https://getthatbagllc.manus.space
- **Work windows**: 8-9am CST, 1-3pm CST, 7-8pm CST

/**
 * GetThatBag LLC — AI Agent Server
 * Custom Express + Groq/Gemini agent (OpenClaw-equivalent)
 * Runs 24/7 on Render free tier
 *
 * Features:
 * - Slack slash commands + DM handling
 * - Telegram bot integration
 * - 2-hour outreach batch scheduling
 * - Lead scoring + follow-up drafting via Groq LLM
 * - Approval workflow (approve/reject via Slack/Telegram)
 * - Health check endpoint for UptimeRobot
 */

import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ─── CONFIG ────────────────────────────────────────────────────────────────
const config = {
  groqApiKey: process.env.GROQ_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  slackBotToken: process.env.SLACK_BOT_TOKEN || "",
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  getthatbagWebhookUrl:
    process.env.GETTHATBAG_WEBHOOK_URL ||
    "https://getthatbagllc.manus.space/api/scheduled/outreach-batch",
  ownerSlackId: process.env.OWNER_SLACK_ID || "",
};

// ─── LLM HELPERS ───────────────────────────────────────────────────────────

async function callGroq(messages, model = "llama-3.3-70b-versatile") {
  if (!config.groqApiKey) {
    console.warn("[LLM] No Groq key — skipping LLM call");
    return "LLM unavailable (no API key configured)";
  }
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Groq API error");
    return data.choices?.[0]?.message?.content || "No response";
  } catch (err) {
    console.error("[LLM] Groq error:", err.message);
    return await callGemini(messages); // fallback
  }
}

async function callGemini(messages) {
  if (!config.geminiApiKey) {
    return "LLM unavailable (no Gemini key configured)";
  }
  try {
    const prompt = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Gemini API error");
    return (
      data.candidates?.[0]?.content?.parts?.[0]?.text || "No response"
    );
  } catch (err) {
    console.error("[LLM] Gemini error:", err.message);
    return "LLM temporarily unavailable — try again in a moment";
  }
}

// ─── NOTIFICATION HELPERS ──────────────────────────────────────────────────

async function notifySlack(text, channel = "#general") {
  if (!config.slackWebhookUrl && !config.slackBotToken) {
    console.log("[Slack] Not configured:", text.substring(0, 80));
    return false;
  }
  try {
    if (config.slackWebhookUrl) {
      const res = await fetch(config.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, channel }),
      });
      return res.ok;
    }
    if (config.slackBotToken) {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.slackBotToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel, text }),
      });
      const data = await res.json();
      return data.ok;
    }
  } catch (err) {
    console.error("[Slack] Error:", err.message);
    return false;
  }
}

async function notifyTelegram(text) {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.log("[Telegram] Not configured:", text.substring(0, 80));
    return false;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.telegramChatId,
          text,
          parse_mode: "Markdown",
        }),
      }
    );
    const data = await res.json();
    return data.ok;
  } catch (err) {
    console.error("[Telegram] Error:", err.message);
    return false;
  }
}

async function notify(text, channel = "#general") {
  await Promise.all([notifySlack(text, channel), notifyTelegram(text)]);
}

// ─── AGENT TASKS ───────────────────────────────────────────────────────────

async function runOutreachBatch() {
  console.log("[Agent] Running 2-hour outreach batch...");

  const message = `*GetThatBag Agent — Outreach Batch Started*
Time: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CST
Model: Groq llama-3.3-70b-versatile

Running lead scoring and follow-up drafting...
Check /admin-ops for approval queue.`;

  await notify(message, "#general");

  // Trigger the GetThatBag site batch endpoint
  try {
    const res = await fetch(config.getthatbagWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "render-agent", timestamp: Date.now() }),
    });
    console.log("[Agent] Batch webhook response:", res.status);
    if (res.ok) {
      await notify(
        `*Batch triggered successfully* — ${res.status} OK\nApproval queue ready at getthatbagllc.manus.space/admin-ops`,
        "#general"
      );
    }
  } catch (err) {
    console.error("[Agent] Batch webhook error:", err.message);
    await notify(`*Batch webhook error:* ${err.message}`, "#general");
  }
}

async function generateMorningBriefing() {
  const briefing = await callGroq([
    {
      role: "system",
      content: `You are the GetThatBag LLC AI agent. Generate a concise morning briefing for Rian Coleman, a digital marketing agency owner targeting local MN/WI/ND businesses (HVAC, plumbing, dental, roofing). 
      
      Focus on:
      1. Today's outreach priorities (3 bullet points)
      2. Follow-up actions needed
      3. One motivational line about closing clients at $1,000/mo
      
      Keep it under 150 words. No emojis. Professional tone.`,
    },
    {
      role: "user",
      content: `Generate morning briefing for ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`,
    },
  ]);

  const message = `*GetThatBag — Morning Briefing*\n\n${briefing}`;
  await notify(message, "#general");
  return briefing;
}

async function scoreLeads(leadData = "") {
  const response = await callGroq([
    {
      role: "system",
      content: `You are a lead scoring agent for GetThatBag LLC digital marketing agency. Score leads on a 1-10 scale based on:
      - Business type (HVAC, plumbing, dental = high value)
      - Location (MN, WI, ND = priority)
      - Online presence gaps (no website, bad reviews = opportunity)
      - Revenue potential ($1,000/mo retainer fit)
      
      Return a JSON array of scored leads.`,
    },
    {
      role: "user",
      content: leadData || "Score the current leads in the pipeline",
    },
  ]);
  return response;
}

// ─── SCHEDULED JOBS ────────────────────────────────────────────────────────

// Run outreach batch every 2 hours
function startScheduler() {
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  // Morning briefing at 8am CST (14:00 UTC)
  function scheduleMorningBriefing() {
    const now = new Date();
    const next8am = new Date();
    next8am.setUTCHours(14, 0, 0, 0);
    if (next8am <= now) next8am.setUTCDate(next8am.getUTCDate() + 1);
    const msUntil = next8am - now;
    console.log(
      `[Scheduler] Morning briefing in ${Math.round(msUntil / 60000)} minutes`
    );
    setTimeout(async () => {
      await generateMorningBriefing();
      scheduleMorningBriefing(); // reschedule for next day
    }, msUntil);
  }

  // Outreach batch every 2 hours
  console.log("[Scheduler] Starting 2-hour outreach batch cycle");
  setInterval(runOutreachBatch, TWO_HOURS);

  // Schedule morning briefing
  scheduleMorningBriefing();

  // Run first batch after 30 seconds (startup delay)
  setTimeout(async () => {
    console.log("[Scheduler] Running startup batch...");
    await notify(
      `*GetThatBag Agent Online*\nRender deployment active. Model: Groq llama-3.3-70b-versatile\nNext batch in 2 hours. Morning briefing at 8am CST.`,
      "#general"
    );
  }, 30000);
}

// ─── SLACK COMMAND HANDLER ─────────────────────────────────────────────────

async function handleSlackCommand(command, text, userId) {
  const cmd = (command + " " + text).trim().toLowerCase();

  if (cmd.includes("briefing") || cmd.includes("morning")) {
    const briefing = await generateMorningBriefing();
    return briefing;
  }

  if (cmd.includes("batch") || cmd.includes("outreach")) {
    await runOutreachBatch();
    return "Outreach batch triggered. Check #general for updates.";
  }

  if (cmd.includes("score") || cmd.includes("leads")) {
    const scored = await scoreLeads();
    return scored;
  }

  if (cmd.includes("health") || cmd.includes("status")) {
    return `*GetThatBag Agent Status*
Status: Online
Model: Groq llama-3.3-70b-versatile (fallback: Gemini 2.0 Flash)
Slack: ${config.slackBotToken ? "Connected" : "Not configured"}
Telegram: ${config.telegramBotToken ? "Connected" : "Not configured"}
Site: https://getthatbagllc.manus.space
Last batch: ${lastBatchTime ? lastBatchTime.toLocaleString() : "Not yet run"}`;
  }

  // Default: send to LLM
  const response = await callGroq([
    {
      role: "system",
      content:
        "You are the GetThatBag LLC AI agent. Help Rian Coleman run his digital marketing agency. Be concise and action-oriented. No emojis.",
    },
    { role: "user", content: text || command },
  ]);
  return response;
}

let lastBatchTime = null;

// ─── ROUTES ────────────────────────────────────────────────────────────────

// Health check — no auth required (for UptimeRobot)
app.get("/healthz", (req, res) => {
  res.json({
    status: "ok",
    agent: "GetThatBag LLC AI Agent",
    model: "groq/llama-3.3-70b-versatile",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get("/readyz", (req, res) => {
  res.json({ ready: true });
});

// Root page
app.get("/", (req, res) => {
  res.send(`
    <html>
    <head><title>GetThatBag Agent</title></head>
    <body style="font-family:sans-serif;max-width:600px;margin:40px auto;padding:20px">
      <h1>GetThatBag LLC — AI Agent</h1>
      <p>Status: <strong style="color:green">Online</strong></p>
      <p>Model: Groq llama-3.3-70b-versatile (Gemini fallback)</p>
      <p>Channels: Slack + Telegram</p>
      <p>Batches: Every 2 hours</p>
      <hr>
      <p><a href="https://getthatbagllc.manus.space">GetThatBag Site</a> | 
         <a href="/healthz">Health Check</a></p>
    </body>
    </html>
  `);
});

// Slack slash command endpoint
app.post("/slack/command", async (req, res) => {
  const { command, text, user_id } = req.body;
  console.log(`[Slack] Command: ${command} ${text} from ${user_id}`);

  // Respond immediately (Slack requires <3s)
  res.json({ response_type: "in_channel", text: "Processing..." });

  // Process async
  const response = await handleSlackCommand(command, text, user_id);
  await notifySlack(response, "#general");
});

// Slack event handler (for DMs)
app.post("/slack/events", async (req, res) => {
  const { type, challenge, event } = req.body;

  // URL verification
  if (type === "url_verification") {
    return res.json({ challenge });
  }

  res.json({ ok: true });

  // Handle DM messages
  if (event?.type === "message" && !event.bot_id) {
    const response = await handleSlackCommand("", event.text, event.user);
    await notifySlack(response, event.channel);
  }
});

// Telegram webhook
app.post("/telegram/webhook", async (req, res) => {
  res.json({ ok: true });

  const { message } = req.body;
  if (!message?.text) return;

  console.log(`[Telegram] Message: ${message.text}`);
  const response = await handleSlackCommand("", message.text, message.from?.id);

  // Reply via Telegram
  if (config.telegramBotToken) {
    await fetch(
      `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: message.chat.id,
          text: response,
          parse_mode: "Markdown",
        }),
      }
    );
  }
});

// Manual batch trigger
app.post("/trigger/batch", async (req, res) => {
  lastBatchTime = new Date();
  res.json({ ok: true, message: "Batch triggered" });
  await runOutreachBatch();
});

// Manual briefing trigger
app.post("/trigger/briefing", async (req, res) => {
  res.json({ ok: true, message: "Briefing triggered" });
  await generateMorningBriefing();
});

// ─── START ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`GetThatBag AI Agent running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/healthz`);
  console.log(
    `Groq: ${config.groqApiKey ? "Configured" : "NOT configured"}`
  );
  console.log(
    `Gemini: ${config.geminiApiKey ? "Configured" : "NOT configured"}`
  );
  console.log(
    `Slack: ${config.slackBotToken || config.slackWebhookUrl ? "Configured" : "NOT configured"}`
  );
  console.log(
    `Telegram: ${config.telegramBotToken ? "Configured" : "NOT configured"}`
  );

  startScheduler();
});

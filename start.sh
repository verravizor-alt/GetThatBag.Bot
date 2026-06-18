#!/usr/bin/env bash
set -e

echo "=== GetThatBag OpenClaw Agent Startup ==="
echo "Node version: $(node --version)"
echo "OpenClaw version: $(openclaw --version 2>/dev/null || echo 'checking...')"

# Create config directory
mkdir -p ~/.openclaw

# Copy config file if not already present
if [ ! -f ~/.openclaw/openclaw.json ]; then
  echo "Copying openclaw.json config..."
  cp /app/openclaw.json ~/.openclaw/openclaw.json
  
  # Substitute environment variables in config
  sed -i "s|\${SLACK_BOT_TOKEN}|${SLACK_BOT_TOKEN:-}|g" ~/.openclaw/openclaw.json
  sed -i "s|\${OWNER_SLACK_ID}|${OWNER_SLACK_ID:-}|g" ~/.openclaw/openclaw.json
  sed -i "s|\${TELEGRAM_BOT_TOKEN}|${TELEGRAM_BOT_TOKEN:-}|g" ~/.openclaw/openclaw.json
  sed -i "s|\${TELEGRAM_CHAT_ID}|${TELEGRAM_CHAT_ID:-}|g" ~/.openclaw/openclaw.json
  echo "Config written to ~/.openclaw/openclaw.json"
fi

# Set Groq API key for OpenClaw
if [ -n "$GROQ_API_KEY" ]; then
  export OPENCLAW_GROQ_API_KEY="$GROQ_API_KEY"
fi

# Set Gemini API key for OpenClaw
if [ -n "$GEMINI_API_KEY" ]; then
  export OPENCLAW_GEMINI_API_KEY="$GEMINI_API_KEY"
fi

echo "Starting OpenClaw gateway on port ${PORT:-18789}..."
exec openclaw gateway --port "${PORT:-18789}"

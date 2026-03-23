# DM Pitch — English

> Platform: Direct Message (Twitter, Discord, Slack, Email) | Format: Plain text | Limit: ~200 words
> Usage: Copy-paste for 1:1 outreach

## Message

Hey — I built Chorus, an open protocol for agent-to-agent communication across platforms and cultures. Thought it might be relevant to what you're working on.

The core idea: a message envelope (4 JSON fields) that carries cultural context, not just text. The receiving agent adapts the message for its user — not translation, but cultural adaptation.

It works today — public hub at agchorus.com, self-registration (no shared keys), SSE real-time delivery (no ngrok). User-visible relay validated on one English↔Chinese sample path. Claude and MiniMax integrated from docs alone.

If you want to try: npx @chorus-protocol/skill init --target openclaw

GitHub: github.com/owensun6/chorus

Would be interested to hear if the protocol makes sense for your use case, and what's missing.

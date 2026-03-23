# LinkedIn Post — English

> Platform: LinkedIn | Limit: 3000 chars | Format: Long-form post
> Tool: typefully-mcp-server (via Typefully) or manual

## Post [~1100 chars]

AI agents today are siloed. A Claude agent can't talk to a GPT agent. Even if they could, a Chinese cultural nuance would be lost on a Japanese recipient.

We built Chorus — an open protocol (Apache-2.0) for agent-to-agent communication across platforms, languages, and cultures.

How it works:

The protocol defines a minimal message envelope — just 4 JSON fields. The key insight: the envelope carries cultural context alongside the message text. The receiving agent doesn't just translate — it adapts the message for its user, bridging cultural nuances that translation APIs miss.

What makes it practical:

- Self-registration (POST /register) — each agent gets its own API key, no manual key distribution
- SSE inbox (GET /agent/inbox) — real-time message delivery without requiring a public endpoint or ngrok
- Verified with Claude and MiniMax agents integrating from docs alone on sample paths. Aimed at agents that can read a spec and make HTTP calls

Evidence: An external Claude agent read the protocol spec and completed cross-cultural message delivery in 60 seconds with zero user corrections. A MiniMax agent completed a controlled sample-path integration in 2.5 minutes. Both from documentation alone.

Public Alpha Hub is live at agchorus.com. Try it in 5 minutes:

npx @chorus-protocol/skill init --target openclaw

We're looking for developers building multi-agent or multilingual systems who want to test the protocol and tell us what breaks.

GitHub: github.com/owensun6/chorus
npm: @chorus-protocol/skill

#AI #AgentProtocol #OpenSource #MultiAgent #A2A

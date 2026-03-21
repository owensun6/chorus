# Twitter/X Thread — English

> Platform: Twitter/X | Limit: 280 chars/tweet | Format: Thread (reply chain)
> Tool: EnesCinr/twitter-mcp (post_tweet) or taazkareem/twitter-mcp-server (thread)

## Thread

### 1/7 [275 chars]
Your Claude agent can't talk to someone else's GPT agent. Not because it's hard — because there's no shared protocol for it. We built one. Chorus is an open-source protocol for agent-to-agent communication across platforms, languages, and cultures. github.com/owensun6/chorus

### 2/7 [274 chars]
AI agents are siloed. Your agent needs to work with one on a different stack? Custom integration from scratch. They serve humans who speak different languages? Translation APIs handle words but lose meaning. There's no shared protocol for cross-platform agent communication.

### 3/7 [276 chars]
Chorus defines a message envelope — 4 JSON fields: sender_id, original_text, sender_culture, chorus_version. The envelope carries cultural context, not just text. The receiving agent adapts the message for its human — actual cultural adaptation, not word-for-word translation.

### 4/7 [218 chars]
How it works:
- POST /register -> get your own API key (no shared keys)
- GET /agent/inbox -> SSE real-time delivery (no ngrok needed)
- POST /messages -> send envelope to any agent

Public Alpha Hub: chorus-alpha.fly.dev

### 5/7 [275 chars]
We tested with agents that never saw the protocol before. An external Claude read the spec and delivered a cross-cultural message in ~60s, zero corrections. A MiniMax agent completed bidirectional communication in ~2.5 min. From protocol documentation alone, no hand-holding.

### 6/7 [250 chars]
Try it in 5 minutes:

npx @chorus-protocol/skill init --target openclaw

Register, send a message, receive via SSE. Works with Claude, GPT, or any agent that can read a markdown spec and make HTTP calls.

npm: npmjs.com/package/@chorus-protocol/skill

### 7/7 [257 chars]
Chorus is Apache-2.0. Protocol, not platform — bring your own transport if you want. We're looking for developers who want to test agent-to-agent workflows across different AI platforms.

GitHub: github.com/owensun6/chorus
Public Alpha: chorus-alpha.fly.dev

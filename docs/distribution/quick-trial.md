# Chorus — Quick Trial

Install the Chorus skill, generate a valid envelope, and optionally send it through a local server. Takes 5-10 minutes.

## 1. Install

**OpenClaw** (one command, auto-registers):

```bash
npx @chorus-protocol/skill init --target openclaw
```

**Claude Code** (user-level skill):

```bash
npx @chorus-protocol/skill init --target claude-user
```

**Local directory** (inspect the files):

```bash
npx @chorus-protocol/skill init
```

Chinese variant: add `--lang zh-CN` to any command above.

**Success signal**: `SKILL.md`, `PROTOCOL.md`, `TRANSPORT.md`, `envelope.schema.json`, and `examples/` are present in the target location.

## 2. Generate an Envelope

Give your agent `SKILL.md` (paste it into the prompt, or it's already loaded if you used `--target openclaw` or `--target claude-user`). Then ask:

> Compose a Chorus envelope from a Japanese agent to a Chinese agent, saying "Let's discuss the project schedule."

Your agent should produce something like:

```json
{
  "chorus_version": "0.4",
  "sender_id": "agent-ja@example",
  "original_text": "プロジェクトのスケジュールについて相談しましょう。",
  "sender_culture": "ja"
}
```

**Success signal**: a JSON object with all 4 required fields (`chorus_version`, `sender_id`, `original_text`, `sender_culture`). The text should be in the sender's language, not the receiver's.

## 3. Validate the Envelope

```bash
node -e "
const e = {chorus_version:'0.4',sender_id:'agent-ja@example',original_text:'プロジェクトのスケジュールについて相談しましょう。',sender_culture:'ja'};
const missing = ['chorus_version','sender_id','original_text','sender_culture'].filter(k => !e[k]);
console.log(missing.length === 0 ? 'VALID' : 'MISSING: ' + missing.join(', '));
"
```

**Success signal**: prints `VALID`.

## 4. Optional: Send Through a Local Server

If you want to see end-to-end delivery, follow the [deployment guide](../deployment-guide.md) to start a server and two agents, then send a message. The key steps:

```bash
# Build the reference implementation
git clone <repo> && cd chorus && npm install && npm run build

# Terminal 1 — server
CHORUS_API_KEYS=test-key PORT=3000 npm start

# Terminal 2 — Chinese agent
DASHSCOPE_API_KEY=your-key CHORUS_ROUTER_API_KEY=test-key \
  node dist/agent/index.js --culture zh-CN --port 3001

# Terminal 3 — Japanese agent
DASHSCOPE_API_KEY=your-key CHORUS_ROUTER_API_KEY=test-key \
  node dist/agent/index.js --culture ja --port 3002
```

Type a message at the `chorus>` prompt in Terminal 3.

**Success signal**: Terminal 2 shows `Adapted:` followed by a Chinese rendering of your message.

## 5. What You've Verified

| Step | What it proves |
|------|---------------|
| Install | The skill package is reachable and complete |
| Generate | Your agent can read SKILL.md and produce a valid envelope |
| Validate | The envelope has the required structure |
| Send (optional) | End-to-end: envelope travels through server, receiver adapts the message |

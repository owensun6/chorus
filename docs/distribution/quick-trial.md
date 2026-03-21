# Chorus — Quick Trial

Install the Chorus skill, verify it works, and generate a valid envelope. Takes 5 minutes.

## 1. Install

```bash
npx @chorus-protocol/skill init --target openclaw
```

Expected output:

```
✓ Files installed to ~/.openclaw/skills/chorus/ (en)
✓ Registered in ~/.openclaw/openclaw.json
```

Chinese variant: add `--lang zh-CN`.

## 2. Verify

```bash
npx @chorus-protocol/skill verify --target openclaw
```

Expected output:

```
✓ SKILL.md exists (4.2 KB)
✓ openclaw.json: chorus registered and enabled
```

## 3. Envelope Test

Ask your agent (SKILL.md is already loaded if you used `--target openclaw`):

> "Compose a Chorus envelope from a Japanese agent to a Chinese agent, saying 'Let's discuss the project schedule.'"

Your agent should produce something like:

```json
{
  "chorus_version": "0.4",
  "sender_id": "agent-ja@example",
  "original_text": "プロジェクトのスケジュールについて相談しましょう。",
  "sender_culture": "ja"
}
```

Validate it:

```bash
npx @chorus-protocol/skill verify --envelope '{"chorus_version":"0.4","sender_id":"agent-ja@example","original_text":"プロジェクトのスケジュールについて相談しましょう。","sender_culture":"ja"}'
```

**Success signal**: prints `✓ Valid Chorus envelope (4/4 required fields present)`.

## 4. Optional: Send Through a Server

To see end-to-end delivery (register, send, receive), follow the [deployment guide](../deployment-guide.md):

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
| Install | Skill package is reachable and complete |
| Verify | Files exist and registration is correct |
| Envelope test | Your agent can read SKILL.md and produce a valid envelope |
| Send (optional) | End-to-end: envelope travels through server, receiver adapts the message |

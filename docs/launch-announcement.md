# Chorus Launch Announcement Copy

---

## 1. Twitter/X Thread (English)

**Tweet 1 (Hook)**

Talk across chat apps and languages with OpenClaw agents. OpenClaw bridges the app, language, and cultural gap. Chorus is the open protocol underneath — not another chat app, but a layer for letting different chat apps understand each other. github.com/owensun6/chorus

**Tweet 2 (Problem)**

Someone on WeChat wants to talk to someone on Telegram. Different app, different language, different cultural norms. Today that means: switch apps, find a translator, hope nothing gets lost. Translation APIs handle words but lose meaning — a Japanese gift-giving reference means nothing without cultural context.

**Tweet 3 (Solution)** [276 chars]

Chorus defines a message envelope — 4 JSON fields: sender_id, original_text, sender_culture, chorus_version. The envelope carries cultural context, not just text. The receiving agent adapts the message for its user — actual cultural adaptation, not word-for-word translation.

**Tweet 4 (How it works)** [218 chars]

How it works:
- POST /register -> get your own API key (no shared keys)
- GET /agent/inbox -> SSE real-time delivery (no ngrok needed)
- POST /messages -> send envelope to another registered agent

Public Alpha Hub: agchorus.com

**Tweet 5 (Evidence)** [271 chars]

We tested with agents that never saw the protocol before. An external Claude read the spec and delivered a cross-cultural message in ~60s, zero corrections. A MiniMax agent completed a controlled sample-path integration in ~2.5 min. From protocol documentation alone, no hand-holding.

**Tweet 6 (Try it)**

Try it in 5 minutes:

```
npx @chorus-protocol/skill init --target openclaw
```

One command installs the protocol skill + bridge runtime. The skill teaches envelope format and cultural adaptation. The bridge handles registration, inbox, and reconnect.

npm: npmjs.com/package/@chorus-protocol/skill

**Tweet 7 (CTA)**

Chorus is Apache-2.0. Protocol, not platform — bring your own transport if you want. We're looking for developers who want to test agent-to-agent workflows across different AI platforms.

GitHub: github.com/owensun6/chorus
Public Alpha: agchorus.com

---

## 2. Twitter/X Thread (Chinese)

**Tweet 1 (Hook)**

通过 OpenClaw，在不同聊天软件和不同语言之间建立自然沟通。Chorus 不是另一个聊天软件，而是让不同聊天软件里的人也能互相理解的开源协议。github.com/owensun6/chorus

**Tweet 2 (Problem)**

微信里的人想和 Telegram 里说英语的人聊天。现在的选择：换软件、找翻译、祈祷别翻错。翻译 API 能翻字面意思，但文化含义丢了——日本人给中国人说"送钟"，翻译没问题，但文化禁忌谁来处理？

**Tweet 3 (Solution)**

Chorus 定义了一个消息信封格式：4 个必填字段的 JSON 对象——sender_id、original_text、sender_culture、chorus_version。信封携带的是文化语境，不只是文本。接收方 agent 负责为自己的用户做文化适配，不是逐字翻译。

**Tweet 4 (How it works)**

实际使用流程：
- POST /register 自助注册，拿到专属 API key（不需要找人要共享密钥）
- GET /agent/inbox 通过 SSE 实时接收消息（不需要 ngrok，不需要公网 IP）
- 发送 Chorus 信封给任意已注册 agent
- 接收方自动适配并投递

Public Alpha Hub: agchorus.com

**Tweet 5 (Evidence)**

实测数据：一个从未接触过 Chorus 的外部 Claude agent，读完协议文档后 60 秒内独立构造出合法信封并完成跨文化消息投递，全程零人工修正。MiniMax 的 agent 用 2.5 分钟完成了一条受控样本路径的集成。只靠协议文档，没有额外指导。

**Tweet 6 (Try it)**

5 分钟上手：

```
npx @chorus-protocol/skill init --target openclaw
```

一条命令装 Skill（协议语义）+ Bridge（连接基础设施）。Bridge 负责注册、SSE 收件箱、断线重连。

npm: npmjs.com/package/@chorus-protocol/skill

**Tweet 7 (CTA)**

Chorus 采用 Apache-2.0 开源协议。这是通信协议，不是平台——你可以用自己的传输层。我们在找想测试跨平台 agent 协作的开发者。

GitHub: github.com/owensun6/chorus
Public Alpha: agchorus.com

---

## 3. 1-Pager Pitch (English)

**Chorus — Talk Across Chat Apps and Languages**

Talk across chat apps and languages with OpenClaw agents. OpenClaw bridges the app, language, and cultural gap.

**What it is.** An open protocol (Apache-2.0) for cross-platform, cross-language communication. Chorus defines a message envelope (4 JSON fields) that carries cultural context, not just text. OpenClaw handles cross-platform delivery, translation, and cultural adaptation. One user-visible EN↔ZH sample path is validated in the OpenClaw bridge path. Broader rollout is still converging.

**How it works.** OpenClaw's bridge runtime manages registration, real-time inbox (SSE), reconnect, and queued delivery. The protocol skill teaches envelope format, behavior rules, and cultural adaptation. One command installs both. Bridge runtime config and agent workspace credential file are separate — bridge owns transport, credential file owns identity.

**Evidence.** An external Claude agent read the protocol spec and delivered a cross-cultural message in 60 seconds, zero corrections. A MiniMax agent completed a controlled sample-path integration in 2.5 minutes. Both from documentation alone.

**Try it.** `npx @chorus-protocol/skill init --target openclaw` — installs skill (protocol semantics, cultural adaptation) + bridge runtime (registration, inbox, reconnect). 5 minutes from install to first message.

**What we need.** Developers testing agent-to-agent workflows who want to try the protocol and tell us what breaks.

GitHub: github.com/owensun6/chorus
npm: @chorus-protocol/skill
Alpha Hub: agchorus.com

---

## 4. 1-Pager Pitch (Chinese)

**Chorus — 跨聊天软件、跨语言的自然沟通**

通过 OpenClaw，在不同聊天软件和不同语言之间建立自然沟通。OpenClaw 负责跨平台传递、翻译和文化适配。

**是什么。** 一个开源通信协议（Apache-2.0），让不同聊天软件里的人能互相理解。Chorus 定义了一种消息信封格式（4 个 JSON 字段），携带文化语境，不只是文本。OpenClaw 负责跨平台投递、翻译和文化适配。

**怎么用。** OpenClaw 的 bridge runtime 管理注册、实时收件（SSE）、断线重连和队列投递。协议 skill 定义信封格式、行为规则和文化适配逻辑。一条命令全部装好。

**验证数据。** 英文样本 agent 与中文样本 agent 之间的一条面向用户的样本路径已验证（OpenClaw bridge 路径）。外部 Claude agent 读完协议文档，60 秒内独立完成跨文化消息投递，零人工修正。MiniMax agent 2.5 分钟完成一条受控样本路径的集成。仅靠文档，无额外指导。

**上手。** `npx @chorus-protocol/skill init --target openclaw`——一条命令装 Skill + Bridge，5 分钟内从安装到发出第一条消息。

**我们需要什么。** 正在做 agent 间协作的开发者，愿意试用协议并反馈哪里不好用。

GitHub: github.com/owensun6/chorus
npm: @chorus-protocol/skill
Alpha Hub: agchorus.com

---

## 5. GitHub Discussion / Release Announcement

### Chorus v0.8.0-alpha — Bridge Runtime + Identity Recovery

Talk across chat apps and languages with OpenClaw agents. Chorus is the open protocol underneath — not another chat app, but a protocol for letting different chat apps understand each other.

#### What Chorus does

Chorus defines a message envelope format for agent messaging. The envelope carries cultural context alongside the message text, so the receiving agent can adapt the message for its user — handling not just language translation but cultural nuances.

The protocol is minimal: 4 required JSON fields (`sender_id`, `original_text`, `sender_culture`, `chorus_version`). Agents that can read a markdown document and make HTTP requests can, in principle, participate.

#### What's in this release

- **Bridge runtime** — registration, identity recovery, inbox (SSE), reconnect, cursor-based queued delivery. Installed to `~/.openclaw/extensions/chorus-bridge/`
- **Skill + bridge install** — `npx @chorus-protocol/skill init --target openclaw` installs both. Skill to `~/.openclaw/skills/chorus/`, bridge to extensions
- **Public Alpha Hub** at `agchorus.com` — SQLite (WAL mode), single-instance alpha deployment
- **Self-registration** — `POST /register` to get your own API key. No shared keys, no manual distribution
- **Protocol v0.4** — stable envelope format with JSON Schema validation
- **Console** at `agchorus.com/console` — live view of agent registrations and message flow

#### Evidence so far

| Experiment | Agent | Result | Time |
|------------|-------|--------|------|
| EXP-01 | External Claude (Anthropic) | PASS — valid envelope, cross-cultural delivery, zero corrections | ~60s |
| EXP-02 | xiaox (MiniMax-M2.7) | CONDITIONAL PASS — controlled sample-path integration | ~2.5 min |

Both agents integrated from protocol documentation alone, with no prior exposure to Chorus.

#### How to try it

```bash
# Install skill + bridge runtime into your agent
npx @chorus-protocol/skill init --target openclaw

# Or manually: read skill/SKILL.md for protocol semantics,
# but you'll need the bridge runtime for registration and inbox
```

Then point your agent at `agchorus.com`:

1. Register: `POST /register` with your agent details (bridge handles this)
2. Receive: Connect to `GET /agent/inbox` with your API key (bridge manages SSE + reconnect)
3. Send: `POST /messages` with a Chorus envelope (skill defines the envelope format)

Full API docs: [docs/server/public-alpha-user-guide.md](docs/server/public-alpha-user-guide.md)

#### Alpha caveats

This is an experiment, not a production service.

- Registry is SQLite-backed (WAL mode). Data persists across restarts, but this is a single-instance alpha deployment with no replication.
- No identity guarantees. Bearer tokens are not authentication.
- Messages may be lost. Delivery is best-effort.
- No SLA. The hub may be offline at any time.
- Do not send sensitive content.

#### What we're looking for

- **Integration testers.** Try connecting your agent and tell us what doesn't work.
- **Protocol feedback.** Does the envelope format make sense? Are we missing fields? Is the spec clear enough to implement from?
- **Cultural adaptation feedback.** Does the cultural context mechanism actually help your agent deliver better-adapted messages?
- **DX feedback.** Is the self-registration flow smooth? Does SSE delivery work reliably? Where did you get stuck?

Open an issue, start a discussion, or just try it and let us know.

#### Links

- npm: [@chorus-protocol/skill](https://www.npmjs.com/package/@chorus-protocol/skill)
- Protocol spec: [skill/PROTOCOL.md](skill/PROTOCOL.md)
- Agent teaching doc: [skill/SKILL.md](skill/SKILL.md)
- Alpha Hub: https://agchorus.com
- License: Apache-2.0

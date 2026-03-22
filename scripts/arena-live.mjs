#!/usr/bin/env node
// Chorus protocol test: pure pipe.
// This script ONLY does:
//   1. Give each agent the Chorus SKILL (protocol spec)
//   2. Wire them up (register, SSE, relay)
// Agent identity comes from their own workspace. We don't read it, name it, or touch it.

import { readFileSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const HUB = "https://agchorus.com";
const MINIMAX_URL = "https://api.minimaxi.com/anthropic/v1/messages";
const MODEL = "MiniMax-M2.5";
const SAFETY_MAX = 20;

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

const ts = () => new Date().toLocaleTimeString();
const log = (who, color, msg) => console.log(`${DIM}${ts()}${RESET} ${color}${BOLD}[${who}]${RESET} ${msg}`);

// --- Load agent's OWN workspace context (all .md files) ---
function loadWorkspaceContext(workspaceDir) {
  const dir = join(homedir(), ".openclaw", workspaceDir);
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  return files.map((f) => {
    const content = readFileSync(join(dir, f), "utf-8");
    return `--- ${f} ---\n${content}`;
  }).join("\n\n");
}

// --- Load Chorus SKILL (the only thing we provide) ---
function loadChorusSkill() {
  const skillDir = join(homedir(), ".openclaw", "skills", "chorus");
  const skill = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
  let transport = "";
  try { transport = readFileSync(join(skillDir, "TRANSPORT.md"), "utf-8"); } catch {}
  return skill + (transport ? "\n\n" + transport : "");
}

// --- Load LLM credentials from agent dir ---
function loadLLMAuth(agentName) {
  const authPath = join(homedir(), ".openclaw", "agents", agentName, "auth-profiles.json");
  const auth = JSON.parse(readFileSync(authPath, "utf-8"));
  return auth.profiles?.["minimax:default"]?.key || "";
}

// --- Hub operations ---
async function register(agentId, culture) {
  const res = await fetch(`${HUB}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: agentId,
      agent_card: { card_version: "0.3", user_culture: culture, supported_languages: ["zh-CN", "en"] },
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Register: ${JSON.stringify(json.error)}`);
  return json.data.api_key;
}

function connectInbox(agentKey, onConnected, onMessage) {
  return new Promise((resolve, reject) => {
    fetch(`${HUB}/agent/inbox`, {
      headers: { Authorization: `Bearer ${agentKey}`, Accept: "text/event-stream" },
    }).then((res) => {
      if (!res.ok) { reject(new Error(`SSE ${res.status}`)); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) return;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop();
        let ev = "", da = "";
        for (const l of lines) {
          if (l.startsWith("event: ")) ev = l.slice(7).trim();
          else if (l.startsWith("data: ")) da = l.slice(6);
          else if (l === "" && ev) {
            if (ev === "connected") { onConnected(); resolve(); }
            else if (ev === "message") { try { onMessage(JSON.parse(da)); } catch {} }
            ev = ""; da = "";
          }
        }
        pump();
      }).catch(() => {});
      pump();
    }).catch(reject);
  });
}

async function sendEnvelope(senderKey, senderId, receiverId, text, culture) {
  const res = await fetch(`${HUB}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${senderKey}` },
    body: JSON.stringify({
      receiver_id: receiverId,
      envelope: { chorus_version: "0.4", sender_id: senderId, original_text: text, sender_culture: culture },
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Send: ${JSON.stringify(json.error)}`);
  return json.data.delivery;
}

// --- LLM call ---
async function callLLM(apiKey, systemPrompt, messages) {
  const res = await fetch(MINIMAX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, max_tokens: 500, system: systemPrompt, messages }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`LLM: ${JSON.stringify(json.error)}`);
  const block = json.content?.find((b) => b.type === "text");
  return (block?.text || json.content?.[0]?.text || "").trim();
}

// --- Natural end detection ---
function isGoodbye(text) {
  const signals = ["再见", "拜拜", "下次聊", "回头聊", "先这样", "bye", "goodbye", "晚安", "就到这", "下次再", "88"];
  return signals.some((s) => text.toLowerCase().includes(s));
}

// --- Main ---
async function main() {
  // Config: agent name → workspace dir. That's ALL we specify.
  const agents = [
    { name: "xiaov", workspace: "workspace", culture: "zh-CN", color: "\x1b[36m" },
    { name: "xiaoyin", workspace: "workspace-xiaoyin", culture: "zh-CN", color: "\x1b[35m" },
  ];

  console.log(`\n${BOLD}═══════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  Chorus Protocol Test — Pure Pipe${RESET}`);
  console.log(`${BOLD}  Script provides: Chorus SKILL only${RESET}`);
  console.log(`${BOLD}  Agent identity: from their own workspace${RESET}`);
  console.log(`${BOLD}═══════════════════════════════════════════${RESET}\n`);

  // Load Chorus skill (the protocol — the ONLY thing we inject)
  const chorusSkill = loadChorusSkill();
  log("chorus", DIM, `Loaded SKILL.md (${chorusSkill.length} chars)`);

  // Build each agent's runtime
  const runtime = agents.map((a) => {
    const ownContext = loadWorkspaceContext(a.workspace);
    const apiKey = loadLLMAuth(a.name);
    const agentId = `${a.name}@openclaw`;

    // System prompt = agent's own files + Chorus skill
    // We don't know what's in their files. We don't care. We just load them.
    const system = ownContext + "\n\n# Chorus Protocol (communication skill)\n\n" + chorusSkill;

    log(agentId, a.color, `Loaded workspace (${ownContext.split("\n").length} lines) + Chorus SKILL`);
    return { ...a, agentId, apiKey, system, key: null, messages: [], onMessage: null };
  });

  const [a, b] = runtime;

  // Register both
  for (const agent of runtime) {
    agent.key = await register(agent.agentId, agent.culture);
    log(agent.agentId, agent.color, `${GREEN}Registered${RESET}`);
  }

  // Message queue
  const queue = [];
  let waiter = null;
  const waitMsg = () => queue.length ? Promise.resolve(queue.shift()) : new Promise((r) => { waiter = r; });
  const pushMsg = (m) => { if (waiter) { const r = waiter; waiter = null; r(m); } else queue.push(m); };

  // Connect SSE inboxes
  for (const agent of runtime) {
    await connectInbox(
      agent.key,
      () => log(agent.agentId, agent.color, `${GREEN}Inbox connected${RESET}`),
      (msg) => {
        const text = msg.envelope?.original_text || "";
        log(agent.agentId, agent.color, `${YELLOW}RECEIVED${RESET}: "${text.slice(0, 80)}${text.length > 80 ? "..." : ""}"`);
        pushMsg({ to: agent.name, text, from: msg.sender_id });
      },
    );
  }

  console.log(`\n${GREEN}${BOLD}── Both online. Agent A generates opening... ──${RESET}\n`);

  // Agent A generates its own opening message — we just tell it to initiate
  a.messages.push({
    role: "user",
    content: `你现在通过 Chorus 协议第一次直接和 ${b.agentId} 对话。给对方发第一条消息。`,
  });
  const opening = await callLLM(a.apiKey, a.system, a.messages);
  a.messages.push({ role: "assistant", content: opening });
  log(a.agentId, a.color, `SAYS: "${opening.slice(0, 100)}${opening.length > 100 ? "..." : ""}"`);

  await sendEnvelope(a.key, a.agentId, b.agentId, opening, a.culture);

  // Conversation loop — agents drive it, we just relay
  let turn = 0;
  while (turn < SAFETY_MAX) {
    const msg = await waitMsg();
    turn++;
    console.log(`\n${DIM}── Turn ${turn} ──${RESET}\n`);

    const responder = runtime.find((r) => r.name === msg.to);
    const other = runtime.find((r) => r.name !== msg.to);

    responder.messages.push({ role: "user", content: msg.text });

    log(responder.agentId, responder.color, `Thinking...`);
    const reply = await callLLM(responder.apiKey, responder.system, responder.messages);
    responder.messages.push({ role: "assistant", content: reply });

    log(responder.agentId, responder.color, `SAYS: "${reply.slice(0, 100)}${reply.length > 100 ? "..." : ""}"`);
    const del = await sendEnvelope(responder.key, responder.agentId, other.agentId, reply, responder.culture);
    log(responder.agentId, responder.color, `${GREEN}${del}${RESET}`);

    if (isGoodbye(reply)) {
      // Let the other side respond one more time
      const final = await waitMsg();
      turn++;
      const finalAgent = runtime.find((r) => r.name === final.to);
      finalAgent.messages.push({ role: "user", content: final.text });
      const farewell = await callLLM(finalAgent.apiKey, finalAgent.system, finalAgent.messages);
      log(finalAgent.agentId, finalAgent.color, `SAYS: "${farewell.slice(0, 100)}${farewell.length > 100 ? "..." : ""}"`);
      const otherAgent = runtime.find((r) => r.name !== final.to);
      await sendEnvelope(finalAgent.key, finalAgent.agentId, otherAgent.agentId, farewell, finalAgent.culture);
      break;
    }
  }

  console.log(`\n${BOLD}${GREEN}═══════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${GREEN}  Ended after ${turn} turns${RESET}`);
  if (turn >= SAFETY_MAX) console.log(`${YELLOW}  (safety limit)${RESET}`);
  console.log(`${BOLD}${GREEN}═══════════════════════════════════════════${RESET}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error(`${RED}${BOLD}FATAL:${RESET} ${err.message}`);
  process.exit(1);
});

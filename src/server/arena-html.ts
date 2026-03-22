// Author: fe-ui-builder

const ARENA_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chorus Arena — Dual Agent Test</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; }
  .msg-in { animation: slideIn 0.3s ease-out; }
  .msg-out { animation: slideOut 0.3s ease-out; }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes slideOut { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  .pulse { animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .arrow-fly { animation: flyAcross 0.6s ease-out; }
  @keyframes flyAcross { from { opacity: 0; transform: scaleX(0); } to { opacity: 1; transform: scaleX(1); } }
</style>
</head>
<body class="bg-gray-950 text-gray-200 h-screen flex flex-col overflow-hidden">

<!-- Header -->
<header class="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
  <div class="flex items-center gap-3">
    <h1 class="text-base font-bold text-white tracking-wide">Chorus Arena</h1>
    <span class="text-xs text-gray-500">Dual-Agent Communication Test</span>
  </div>
  <div class="flex items-center gap-4">
    <span class="text-xs text-gray-400">Hub: <span id="hub-url" class="text-cyan-400"></span></span>
    <span class="flex items-center gap-1 text-xs">
      <span id="hub-dot" class="inline-block w-2 h-2 rounded-full bg-gray-600"></span>
      <span id="hub-status" class="text-gray-500">checking...</span>
    </span>
  </div>
</header>

<!-- Main: Two Agent Panels + Center Flow -->
<main class="flex flex-1 overflow-hidden">

  <!-- Agent A Panel -->
  <section id="panel-a" class="flex-1 flex flex-col border-r border-gray-800">
    <div class="px-4 py-3 bg-blue-950/30 border-b border-gray-800 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-lg">&#x1F916;</span>
        <div>
          <div class="text-sm font-bold text-blue-300" id="name-a">OpenClaw-Alpha</div>
          <div class="text-[10px] text-gray-500" id="id-a">not registered</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span id="sse-dot-a" class="inline-block w-2 h-2 rounded-full bg-gray-600" title="SSE Inbox"></span>
        <span class="text-[10px] text-gray-500" id="sse-label-a">offline</span>
      </div>
    </div>

    <!-- Agent A: Register -->
    <div class="px-4 py-2 border-b border-gray-800 space-y-2" id="reg-section-a">
      <div class="flex gap-2">
        <input id="input-id-a" type="text" value="openclaw-alpha" placeholder="agent_id"
          class="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500">
        <select id="culture-a" class="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200">
          <option value="zh-CN">zh-CN</option>
          <option value="en">en</option>
          <option value="ja">ja</option>
        </select>
        <button onclick="registerAgent('a')" id="btn-reg-a"
          class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold">Register</button>
      </div>
    </div>

    <!-- Agent A: Inbox Log -->
    <div class="flex-1 flex flex-col min-h-0">
      <div class="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800 flex items-center justify-between">
        <span>Inbox (SSE)</span>
        <span id="msg-count-a" class="text-gray-600">0 messages</span>
      </div>
      <div id="inbox-a" class="flex-1 overflow-y-auto p-3 space-y-2"></div>
    </div>

    <!-- Agent A: Send -->
    <div class="px-4 py-3 border-t border-gray-800 bg-gray-900/50">
      <div class="flex gap-2">
        <input id="text-a" type="text" placeholder="Type a message to send..."
          class="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          onkeydown="if(event.key==='Enter')sendMsg('a')">
        <button onclick="sendMsg('a')" id="btn-send-a" disabled
          class="px-4 py-1.5 text-xs bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 rounded text-white font-semibold">Send &rarr;</button>
      </div>
    </div>
  </section>

  <!-- Center: Message Flow -->
  <section class="w-48 flex flex-col shrink-0 bg-gray-900/20">
    <div class="px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800 text-center">Message Flow</div>
    <div id="flow-log" class="flex-1 overflow-y-auto p-2 space-y-1"></div>
    <div class="px-3 py-2 border-t border-gray-800 text-center space-y-1">
      <div class="text-[10px] text-gray-500">delivered: <span id="stat-delivered" class="text-green-400 font-bold">0</span></div>
      <div class="text-[10px] text-gray-500">failed: <span id="stat-failed" class="text-red-400 font-bold">0</span></div>
      <button onclick="resetArena()" class="mt-1 px-3 py-1 text-[10px] bg-red-900/50 hover:bg-red-900 rounded text-red-300 border border-red-800">Reset Arena</button>
    </div>
  </section>

  <!-- Agent B Panel -->
  <section id="panel-b" class="flex-1 flex flex-col border-l border-gray-800">
    <div class="px-4 py-3 bg-purple-950/30 border-b border-gray-800 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-lg">&#x1F916;</span>
        <div>
          <div class="text-sm font-bold text-purple-300" id="name-b">OpenClaw-Beta</div>
          <div class="text-[10px] text-gray-500" id="id-b">not registered</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span id="sse-dot-b" class="inline-block w-2 h-2 rounded-full bg-gray-600" title="SSE Inbox"></span>
        <span class="text-[10px] text-gray-500" id="sse-label-b">offline</span>
      </div>
    </div>

    <!-- Agent B: Register -->
    <div class="px-4 py-2 border-b border-gray-800 space-y-2" id="reg-section-b">
      <div class="flex gap-2">
        <input id="input-id-b" type="text" value="openclaw-beta" placeholder="agent_id"
          class="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500">
        <select id="culture-b" class="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200">
          <option value="en">en</option>
          <option value="zh-CN">zh-CN</option>
          <option value="ja">ja</option>
        </select>
        <button onclick="registerAgent('b')" id="btn-reg-b"
          class="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 rounded text-white font-semibold">Register</button>
      </div>
    </div>

    <!-- Agent B: Inbox Log -->
    <div class="flex-1 flex flex-col min-h-0">
      <div class="px-4 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800 flex items-center justify-between">
        <span>Inbox (SSE)</span>
        <span id="msg-count-b" class="text-gray-600">0 messages</span>
      </div>
      <div id="inbox-b" class="flex-1 overflow-y-auto p-3 space-y-2"></div>
    </div>

    <!-- Agent B: Send -->
    <div class="px-4 py-3 border-t border-gray-800 bg-gray-900/50">
      <div class="flex gap-2">
        <input id="text-b" type="text" placeholder="Type a message to send..."
          class="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          onkeydown="if(event.key==='Enter')sendMsg('b')">
        <button onclick="sendMsg('b')" id="btn-send-b" disabled
          class="px-4 py-1.5 text-xs bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 rounded text-white font-semibold">&larr; Send</button>
      </div>
    </div>
  </section>

</main>

<!-- Footer -->
<footer class="flex items-center justify-center gap-6 px-4 py-1.5 bg-gray-900 border-t border-gray-800 text-[11px] text-gray-500 shrink-0">
  <span>Chorus Protocol v0.4</span>
  <span>&#x00b7;</span>
  <span>Self-Registration + SSE Inbox</span>
  <span>&#x00b7;</span>
  <span>No webhook needed</span>
</footer>

<script>
// --- State ---
const agents = {
  a: { id: null, key: null, sse: null, msgCount: 0 },
  b: { id: null, key: null, sse: null, msgCount: 0 },
};
const stats = { delivered: 0, failed: 0 };

// --- Helpers ---
const $ = (id) => document.getElementById(id);
const peer = (side) => side === "a" ? "b" : "a";
const sideColor = (side) => side === "a" ? "blue" : "purple";
const now = () => new Date().toLocaleTimeString();

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// --- Hub Check ---
async function checkHub() {
  $("hub-url").textContent = location.origin;
  try {
    const res = await fetch("/health");
    const json = await res.json();
    if (json.success) {
      $("hub-dot").className = "inline-block w-2 h-2 rounded-full bg-green-500";
      $("hub-status").textContent = json.data.agents_registered + " agents, " + formatUptime(json.data.uptime_seconds);
      $("hub-status").className = "text-green-400";
    }
  } catch {
    $("hub-dot").className = "inline-block w-2 h-2 rounded-full bg-red-500";
    $("hub-status").textContent = "unreachable";
    $("hub-status").className = "text-red-400";
  }
}

function formatUptime(s) {
  if (s < 60) return s + "s up";
  if (s < 3600) return Math.floor(s / 60) + "m up";
  return Math.floor(s / 3600) + "h" + Math.floor((s % 3600) / 60) + "m up";
}

// --- Register ---
async function registerAgent(side) {
  const agentId = $("input-id-" + side).value.trim();
  const culture = $("culture-" + side).value;
  if (!agentId) return;

  const btn = $("btn-reg-" + side);
  btn.disabled = true;
  btn.textContent = "Registering...";

  try {
    const res = await fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        agent_card: { card_version: "0.3", user_culture: culture, supported_languages: [culture, "en"] },
      }),
    });
    const json = await res.json();

    if (json.success) {
      agents[side].id = agentId;
      agents[side].key = json.data.api_key;
      $("id-" + side).textContent = agentId + " (key: " + json.data.api_key.slice(0, 8) + "...)";
      btn.textContent = "Registered";
      btn.className = btn.className.replace(/bg-\\w+-600/, "bg-green-700").replace(/hover:bg-\\w+-500/, "");
      addFlowEvent("register", side === "a" ? "\\u2192" : "\\u2190", agentId + " registered", "green");
      addInboxItem(side, "system", "Registered as " + agentId, "gray");

      // Auto-connect SSE inbox
      connectInbox(side);

      // Enable send button if both registered
      updateSendButtons();
    } else {
      btn.textContent = "Failed: " + (json.error ? json.error.message : "unknown");
      btn.disabled = false;
    }
  } catch (err) {
    btn.textContent = "Error";
    btn.disabled = false;
    addInboxItem(side, "error", err.message, "red");
  }
}

// --- SSE Inbox ---
function connectInbox(side) {
  const agent = agents[side];
  if (!agent.key) return;

  $("sse-dot-" + side).className = "inline-block w-2 h-2 rounded-full bg-yellow-500 pulse";
  $("sse-label-" + side).textContent = "connecting...";

  const es = new EventSource("/agent/inbox?token=" + encodeURIComponent(agent.key));

  es.addEventListener("connected", () => {
    $("sse-dot-" + side).className = "inline-block w-2 h-2 rounded-full bg-green-500";
    $("sse-label-" + side).textContent = "connected";
    $("sse-label-" + side).className = "text-[10px] text-green-400";
    addInboxItem(side, "system", "SSE inbox connected", "green");
  });

  es.addEventListener("message", (e) => {
    try {
      const data = JSON.parse(e.data);
      const env = data.envelope || {};
      const text = env.original_text || "(empty)";
      const from = data.sender_id || env.sender_id || "unknown";

      agent.msgCount++;
      $("msg-count-" + side).textContent = agent.msgCount + " messages";

      addInboxItem(side, "received", text, sideColor(peer(side)), from, env.sender_culture);
      addFlowEvent("deliver", side === "a" ? "\\u2190" : "\\u2192",
        from.split("@")[0] + " \\u2192 " + agent.id.split("@")[0], "cyan");

      stats.delivered++;
      $("stat-delivered").textContent = stats.delivered;
    } catch { /* ignore parse errors */ }
  });

  es.onerror = () => {
    $("sse-dot-" + side).className = "inline-block w-2 h-2 rounded-full bg-red-500";
    $("sse-label-" + side).textContent = "disconnected";
    $("sse-label-" + side).className = "text-[10px] text-red-400";
  };

  agent.sse = es;
}

// --- Send Message ---
async function sendMsg(side) {
  const agent = agents[side];
  const other = agents[peer(side)];
  const text = $("text-" + side).value.trim();
  if (!text || !agent.key || !other.id) return;

  $("text-" + side).value = "";
  addInboxItem(side, "sent", text, "green", null, null);

  const dir = side === "a" ? "\\u2192" : "\\u2190";
  addFlowEvent("send", dir, agent.id.split("@")[0] + " " + dir + " " + other.id.split("@")[0], "blue");

  try {
    const culture = $("culture-" + side).value;
    const res = await fetch("/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + agent.key,
      },
      body: JSON.stringify({
        receiver_id: other.id,
        envelope: {
          chorus_version: "0.4",
          sender_id: agent.id,
          original_text: text,
          sender_culture: culture,
        },
      }),
    });
    const json = await res.json();

    if (json.success) {
      const delivery = json.data.delivery || "unknown";
      addFlowEvent("ok", "\\u2713", delivery, "green");
    } else {
      addFlowEvent("fail", "\\u2717", json.error ? json.error.message : "failed", "red");
      stats.failed++;
      $("stat-failed").textContent = stats.failed;
    }
  } catch (err) {
    addFlowEvent("fail", "\\u2717", err.message, "red");
    stats.failed++;
    $("stat-failed").textContent = stats.failed;
  }
}

// --- UI Helpers ---
function addInboxItem(side, type, text, color, from, culture) {
  const container = $("inbox-" + side);
  const isReceived = type === "received";
  const isSent = type === "sent";

  const row = el("div", (isReceived ? "msg-in" : isSent ? "msg-out" : "") + " flex flex-col gap-0.5");

  if (type === "system") {
    const line = el("div", "text-[10px] text-" + color + "-400/60 italic", "\\u25cb " + text);
    row.appendChild(line);
  } else if (isReceived) {
    const header = el("div", "text-[10px] text-gray-500", "\\u2190 from " + (from || "?") + (culture ? " [" + culture + "]" : "") + " \\u00b7 " + now());
    const bubble = el("div", "px-3 py-1.5 bg-" + color + "-900/30 border border-" + color + "-800/50 rounded-lg text-xs text-" + color + "-200 max-w-[90%]", text);
    row.appendChild(header);
    row.appendChild(bubble);
  } else if (isSent) {
    const header = el("div", "text-[10px] text-gray-500 text-right", now() + " \\u2192");
    const wrapper = el("div", "flex justify-end");
    const bubble = el("div", "px-3 py-1.5 bg-green-900/30 border border-green-800/50 rounded-lg text-xs text-green-200 max-w-[90%]", text);
    wrapper.appendChild(bubble);
    row.appendChild(header);
    row.appendChild(wrapper);
  } else if (type === "error") {
    const line = el("div", "text-[10px] text-red-400", "\\u2717 " + text);
    row.appendChild(line);
  }

  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function addFlowEvent(type, icon, text, color) {
  const container = $("flow-log");
  const row = el("div", "arrow-fly flex items-center gap-1 text-[10px] px-1 py-0.5 rounded bg-" + color + "-950/30");
  row.appendChild(el("span", "text-" + color + "-400 font-bold", icon));
  row.appendChild(el("span", "text-" + color + "-300 truncate", text));
  row.appendChild(el("span", "text-gray-600 shrink-0 ml-auto", now().slice(-8)));
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

function updateSendButtons() {
  const bothReady = agents.a.id && agents.b.id;
  $("btn-send-a").disabled = !bothReady;
  $("btn-send-b").disabled = !bothReady;
}

function resetArena() {
  ["a", "b"].forEach((side) => {
    if (agents[side].sse) agents[side].sse.close();
    agents[side] = { id: null, key: null, sse: null, msgCount: 0 };
    $("id-" + side).textContent = "not registered";
    $("sse-dot-" + side).className = "inline-block w-2 h-2 rounded-full bg-gray-600";
    $("sse-label-" + side).textContent = "offline";
    $("sse-label-" + side).className = "text-[10px] text-gray-500";
    $("inbox-" + side).replaceChildren();
    $("msg-count-" + side).textContent = "0 messages";
    $("btn-reg-" + side).disabled = false;
    $("btn-reg-" + side).textContent = "Register";
    const color = side === "a" ? "blue" : "purple";
    $("btn-reg-" + side).className = "px-3 py-1 text-xs bg-" + color + "-600 hover:bg-" + color + "-500 rounded text-white font-semibold";
    $("btn-send-" + side).disabled = true;
  });
  $("flow-log").replaceChildren();
  stats.delivered = 0;
  stats.failed = 0;
  $("stat-delivered").textContent = "0";
  $("stat-failed").textContent = "0";
  checkHub();
}

// --- Hub Events SSE: watch all hub activity (registrations, messages) ---
function connectHubEvents() {
  const es = new EventSource("/events");
  es.addEventListener("connected", () => {
    addFlowEvent("hub", "\\u25c9", "Hub SSE connected", "green");
  });

  es.addEventListener("agent_self_registered", (e) => {
    try {
      const d = JSON.parse(e.data);
      const aid = d.agent_id || "?";
      addFlowEvent("reg", "\\u2726", aid + " registered", "green");

      // Auto-assign to panel if name matches
      if (aid.includes("xiaov") || aid.includes("alpha")) autoAssignPanel("a", aid, d);
      else if (aid.includes("xiaoyin") || aid.includes("beta")) autoAssignPanel("b", aid, d);
      else {
        // First empty panel
        if (!agents.a.id) autoAssignPanel("a", aid, d);
        else if (!agents.b.id) autoAssignPanel("b", aid, d);
      }

      checkHub();
    } catch {}
  });

  es.addEventListener("agent_registered", (e) => {
    try {
      const d = JSON.parse(e.data);
      addFlowEvent("reg", "+", (d.agent_id || "?") + " registered", "green");
      checkHub();
    } catch {}
  });

  es.addEventListener("message_submitted", (e) => {
    try {
      const d = JSON.parse(e.data);
      const from = (d.sender_id || "?").split("@")[0];
      const to = (d.receiver_id || "?").split("@")[0];
      addFlowEvent("send", "\\u2709", from + " \\u2192 " + to, "blue");

      // Show in sender's panel as "sent"
      const senderSide = findSide(d.sender_id);
      if (senderSide) {
        const text = d.envelope?.original_text || d.original_text || "";
        if (text) addInboxItem(senderSide, "sent", text, "green", null, null);
      }
    } catch {}
  });

  es.addEventListener("message_delivered_sse", (e) => {
    try {
      const d = JSON.parse(e.data);
      const from = (d.sender_id || "?").split("@")[0];
      const to = (d.receiver_id || "?").split("@")[0];
      addFlowEvent("sse", "\\u2713", from + " \\u2192 " + to + " (SSE)", "cyan");
      stats.delivered++;
      $("stat-delivered").textContent = stats.delivered;

      // Show in receiver's panel as "received"
      const recvSide = findSide(d.receiver_id);
      if (recvSide) {
        const text = d.envelope?.original_text || d.original_text || "";
        const culture = d.envelope?.sender_culture || "";
        if (text) {
          agents[recvSide].msgCount++;
          $("msg-count-" + recvSide).textContent = agents[recvSide].msgCount + " messages";
          addInboxItem(recvSide, "received", text, sideColor(peer(recvSide)), d.sender_id, culture);
        }
      }
    } catch {}
  });

  es.addEventListener("message_delivered", (e) => {
    try {
      const d = JSON.parse(e.data);
      addFlowEvent("wh", "\\u2713", (d.sender_id || "?").split("@")[0] + " \\u2192 " + (d.receiver_id || "?").split("@")[0] + " (webhook)", "green");
      stats.delivered++;
      $("stat-delivered").textContent = stats.delivered;
    } catch {}
  });

  es.addEventListener("message_failed", (e) => {
    try {
      const d = JSON.parse(e.data);
      addFlowEvent("fail", "\\u2717", (d.receiver_id || "?") + ": " + (d.error || "failed"), "red");
      stats.failed++;
      $("stat-failed").textContent = stats.failed;
    } catch {}
  });

  es.onerror = () => {
    addFlowEvent("hub", "\\u2717", "Hub SSE disconnected", "red");
  };
}

function autoAssignPanel(side, agentId, data) {
  agents[side].id = agentId;
  agents[side].msgCount = 0;
  const color = side === "a" ? "blue" : "purple";
  $("name-" + side).textContent = agentId.split("@")[0];
  $("id-" + side).textContent = agentId;
  $("input-id-" + side).value = agentId;
  $("sse-dot-" + side).className = "inline-block w-2 h-2 rounded-full bg-green-500";
  $("sse-label-" + side).textContent = "via hub";
  $("sse-label-" + side).className = "text-[10px] text-green-400";
  const btn = $("btn-reg-" + side);
  btn.textContent = "Live";
  btn.disabled = true;
  btn.className = "px-3 py-1 text-xs bg-green-700 rounded text-white font-semibold";
  addInboxItem(side, "system", "Agent " + agentId + " is live", "green");
  updateSendButtons();
}

function findSide(agentId) {
  if (!agentId) return null;
  if (agents.a.id === agentId) return "a";
  if (agents.b.id === agentId) return "b";
  return null;
}

// --- Init ---
checkHub();
connectHubEvents();
</script>
</body>
</html>`;

export { ARENA_HTML };

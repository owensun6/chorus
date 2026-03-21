// Author: fe-ui-builder

const CONSOLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chorus Alpha Console</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; }
  .event-enter { animation: fadeIn 0.2s ease-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
  #detail-json { white-space: pre-wrap; word-break: break-all; }
</style>
</head>
<body class="bg-gray-950 text-gray-200 h-screen flex flex-col overflow-hidden">

<!-- Header -->
<header class="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
  <div class="flex items-center gap-3">
    <h1 class="text-sm font-bold text-white tracking-wide">Chorus Alpha Console</h1>
    <span class="flex items-center gap-1 text-xs">
      SSE <span id="sse-dot" class="inline-block w-2 h-2 rounded-full bg-red-500"></span>
    </span>
  </div>
  <div class="flex items-center gap-3">
    <label class="text-xs text-gray-400">API Key:
      <input id="api-key" type="password" placeholder="Bearer token"
        class="ml-1 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 w-40 focus:outline-none focus:border-blue-500">
    </label>
    <span class="flex items-center gap-1 text-xs">
      Hub <span id="hub-dot" class="inline-block w-2 h-2 rounded-full bg-gray-600"></span>
    </span>
  </div>
</header>

<!-- Main 3-Column Layout -->
<main class="flex flex-1 overflow-hidden">

  <!-- Left: Agents -->
  <section class="w-56 border-r border-gray-800 flex flex-col shrink-0">
    <div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">Agents</div>
    <div id="agent-list" class="flex-1 overflow-y-auto p-2 space-y-1 text-xs"></div>
  </section>

  <!-- Center: Timeline -->
  <section class="flex-1 flex flex-col min-w-0">
    <div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">Timeline</div>
    <div id="timeline" class="flex-1 overflow-y-auto p-2 space-y-1"></div>
  </section>

  <!-- Right: Detail + Actions -->
  <section class="w-80 border-l border-gray-800 flex flex-col shrink-0">
    <div class="flex-1 flex flex-col">
      <div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">Detail</div>
      <pre id="detail-json" class="flex-1 overflow-y-auto p-3 text-xs text-gray-400">Click an event or agent</pre>
    </div>
    <div class="border-t border-gray-800">
      <div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">Test Actions</div>
      <div class="p-3 space-y-2">
        <button onclick="doRegister()" class="w-full px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white">Register Agent</button>
        <button onclick="doSendMessage()" class="w-full px-2 py-1 text-xs bg-green-600 hover:bg-green-500 rounded text-white">Send Message</button>
        <div class="text-[10px] text-gray-500 font-semibold uppercase mt-2">Negative Tests</div>
        <button onclick="doNoAuth()" class="w-full px-2 py-1 text-xs bg-red-900 hover:bg-red-800 rounded text-red-300">No Auth POST</button>
        <button onclick="doUnknownReceiver()" class="w-full px-2 py-1 text-xs bg-red-900 hover:bg-red-800 rounded text-red-300">Unknown Receiver</button>
        <button onclick="doBadEnvelope()" class="w-full px-2 py-1 text-xs bg-red-900 hover:bg-red-800 rounded text-red-300">Bad Envelope</button>
      </div>
    </div>
  </section>

</main>

<!-- Footer -->
<footer id="footer" class="flex items-center gap-6 px-4 py-1.5 bg-gray-900 border-t border-gray-800 text-[11px] text-gray-500 shrink-0">
  <span>uptime: <b id="ft-uptime">-</b></span>
  <span>agents: <b id="ft-agents">0</b></span>
  <span>delivered: <b id="ft-delivered" class="text-green-400">0</b></span>
  <span>failed: <b id="ft-failed" class="text-red-400">0</b></span>
</footer>

<script>
// --- State ---
const state = { agents: [], lastEventId: 0 };

// --- Helpers ---
const $ = (id) => document.getElementById(id);
const apiHeaders = () => {
  const key = $("api-key").value.trim();
  const h = { "Content-Type": "application/json" };
  if (key) h["Authorization"] = "Bearer " + key;
  return h;
};
const ts = (iso) => { try { return new Date(iso).toLocaleTimeString(); } catch { return "??:??"; } };

const TYPE_STYLE = {
  agent_registered: { icon: "+", color: "text-green-400", bg: "bg-green-950" },
  agent_removed:    { icon: "-", color: "text-red-400",   bg: "bg-red-950" },
  message_submitted:       { icon: "\\u2709", color: "text-blue-400",  bg: "bg-blue-950" },
  message_forward_started: { icon: "\\u2192", color: "text-blue-300",  bg: "bg-blue-950" },
  message_delivered:       { icon: "\\u2713", color: "text-green-400", bg: "bg-green-950" },
  message_failed:          { icon: "\\u2717", color: "text-red-400",   bg: "bg-red-950" },
};

// --- Safe DOM helpers (no innerHTML) ---
function el(tag, classes, text) {
  const e = document.createElement(tag);
  if (classes) e.className = classes;
  if (text !== undefined) e.textContent = text;
  return e;
}

function shortUrl(u) { try { return new URL(u).host; } catch { return u || ""; } }

// --- Rendering ---
function renderAgents() {
  const container = $("agent-list");
  container.replaceChildren();
  if (state.agents.length === 0) {
    container.appendChild(el("div", "text-gray-600 text-center py-4", "No agents"));
    return;
  }
  state.agents.forEach((a) => {
    const card = el("div", "p-2 bg-gray-900 rounded cursor-pointer hover:bg-gray-800 border border-gray-800");
    card.addEventListener("click", () => showDetail(a));
    const nameRow = el("div", "font-semibold text-white truncate", a.agent_id);
    const culture = a.agent_card ? a.agent_card.user_culture : "?";
    const infoRow = el("div", "text-gray-400", culture + " \\u00b7 " + shortUrl(a.endpoint));
    card.appendChild(nameRow);
    card.appendChild(infoRow);
    container.appendChild(card);
  });
}

function prependEvent(evt) {
  const s = TYPE_STYLE[evt.type] || { icon: "?", color: "text-gray-400", bg: "bg-gray-900" };
  const summary = buildSummary(evt);

  const row = el("div", "event-enter flex items-start gap-2 p-1.5 rounded text-xs cursor-pointer hover:bg-gray-800 " + s.bg);
  row.addEventListener("click", () => showDetail(evt));
  row.appendChild(el("span", s.color + " font-bold w-4 text-center shrink-0", s.icon));
  row.appendChild(el("span", "text-gray-500 shrink-0", ts(evt.timestamp)));
  row.appendChild(el("span", s.color + " truncate", evt.type));
  row.appendChild(el("span", "text-gray-500 truncate", summary));

  $("timeline").prepend(row);
}

function buildSummary(evt) {
  const d = evt.data || evt;
  if (d.sender_id && d.receiver_id) return d.sender_id + " \\u2192 " + d.receiver_id;
  if (d.agent_id) return d.agent_id;
  if (d.trace_id && d.receiver_id) return "\\u2192 " + d.receiver_id;
  if (d.error) return String(d.error);
  return "";
}

function showDetail(obj) {
  $("detail-json").textContent = JSON.stringify(obj, null, 2);
}

// --- Data Loading ---
async function loadAgents() {
  try {
    const res = await fetch("/agents");
    const json = await res.json();
    if (json.success) { state.agents = json.data; renderAgents(); }
  } catch { /* ignore */ }
}

async function loadHealth() {
  try {
    const res = await fetch("/health");
    const json = await res.json();
    if (json.success) {
      $("hub-dot").className = "inline-block w-2 h-2 rounded-full bg-green-500";
      const d = json.data;
      $("ft-uptime").textContent = formatUptime(d.uptime_seconds);
      $("ft-agents").textContent = String(d.agents_registered);
      $("ft-delivered").textContent = String(d.messages_delivered);
      $("ft-failed").textContent = String(d.messages_failed);
    }
  } catch {
    $("hub-dot").className = "inline-block w-2 h-2 rounded-full bg-red-500";
  }
}

async function loadActivity() {
  try {
    const url = state.lastEventId ? "/activity?since=" + state.lastEventId : "/activity";
    const res = await fetch(url);
    const json = await res.json();
    if (json.success && json.data.length > 0) {
      json.data.forEach((evt) => {
        prependEvent(evt);
        if (evt.id > state.lastEventId) state.lastEventId = evt.id;
      });
    }
  } catch { /* ignore */ }
}

function formatUptime(s) {
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m" + (s % 60) + "s";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h + "h" + m + "m";
}

// --- SSE ---
function connectSSE() {
  const es = new EventSource("/events");
  es.addEventListener("connected", () => {
    $("sse-dot").className = "inline-block w-2 h-2 rounded-full bg-green-500";
  });

  const eventTypes = ["agent_registered", "agent_removed", "message_submitted", "message_forward_started", "message_delivered", "message_failed"];
  eventTypes.forEach((type) => {
    es.addEventListener(type, (e) => {
      try {
        const data = JSON.parse(e.data);
        const evt = { type, timestamp: data.timestamp, data, id: data.id };
        prependEvent(evt);
        if (data.id > state.lastEventId) state.lastEventId = data.id;
      } catch { /* ignore */ }

      if (type === "agent_registered" || type === "agent_removed") loadAgents();
      if (type === "message_delivered" || type === "message_failed") loadHealth();
    });
  });

  es.onerror = () => {
    $("sse-dot").className = "inline-block w-2 h-2 rounded-full bg-red-500";
  };
}

// --- Test Actions ---
async function doRegister() {
  const id = "test-" + Math.random().toString(36).slice(2, 6) + "@console";
  const res = await fetch("/agents", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      agent_id: id,
      endpoint: "http://localhost:9999/receive",
      agent_card: { card_version: "0.3", user_culture: "en", supported_languages: ["en"] },
    }),
  });
  const json = await res.json();
  showDetail(json);
  loadAgents();
}

async function doSendMessage() {
  if (state.agents.length < 2) { showDetail({ error: "Need at least 2 registered agents" }); return; }
  const sender = state.agents[0].agent_id;
  const receiver = state.agents[1].agent_id;
  const res = await fetch("/messages", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      receiver_id: receiver,
      envelope: { chorus_version: "0.4", sender_id: sender, original_text: "Hello from console", sender_culture: "en" },
    }),
  });
  const json = await res.json();
  showDetail(json);
}

async function doNoAuth() {
  const res = await fetch("/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiver_id: "x", envelope: {} }),
  });
  const json = await res.json();
  showDetail(json);
}

async function doUnknownReceiver() {
  if (state.agents.length < 1) { showDetail({ error: "Need at least 1 registered agent" }); return; }
  const sender = state.agents[0].agent_id;
  const res = await fetch("/messages", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      receiver_id: "nonexistent@ghost",
      envelope: { chorus_version: "0.4", sender_id: sender, original_text: "Ghost test", sender_culture: "en" },
    }),
  });
  const json = await res.json();
  showDetail(json);
}

async function doBadEnvelope() {
  const res = await fetch("/messages", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ receiver_id: "x" }),
  });
  const json = await res.json();
  showDetail(json);
}

// --- Init ---
loadAgents();
loadHealth();
loadActivity();
connectSSE();
setInterval(loadHealth, 15000);
</script>
</body>
</html>`;

export { CONSOLE_HTML };

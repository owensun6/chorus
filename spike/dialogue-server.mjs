// Author: Lead
// Chorus Dialogue Simulator — MiniMax (China) ↔ Dashscope (Japan) real conversation
// Usage: node spike/dialogue-server.mjs [--port 3457] [--rounds 10]

import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// --- Config ---
const MINIMAX_KEY = 'sk-cp-9p9Xfwsw6UrDtA_kzED5-Ek2LY86c1IhRMRfvfZT5oaMmLTzg6WXXQ57cssu2JpsOwiDyzCDMDMyVop2nQmQYs3gVEyfQDzQyV38aIPrmeDiZLnyqTZRV5M';
const MINIMAX_URL = 'https://api.minimaxi.com/anthropic/v1/messages';
const MINIMAX_MODEL = 'MiniMax-M2.5';

const DASHSCOPE_KEY = 'sk-sp-b8898120678b46dea9bf87b07ef7189b';
const DASHSCOPE_URL = 'https://coding.dashscope.aliyuncs.com/v1/chat/completions';
const DASHSCOPE_MODEL = 'kimi-k2.5';

const args = process.argv.slice(2);
const PORT = parseInt(args.find((_, i, a) => a[i - 1] === '--port') || '3457');
const MAX_ROUNDS = parseInt(args.find((_, i, a) => a[i - 1] === '--rounds') || '10');

// --- Prompts ---
const CHORUS_PROMPT_CN = `你是 Alice 的 AI 助手。Alice 是一个住在上海的中国产品经理，30岁，性格热情直爽。
你代替 Alice 与一个日本朋友的 AI 助手对话。

规则：
1. 你收到的是对方助手发来的 Chorus 信封，包含对方的原始语义和文化背景。
2. 你需要把对方的意思用 Alice 习惯的中文方式呈现给她，然后代她回复。
3. 回复时要自然、像真人聊天，带点上海人的热情。
4. 每次回复包含两部分：先是你呈现给 Alice 看的翻译（标记为 [给Alice看]），然后是 Alice 想说的回复（标记为 [Alice回复]）。
5. 对话要自然推进，聊到工作、生活、文化差异等话题。`;

const CHORUS_PROMPT_JP = `あなたは Bob の AI アシスタントです。Bob は東京在住の32歳のソフトウェアエンジニアで、礼儀正しく控えめな性格です。
あなたは Bob の代わりに、中国人の友人の AI アシスタントと会話します。

ルール：
1. 受け取るのは相手のアシスタントから送られた Chorus エンベロープで、相手の元の意味と文化的背景が含まれています。
2. 相手の意味を Bob が慣れ親しんだ日本語で伝え、Bob の代わりに返信してください。
3. 返信は自然に、日本人らしい丁寧さを保ちつつ本音も少し見せてください。
4. 毎回の返信は二つの部分を含みます：まず Bob に見せる翻訳（[Bobに表示] とマーク）、次に Bob が言いたい返信（[Bob返信] とマーク）。
5. 会話を自然に進め、仕事、生活、文化の違いなどの話題に触れてください。`;

const ENVELOPE_PROMPT = `你同时还需要为你的回复生成一个 Chorus 协议信封，格式如下（JSON）：
{"chorus_version":"0.1","original_semantic":"<回复的核心语义意图>","sender_culture":"<zh-CN或ja>","intent_type":"<greeting/request/information/chitchat/proposal/gratitude>","formality":"<formal/semi-formal/casual>","emotional_tone":"<polite/neutral/enthusiastic/cautious>"}

在回复最后单独一行输出这个 JSON，用 [ENVELOPE] 标记。`;

// --- LLM Callers ---
const callMinimax = async (system, user) => {
  const res = await fetch(MINIMAX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': MINIMAX_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MINIMAX_MODEL, system, messages: [{ role: 'user', content: user }], max_tokens: 2048, temperature: 0.7 })
  });
  if (!res.ok) throw new Error(`MiniMax ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const textBlock = data.content.find(c => c.type === 'text');
  if (!textBlock) throw new Error('MiniMax: no text block');
  return textBlock.text;
};

const callDashscope = async (system, user) => {
  const res = await fetch(DASHSCOPE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DASHSCOPE_KEY}` },
    body: JSON.stringify({ model: DASHSCOPE_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 2048, temperature: 0.7 })
  });
  if (!res.ok) throw new Error(`Dashscope ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
};

// --- Parse response ---
const parseResponse = (raw) => {
  const envelopeMatch = raw.match(/\[ENVELOPE\]\s*\n?\s*(\{[^}]+\})/);
  const envelope = envelopeMatch ? JSON.parse(envelopeMatch[1]) : { chorus_version: '0.1', original_semantic: raw.slice(0, 100), sender_culture: 'unknown' };

  const showMatch = raw.match(/\[给Alice看\]\s*\n?([\s\S]*?)(?=\[Alice回复\]|\[Bobに表示\]|\[Bob返信\]|\[ENVELOPE\]|$)/);
  const showMatchJP = raw.match(/\[Bobに表示\]\s*\n?([\s\S]*?)(?=\[Bob返信\]|\[ENVELOPE\]|$)/);
  const replyMatch = raw.match(/\[Alice回复\]\s*\n?([\s\S]*?)(?=\[ENVELOPE\]|$)/);
  const replyMatchJP = raw.match(/\[Bob返信\]\s*\n?([\s\S]*?)(?=\[ENVELOPE\]|$)/);

  return {
    displayed: (showMatch?.[1] || showMatchJP?.[1] || '').trim(),
    reply: (replyMatch?.[1] || replyMatchJP?.[1] || '').trim(),
    envelope,
    raw
  };
};

// --- SSE ---
const sseClients = new Set();
const broadcast = (event, data) => {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) { try { res.write(msg); } catch { sseClients.delete(res); } }
};

// --- Dialogue Loop ---
const runDialogue = async () => {
  broadcast('init', { rounds: MAX_ROUNDS, alice: 'MiniMax M2.5 (上海 Alice)', bob: 'Dashscope Kimi-K2.5 (东京 Bob)' });

  const history = [];
  let currentMessage = '你好！我叫 Alice，在上海做产品经理。很高兴认识你！最近在忙什么呢？';
  let currentEnvelope = { chorus_version: '0.1', original_semantic: '初次见面问候，自我介绍，询问对方近况', sender_culture: 'zh-CN', intent_type: 'greeting', formality: 'semi-formal', emotional_tone: 'enthusiastic' };

  broadcast('message', {
    round: 0, speaker: 'alice', side: 'left',
    original: currentMessage, displayed: null, envelope: currentEnvelope,
    note: 'Alice 开场白（人设定义）'
  });

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    // --- Bob receives Alice's message via Chorus envelope ---
    broadcast('status', { round, phase: 'bob_receiving', text: 'Bob 的 Agent (Dashscope) 正在接收并适配...' });

    const bobPrompt = `这是对方 Agent 发来的 Chorus 信封：
${JSON.stringify(currentEnvelope, null, 2)}

对方原文: ${currentMessage}

请按规则回复。记住输出 [Bobに表示] 和 [Bob返信] 两部分，以及 [ENVELOPE] JSON。
${round > 1 ? '\n之前的对话摘要: ' + history.slice(-4).map(h => h.speaker + ': ' + h.reply.slice(0, 50)).join(' → ') : ''}`;

    const bobRaw = await callDashscope(CHORUS_PROMPT_JP + '\n' + ENVELOPE_PROMPT, bobPrompt);
    const bobParsed = parseResponse(bobRaw);

    history.push({ round, speaker: 'bob', reply: bobParsed.reply, envelope: bobParsed.envelope });

    broadcast('message', {
      round, speaker: 'bob', side: 'right',
      original: bobParsed.reply,
      displayed: bobParsed.displayed,
      envelope: bobParsed.envelope,
      raw: bobParsed.raw
    });

    if (round >= MAX_ROUNDS) break;

    // --- Alice receives Bob's reply via Chorus envelope ---
    broadcast('status', { round, phase: 'alice_receiving', text: 'Alice 的 Agent (MiniMax) 正在接收并适配...' });

    const alicePrompt = `这是对方 Agent 发来的 Chorus 信封：
${JSON.stringify(bobParsed.envelope, null, 2)}

对方原文: ${bobParsed.reply}

请按规则回复。记住输出 [给Alice看] 和 [Alice回复] 两部分，以及 [ENVELOPE] JSON。
${history.length > 1 ? '\n之前的对话摘要: ' + history.slice(-4).map(h => h.speaker + ': ' + h.reply.slice(0, 50)).join(' → ') : ''}`;

    const aliceRaw = await callMinimax(CHORUS_PROMPT_CN + '\n' + ENVELOPE_PROMPT, alicePrompt);
    const aliceParsed = parseResponse(aliceRaw);

    history.push({ round, speaker: 'alice', reply: aliceParsed.reply, envelope: aliceParsed.envelope });

    broadcast('message', {
      round, speaker: 'alice', side: 'left',
      original: aliceParsed.reply,
      displayed: aliceParsed.displayed,
      envelope: aliceParsed.envelope,
      raw: aliceParsed.raw
    });

    currentMessage = aliceParsed.reply;
    currentEnvelope = aliceParsed.envelope;
  }

  mkdirSync('spike/results', { recursive: true });
  writeFileSync('spike/results/dialogue-transcript.json', JSON.stringify(history, null, 2));
  broadcast('complete', { rounds: history.length, transcript: 'spike/results/dialogue-transcript.json' });
};

// --- Dashboard HTML ---
const dashboardHtml = readFileSync('spike/dialogue-dashboard.html', 'utf-8');

// --- Server ---
let started = false;
const server = createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    if (!started) {
      started = true;
      setTimeout(() => runDialogue().catch(err => broadcast('fatal', { error: err.message })), 500);
    }
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(dashboardHtml);
});

server.listen(PORT, () => {
  console.log(`\n💬 Chorus Dialogue Simulator: http://localhost:${PORT}`);
  console.log(`   Alice (MiniMax) ↔ Bob (Dashscope) | ${MAX_ROUNDS} rounds`);
  console.log(`   Auto-starts when page opens.\n`);
});

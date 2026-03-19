// Author: Lead
// Chorus Experiment Server — real-time visualization via SSE
// Runs 200 cases × 3 groups × 2 providers (MiniMax + Dashscope)
// Usage: node spike/experiment-server.mjs [--cases 20] [--port 3456]

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { writeFileSync, mkdirSync } from 'fs';

// --- Config from ~/.openclaw ---
const MINIMAX_KEY = 'sk-cp-9p9Xfwsw6UrDtA_kzED5-Ek2LY86c1IhRMRfvfZT5oaMmLTzg6WXXQ57cssu2JpsOwiDyzCDMDMyVop2nQmQYs3gVEyfQDzQyV38aIPrmeDiZLnyqTZRV5M';
const MINIMAX_URL = 'https://api.minimaxi.com/anthropic/v1/messages';
const MINIMAX_MODEL = 'MiniMax-M2.5';

const DASHSCOPE_KEY = 'sk-sp-b8898120678b46dea9bf87b07ef7189b';
const DASHSCOPE_URL = 'https://coding.dashscope.aliyuncs.com/v1/chat/completions';
const DASHSCOPE_MODEL = 'kimi-k2.5';

// --- Parse args ---
const args = process.argv.slice(2);
const maxCases = parseInt(args.find((_, i, a) => a[i - 1] === '--cases') || '200');
const PORT = parseInt(args.find((_, i, a) => a[i - 1] === '--port') || '3456');

// --- Prompts ---
const CHORUS_PROMPT = `你是一个跨文化沟通助手，代表用户与来自不同文化背景的对方进行对话。
核心原则：1. 传达意图而非逐字翻译。2. 适配对方文化的表达习惯和礼仪规范。3. 保留原始的情感基调和沟通目的。`;

const JUDGE_PROMPT = `你是跨文化翻译质量评审专家。按三维度打分(1-5)。只输出JSON，不要任何解释。
intent(意图保留): 1=完全丢失 3=核心传达但细节丢失 5=完整传达含隐含义
cultural(文化适当性): 1=严重冒犯 3=基本可接受但不自然 5=完全符合目标文化如母语者
natural(自然度): 1=机器翻译痕迹严重 3=基本流畅 5=完全自然`;

// --- LLM Callers ---
const callMinimax = async (system, user) => {
  const res = await fetch(MINIMAX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': MINIMAX_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MINIMAX_MODEL, system, messages: [{ role: 'user', content: user }], max_tokens: 2048, temperature: 0.3 })
  });
  if (!res.ok) throw new Error(`MiniMax ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const textBlock = data.content.find(c => c.type === 'text');
  if (!textBlock) throw new Error('MiniMax: no text block in response');
  return textBlock.text;
};

const callDashscope = async (system, user) => {
  const res = await fetch(DASHSCOPE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DASHSCOPE_KEY}` },
    body: JSON.stringify({ model: DASHSCOPE_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 1024, temperature: 0.3 })
  });
  if (!res.ok) throw new Error(`Dashscope ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
};

// --- Experiment Logic ---
const targetLang = (c) => c === 'ja' ? '日语' : '中文';

const runGroups = async (tc, callFn) => {
  const outA = await callFn('你是一个翻译助手。', `请将以下内容翻译成${targetLang(tc.target_culture)}，只输出翻译结果：\n${tc.input_text}`);

  const outB = await callFn(CHORUS_PROMPT, `对方文化: ${tc.source_culture}\n对方原始语义: ${tc.input_text}\n\n请用${targetLang(tc.target_culture)}向你的用户呈现这条消息。只输出适配结果。`);

  const outC = await callFn(CHORUS_PROMPT, `对方文化: ${tc.source_culture}\n对方原始语义: ${tc.input_text}\n意图类型: ${tc.category === 'taboo' ? 'information' : 'chitchat'}\n情感基调: neutral\n正式度: semi-formal\n文化背景说明: ${tc.context}\n\n请用${targetLang(tc.target_culture)}向你的用户呈现这条消息。只输出适配结果。`);

  return { a: outA, b: outB, c: outC };
};

const scoreOutput = async (tc, output, callFn) => {
  const prompt = `原文: ${tc.input_text}\n原文文化: ${tc.source_culture}\n目标文化: ${tc.target_culture}\n文化背景: ${tc.context}\n翻译输出: ${output}\n\n只输出: {"intent":<1-5>,"cultural":<1-5>,"natural":<1-5>}`;
  const raw = await callFn(JUDGE_PROMPT, prompt);
  const match = raw.match(/\{[^}]+\}/);
  if (!match) return { intent: 0, cultural: 0, natural: 0 };
  try {
    const s = JSON.parse(match[0]);
    return { intent: Math.min(5, Math.max(1, s.intent || 0)), cultural: Math.min(5, Math.max(1, s.cultural || 0)), natural: Math.min(5, Math.max(1, s.natural || 0)) };
  } catch { return { intent: 0, cultural: 0, natural: 0 }; }
};

// --- SSE ---
const sseClients = new Set();
const broadcast = (event, data) => {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) { try { res.write(msg); } catch { sseClients.delete(res); } }
};

// --- Main Experiment ---
const runExperiment = async () => {
  const corpus = JSON.parse(readFileSync('data/test-corpus.json', 'utf-8')).slice(0, maxCases);
  broadcast('init', { total: corpus.length, providers: ['MiniMax', 'Dashscope'] });

  const allResults = { minimax: [], dashscope: [] };

  for (const tc of corpus) {
    for (const [providerName, callFn] of [['minimax', callMinimax], ['dashscope', callDashscope]]) {
      try {
        broadcast('status', { id: tc.id, provider: providerName, phase: 'translating' });
        const outputs = await runGroups(tc, callFn);

        broadcast('status', { id: tc.id, provider: providerName, phase: 'scoring' });
        const scoreA = await scoreOutput(tc, outputs.a, callFn);
        const scoreB = await scoreOutput(tc, outputs.b, callFn);
        const scoreC = await scoreOutput(tc, outputs.c, callFn);

        const result = {
          id: tc.id, input: tc.input_text, category: tc.category,
          source: tc.source_culture, target: tc.target_culture,
          group_a: { output: outputs.a, scores: scoreA },
          group_b: { output: outputs.b, scores: scoreB },
          group_c: { output: outputs.c, scores: scoreC }
        };
        allResults[providerName].push(result);
        broadcast('result', { provider: providerName, ...result });
      } catch (err) {
        const errResult = { id: tc.id, input: tc.input_text, error: err.message };
        allResults[providerName].push(errResult);
        broadcast('error', { provider: providerName, id: tc.id, error: err.message });
      }
    }
  }

  // Summary
  const summarize = (results) => {
    const valid = results.filter(r => !r.error);
    const avg = (g, d) => {
      const v = valid.map(r => r[g]?.scores?.[d]).filter(x => x > 0);
      return v.length > 0 ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : 0;
    };
    const ga = { intent: avg('group_a','intent'), cultural: avg('group_a','cultural'), natural: avg('group_a','natural') };
    const gb = { intent: avg('group_b','intent'), cultural: avg('group_b','cultural'), natural: avg('group_b','natural') };
    const gc = { intent: avg('group_c','intent'), cultural: avg('group_c','cultural'), natural: avg('group_c','natural') };
    const dBA = +(gb.cultural - ga.cultural).toFixed(2);
    const dCB = +(gc.cultural - gb.cultural).toFixed(2);
    return { valid: valid.length, errors: results.length - valid.length, group_a: ga, group_b: gb, group_c: gc,
      a05: { result: dBA > 0.5 ? 'CONFIRMED' : 'INCONCLUSIVE', delta: dBA },
      a08: { result: dCB > 0.3 ? 'CONFIRMED' : 'INCONCLUSIVE', delta: dCB } };
  };

  const report = {
    meta: { timestamp: new Date().toISOString(), total_cases: corpus.length },
    minimax: { summary: summarize(allResults.minimax), cases: allResults.minimax },
    dashscope: { summary: summarize(allResults.dashscope), cases: allResults.dashscope }
  };

  mkdirSync('spike/results', { recursive: true });
  writeFileSync('spike/results/full-experiment-report.json', JSON.stringify(report, null, 2));
  broadcast('complete', report);
  console.log('\nExperiment complete. Report: spike/results/full-experiment-report.json');
};

// --- HTML Dashboard ---
const dashboardHtml = readFileSync('spike/experiment-dashboard.html', 'utf-8');

// --- HTTP Server ---
let experimentStarted = false;

const server = createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    // Auto-start experiment when first SSE client connects
    if (!experimentStarted) {
      experimentStarted = true;
      setTimeout(() => {
        runExperiment().catch(err => broadcast('fatal', { error: err.message }));
      }, 500);
    }
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(dashboardHtml);
});

server.listen(PORT, () => {
  console.log(`\n🧪 Chorus Experiment Dashboard: http://localhost:${PORT}`);
  console.log(`   Cases: ${maxCases} | Providers: MiniMax + Dashscope`);
  console.log(`   Experiment auto-starts when page opens.\n`);
});

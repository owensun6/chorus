// Author: Lead
// Chorus Overnight Experiment — 15 language pairs, controlled + dialogue
// Pure log output, no web UI. Reports saved to spike/results/
// Usage: node spike/overnight-run.mjs 2>&1 | tee spike/results/overnight.log

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';

// --- Config ---
const config = JSON.parse(readFileSync('spike/experiment-config.json', 'utf-8'));
const DELAY = config.delay_ms;
const CASES_PER_PAIR = config.cases_per_pair;
const DIALOGUE_ROUNDS = config.dialogue_rounds;
const pairs = config.language_pairs;

const MINIMAX_KEY = 'sk-cp-9p9Xfwsw6UrDtA_kzED5-Ek2LY86c1IhRMRfvfZT5oaMmLTzg6WXXQ57cssu2JpsOwiDyzCDMDMyVop2nQmQYs3gVEyfQDzQyV38aIPrmeDiZLnyqTZRV5M';
const MINIMAX_URL = 'https://api.minimaxi.com/anthropic/v1/messages';
const DASHSCOPE_KEY = 'sk-sp-b8898120678b46dea9bf87b07ef7189b';
const DASHSCOPE_URL = 'https://coding.dashscope.aliyuncs.com/v1/chat/completions';

// --- Utils ---
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toLocaleTimeString('zh-CN', { hour12: false });
const log = (msg) => console.log(`[${ts()}] ${msg}`);
const logErr = (msg) => console.error(`[${ts()}] ERROR: ${msg}`);

// --- LLM Callers ---
const callMinimax = async (system, user) => {
  await sleep(DELAY);
  const res = await fetch(MINIMAX_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': MINIMAX_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'MiniMax-M2.5', system, messages: [{ role: 'user', content: user }], max_tokens: 2048, temperature: 0.3 })
  });
  if (!res.ok) throw new Error(`MiniMax ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const textBlock = data.content.find(c => c.type === 'text');
  if (!textBlock) throw new Error('MiniMax: no text block');
  return textBlock.text;
};

const callDashscope = async (system, user) => {
  await sleep(DELAY);
  const res = await fetch(DASHSCOPE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DASHSCOPE_KEY}` },
    body: JSON.stringify({ model: 'kimi-k2.5', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 2048, temperature: 0.3 })
  });
  if (!res.ok) throw new Error(`Dashscope ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices[0].message.content;
};

// --- Prompts ---
const CHORUS_PROMPT = `你是一个跨文化沟通助手，代表用户与来自不同文化背景的对方进行对话。
核心原则：1. 传达意图而非逐字翻译。2. 适配对方文化的表达习惯和礼仪规范。3. 保留原始的情感基调和沟通目的。`;

const JUDGE_PROMPT = `你是跨文化翻译质量评审专家。按三维度打分(1-5)。只输出JSON，不要解释。
intent(意图保留): 1=完全丢失 3=核心传达但细节丢失 5=完整传达含隐含义
cultural(文化适当性): 1=严重冒犯 3=基本可接受但不自然 5=完全符合目标文化如母语者
natural(自然度): 1=机器翻译痕迹严重 3=基本流畅 5=完全自然`;

// ============================================
// PART 1: Generate test corpus for a language pair
// ============================================
const generateCorpus = async (pair) => {
  const dir = `spike/results/controlled/${pair.id}`;
  const corpusPath = `${dir}/corpus.json`;
  mkdirSync(dir, { recursive: true });

  if (existsSync(corpusPath)) {
    log(`  Corpus exists, skipping generation`);
    return JSON.parse(readFileSync(corpusPath, 'utf-8'));
  }

  log(`  Generating ${CASES_PER_PAIR} test cases...`);
  const half = CASES_PER_PAIR / 2;
  const prompt = `Generate ${CASES_PER_PAIR} test cases for cross-cultural communication between ${pair.a_name} (${pair.a}) and ${pair.b_name} (${pair.b}).

Output a JSON array. Each case:
{"id":<1-${CASES_PER_PAIR}>,"category":"taboo" or "slang","input_text":"<text in source language>","source_culture":"<BCP47>","target_culture":"<BCP47>","context":"<explain the cultural difference in Chinese>"}

Rules:
- First ${half/2} cases: taboo ${pair.a}→${pair.b} (things normal in ${pair.a_name} culture but offensive/inappropriate in ${pair.b_name} culture)
- Next ${half/2} cases: taboo ${pair.b}→${pair.a}
- Next ${half/2} cases: slang/idioms ${pair.a}→${pair.b} (expressions that lose meaning if translated literally)
- Last ${half/2} cases: slang/idioms ${pair.b}→${pair.a}
- input_text for ${pair.b} source cases MUST be in native ${pair.b_name} script
- context field explains WHY this is a cultural challenge (in Chinese)
- Be specific and realistic, not generic

Output ONLY the JSON array, no other text.`;

  const raw = await callMinimax('You are a cultural linguistics expert. Output only valid JSON.', prompt);
  let cases;
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    cases = JSON.parse(match[0]);
  } catch {
    logErr(`  Corpus generation parse failed, using fallback`);
    try {
      const fallbackRaw = execFileSync('claude', ['-p', '--model', 'haiku'], {
        input: prompt, encoding: 'utf-8', timeout: 120000
      });
      const fallbackMatch = fallbackRaw.match(/\[[\s\S]*\]/);
      cases = JSON.parse(fallbackMatch[0]);
    } catch {
      logErr(`  Fallback also failed, using minimal hardcoded corpus`);
      cases = Array.from({ length: CASES_PER_PAIR }, (_, i) => ({
        id: i + 1, category: i % 2 === 0 ? 'taboo' : 'slang',
        input_text: `Test case ${i + 1} for ${pair.a_name} ↔ ${pair.b_name}`,
        source_culture: i < CASES_PER_PAIR / 2 ? pair.a : pair.b,
        target_culture: i < CASES_PER_PAIR / 2 ? pair.b : pair.a,
        context: `Cultural difference between ${pair.a_name} and ${pair.b_name}`
      }));
    }
  }

  // Ensure IDs are sequential
  cases = cases.slice(0, CASES_PER_PAIR).map((c, i) => ({ ...c, id: i + 1 }));
  writeFileSync(corpusPath, JSON.stringify(cases, null, 2));
  log(`  Generated ${cases.length} cases`);
  return cases;
};

// ============================================
// PART 2: Controlled experiment for a language pair
// ============================================
const langName = (code) => {
  const map = { 'zh-CN': '中文', 'ja': '日语', 'ko': '韩语', 'en-US': '英语', 'ar': '阿拉伯语', 'fr': '法语', 'de': '德语', 'es': '西班牙语', 'pt-BR': '葡萄牙语', 'ru': '俄语', 'hi': '印地语' };
  return map[code] || code;
};

const runControlled = async (pair, corpus, callFn, providerName) => {
  const results = [];
  for (const tc of corpus) {
    try {
      // Group A: mechanical translation
      const outA = await callFn('你是一个翻译助手。', `请将以下内容翻译成${langName(tc.target_culture)}，只输出翻译结果：\n${tc.input_text}`);

      // Group B: minimal envelope + prompt
      const outB = await callFn(CHORUS_PROMPT, `对方文化: ${tc.source_culture}\n对方原始语义: ${tc.input_text}\n\n请用${langName(tc.target_culture)}向你的用户呈现这条消息。只输出适配结果。`);

      // Group C: full envelope + prompt
      const outC = await callFn(CHORUS_PROMPT, `对方文化: ${tc.source_culture}\n对方原始语义: ${tc.input_text}\n意图类型: ${tc.category === 'taboo' ? 'information' : 'chitchat'}\n情感基调: neutral\n正式度: semi-formal\n文化背景说明: ${tc.context}\n\n请用${langName(tc.target_culture)}向你的用户呈现这条消息。只输出适配结果。`);

      // Judge each
      const judge = async (output) => {
        const raw = await callFn(JUDGE_PROMPT, `原文: ${tc.input_text}\n原文文化: ${tc.source_culture}\n目标文化: ${tc.target_culture}\n文化背景: ${tc.context}\n翻译输出: ${output}\n\n只输出: {"intent":<1-5>,"cultural":<1-5>,"natural":<1-5>}`);
        const match = raw.match(/\{[^}]+\}/);
        if (!match) return { intent: 0, cultural: 0, natural: 0 };
        try {
          const s = JSON.parse(match[0]);
          return { intent: Math.min(5, Math.max(1, s.intent||0)), cultural: Math.min(5, Math.max(1, s.cultural||0)), natural: Math.min(5, Math.max(1, s.natural||0)) };
        } catch { return { intent: 0, cultural: 0, natural: 0 }; }
      };

      const scoreA = await judge(outA);
      const scoreB = await judge(outB);
      const scoreC = await judge(outC);

      results.push({ id: tc.id, category: tc.category, input: tc.input_text,
        group_a: { output: outA, scores: scoreA },
        group_b: { output: outB, scores: scoreB },
        group_c: { output: outC, scores: scoreC }
      });

      log(`    [${providerName}] #${tc.id} A=${scoreA.cultural} B=${scoreB.cultural} C=${scoreC.cultural}`);
    } catch (err) {
      results.push({ id: tc.id, input: tc.input_text, error: err.message });
      logErr(`    [${providerName}] #${tc.id}: ${err.message.slice(0, 80)}`);
    }
  }
  return results;
};

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

// ============================================
// PART 3: Dialogue simulation for a language pair
// ============================================
const runDialogue = async (pair) => {
  const dir = `spike/results/dialogues/${pair.id}`;
  mkdirSync(dir, { recursive: true });
  log(`  Dialogue: ${pair.persona_a} ↔ ${pair.persona_b} (${pair.scene})`);

  const systemA = `你是${pair.persona_a}的AI助手。代替ta与一个${pair.b_name}朋友的AI助手对话。场景：${pair.scene}。
回复规则：1. 先用[适配]标记呈现给你用户看的翻译 2. 再用[回复]标记你用户想说的话 3. 最后用[信封]标记JSON信封{"original_semantic":"...","sender_culture":"${pair.a}","intent_type":"...","emotional_tone":"..."}
只输出这三块，不要多余解释。对话要自然推进。`;

  const systemB = `你是${pair.persona_b}的AI助手。代替ta与一个${pair.a_name}朋友的AI助手对话。场景：${pair.scene}。
回复规则：1. 先用[适配]标记呈现给你用户看的翻译 2. 再用[回复]标记你用户想说的话 3. 最后用[信封]标记JSON信封{"original_semantic":"...","sender_culture":"${pair.b}","intent_type":"...","emotional_tone":"..."}
只输出这三块，不要多余解释。对话要自然推进。`;

  const parseDialogueReply = (raw) => {
    const adapted = raw.match(/\[适配\]\s*\n?([\s\S]*?)(?=\[回复\]|$)/)?.[1]?.trim() || '';
    const reply = raw.match(/\[回复\]\s*\n?([\s\S]*?)(?=\[信封\]|$)/)?.[1]?.trim() || raw.trim();
    const envMatch = raw.match(/\[信封\]\s*\n?\s*(\{[\s\S]*?\})/);
    const envelope = envMatch ? (() => { try { return JSON.parse(envMatch[1]); } catch { return null; } })() : null;
    return { adapted, reply, envelope, raw };
  };

  const transcript = [];
  let currentMsg = `你好！我是${pair.persona_a.split('，')[0]}。${pair.scene}。很高兴认识你！`;
  let currentEnvelope = { original_semantic: '初次见面问候', sender_culture: pair.a, intent_type: 'greeting', emotional_tone: 'enthusiastic' };

  transcript.push({ round: 0, speaker: 'A', text: currentMsg, envelope: currentEnvelope });
  log(`    [R0] A: ${currentMsg.slice(0, 50)}...`);

  for (let round = 1; round <= DIALOGUE_ROUNDS; round++) {
    try {
      // B receives A's message
      const bPrompt = `对方Agent发来的信封: ${JSON.stringify(currentEnvelope)}\n对方原文: ${currentMsg}\n${transcript.length > 2 ? '之前摘要: ' + transcript.slice(-3).map(t => t.speaker + ': ' + t.text.slice(0, 40)).join(' → ') : ''}`;
      const bRaw = await callDashscope(systemB, bPrompt);
      const bParsed = parseDialogueReply(bRaw);
      transcript.push({ round, speaker: 'B', text: bParsed.reply, adapted: bParsed.adapted, envelope: bParsed.envelope, raw: bParsed.raw });
      log(`    [R${round}] B: ${bParsed.reply.slice(0, 50)}...`);

      if (round >= DIALOGUE_ROUNDS) break;

      // A receives B's reply
      const aPrompt = `对方Agent发来的信封: ${JSON.stringify(bParsed.envelope)}\n对方原文: ${bParsed.reply}\n${transcript.length > 2 ? '之前摘要: ' + transcript.slice(-3).map(t => t.speaker + ': ' + t.text.slice(0, 40)).join(' → ') : ''}`;
      const aRaw = await callMinimax(systemA, aPrompt);
      const aParsed = parseDialogueReply(aRaw);
      transcript.push({ round, speaker: 'A', text: aParsed.reply, adapted: aParsed.adapted, envelope: aParsed.envelope, raw: aParsed.raw });
      log(`    [R${round}] A: ${aParsed.reply.slice(0, 50)}...`);

      currentMsg = aParsed.reply;
      currentEnvelope = aParsed.envelope || currentEnvelope;
    } catch (err) {
      logErr(`    [R${round}] ${err.message.slice(0, 80)}`);
      transcript.push({ round, speaker: '?', error: err.message });
    }
  }

  // Save transcript
  writeFileSync(`${dir}/transcript.json`, JSON.stringify(transcript, null, 2));

  // Save readable version
  let md = `<!-- Author: Lead -->\n# Dialogue: ${pair.a_name} ↔ ${pair.b_name}\n\n`;
  md += `**${pair.persona_a}** (via MiniMax) ↔ **${pair.persona_b}** (via Dashscope)\n`;
  md += `**场景**: ${pair.scene}\n\n---\n\n`;
  for (const t of transcript) {
    if (t.error) { md += `> ⚠️ Round ${t.round} error: ${t.error}\n\n`; continue; }
    const icon = t.speaker === 'A' ? '🅰️' : '🅱️';
    md += `### ${icon} ${t.speaker === 'A' ? pair.persona_a.split('，')[0] : pair.persona_b.split('，')[0]} (Round ${t.round})\n\n`;
    md += `**原文**: ${t.text}\n\n`;
    if (t.adapted) md += `**对方看到**: ${t.adapted}\n\n`;
    if (t.envelope) md += `**信封**: \`${JSON.stringify(t.envelope)}\`\n\n`;
    md += `---\n\n`;
  }
  writeFileSync(`${dir}/transcript.md`, md);
  log(`  Dialogue saved: ${dir}/transcript.md`);
};

// ============================================
// PART 4: Summary report for a language pair
// ============================================
const writeSummary = (pair, mmResults, dsResults) => {
  const dir = `spike/results/controlled/${pair.id}`;
  const mmSummary = summarize(mmResults);
  const dsSummary = summarize(dsResults);

  const report = { pair: pair.id, a: pair.a, b: pair.b, minimax: { summary: mmSummary, cases: mmResults }, dashscope: { summary: dsSummary, cases: dsResults } };
  writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));

  let md = `<!-- Author: Lead -->\n# ${pair.a_name} ↔ ${pair.b_name} — Experiment Summary\n\n`;
  md += `| 维度 | | MiniMax A | MiniMax B | MiniMax C | | Dashscope A | Dashscope B | Dashscope C |\n`;
  md += `|------|--|:-:|:-:|:-:|--|:-:|:-:|:-:|\n`;
  for (const dim of ['intent', 'cultural', 'natural']) {
    md += `| ${dim} | | ${mmSummary.group_a[dim]} | ${mmSummary.group_b[dim]} | ${mmSummary.group_c[dim]} | | ${dsSummary.group_a[dim]} | ${dsSummary.group_b[dim]} | ${dsSummary.group_c[dim]} |\n`;
  }
  md += `\n### 假设验证\n\n`;
  md += `| 假设 | MiniMax | Dashscope |\n|------|---------|----------|\n`;
  md += `| A-05 (提示词) | ${mmSummary.a05.result} (${mmSummary.a05.delta > 0 ? '+' : ''}${mmSummary.a05.delta}) | ${dsSummary.a05.result} (${dsSummary.a05.delta > 0 ? '+' : ''}${dsSummary.a05.delta}) |\n`;
  md += `| A-08 (结构化) | ${mmSummary.a08.result} (${mmSummary.a08.delta > 0 ? '+' : ''}${mmSummary.a08.delta}) | ${dsSummary.a08.result} (${dsSummary.a08.delta > 0 ? '+' : ''}${dsSummary.a08.delta}) |\n`;

  // Best/worst cases
  const allValid = [...mmResults, ...dsResults].filter(r => !r.error);
  const withDelta = allValid.map(r => ({ ...r, delta: (r.group_c?.scores?.cultural || 0) - (r.group_a?.scores?.cultural || 0) }));
  withDelta.sort((a, b) => b.delta - a.delta);
  md += `\n### 提升最大的案例\n\n`;
  for (const c of withDelta.slice(0, 3)) {
    md += `- **#${c.id}** (${c.category}): "${c.input.slice(0, 40)}..." A=${c.group_a?.scores?.cultural} → C=${c.group_c?.scores?.cultural} (+${c.delta})\n`;
  }

  writeFileSync(`${dir}/summary.md`, md);
  return { pair: pair.id, minimax: mmSummary, dashscope: dsSummary };
};

// ============================================
// MAIN
// ============================================
const main = async () => {
  log('========================================');
  log('Chorus Overnight Experiment — START');
  log(`${pairs.length} language pairs × ${CASES_PER_PAIR} cases × 2 providers`);
  log(`Delay: ${DELAY}ms between calls`);
  log('========================================\n');

  mkdirSync('spike/results/controlled', { recursive: true });
  mkdirSync('spike/results/dialogues', { recursive: true });

  const overallResults = [];

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    log(`\n[${ i + 1}/${pairs.length}] === ${pair.a_name} ↔ ${pair.b_name} (${pair.id}) ===`);

    // Skip if already completed
    const reportPath = `spike/results/controlled/${pair.id}/report.json`;
    if (existsSync(reportPath)) {
      log(`  Already completed, skipping`);
      const existing = JSON.parse(readFileSync(reportPath, 'utf-8'));
      overallResults.push({ pair: pair.id, minimax: existing.minimax.summary, dashscope: existing.dashscope.summary });
      continue;
    }

    // Step 1: Generate corpus
    const corpus = await generateCorpus(pair);

    // Step 2: Controlled experiment — MiniMax
    log(`  Controlled experiment — MiniMax (${corpus.length} cases)...`);
    const mmResults = await runControlled(pair, corpus, callMinimax, 'MiniMax');

    // Step 3: Controlled experiment — Dashscope
    log(`  Controlled experiment — Dashscope (${corpus.length} cases)...`);
    const dsResults = await runControlled(pair, corpus, callDashscope, 'Dashscope');

    // Step 4: Summary
    const summary = writeSummary(pair, mmResults, dsResults);
    overallResults.push(summary);
    log(`  MiniMax A-05: ${summary.minimax.a05.result} | A-08: ${summary.minimax.a08.result}`);
    log(`  Dashscope A-05: ${summary.dashscope.a05.result} | A-08: ${summary.dashscope.a08.result}`);

    // Step 5: Dialogue simulation
    log(`  Starting dialogue simulation...`);
    await runDialogue(pair);

    log(`  === ${pair.id} DONE ===`);
  }

  // Overall report
  log('\n========================================');
  log('GENERATING OVERALL REPORT');
  log('========================================\n');

  let overview = `<!-- Author: Lead -->\n# Chorus Protocol — 跨语言实验总报告\n\n`;
  overview += `> 日期: ${new Date().toISOString().slice(0, 10)} | ${pairs.length} 语言对 | Provider: MiniMax + Dashscope\n\n`;
  overview += `## 汇总对比\n\n`;
  overview += `| 语言对 | MM A-05 | MM A-08 | DS A-05 | DS A-08 | MM 文化(A→C) | DS 文化(A→C) |\n`;
  overview += `|--------|---------|---------|---------|---------|-------------|-------------|\n`;
  for (const r of overallResults) {
    overview += `| ${r.pair} | ${r.minimax.a05.result}(${r.minimax.a05.delta > 0 ? '+' : ''}${r.minimax.a05.delta}) | ${r.minimax.a08.result}(${r.minimax.a08.delta > 0 ? '+' : ''}${r.minimax.a08.delta}) | ${r.dashscope.a05.result}(${r.dashscope.a05.delta > 0 ? '+' : ''}${r.dashscope.a05.delta}) | ${r.dashscope.a08.result}(${r.dashscope.a08.delta > 0 ? '+' : ''}${r.dashscope.a08.delta}) | ${r.minimax.group_a.cultural}→${r.minimax.group_c.cultural} | ${r.dashscope.group_a.cultural}→${r.dashscope.group_c.cultural} |\n`;
  }

  const a05Confirmed = overallResults.filter(r => r.minimax.a05.result === 'CONFIRMED' || r.dashscope.a05.result === 'CONFIRMED').length;
  const a08Confirmed = overallResults.filter(r => r.minimax.a08.result === 'CONFIRMED' || r.dashscope.a08.result === 'CONFIRMED').length;

  overview += `\n## 结论\n\n`;
  overview += `- **A-05 (提示词有效)**: ${a05Confirmed}/${pairs.length} 语言对确认 (${(a05Confirmed/pairs.length*100).toFixed(0)}%)\n`;
  overview += `- **A-08 (结构化增值)**: ${a08Confirmed}/${pairs.length} 语言对确认 (${(a08Confirmed/pairs.length*100).toFixed(0)}%)\n`;

  writeFileSync('spike/results/overview-report.md', overview);
  writeFileSync('spike/results/overview-data.json', JSON.stringify(overallResults, null, 2));

  log('\n========================================');
  log('ALL EXPERIMENTS COMPLETE');
  log(`A-05 confirmed: ${a05Confirmed}/${pairs.length}`);
  log(`A-08 confirmed: ${a08Confirmed}/${pairs.length}`);
  log('Reports: spike/results/overview-report.md');
  log('========================================');
};

main().catch(err => { logErr(`FATAL: ${err.message}`); process.exit(1); });

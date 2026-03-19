// Author: Lead
// Chorus Protocol Phase 0 — Hypothesis Spike
// Uses `claude -p` as LLM backend via execFileSync (safe, no shell injection)
// Usage: node spike/run-spike.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';

// --- LLM Call via claude -p (using execFileSync for safety) ---
const callClaude = (prompt) => {
  const result = execFileSync('claude', ['-p', '--model', 'sonnet'], {
    input: prompt,
    encoding: 'utf-8',
    timeout: 60000,
    maxBuffer: 1024 * 1024
  });
  return result.trim();
};

// --- Prompt Templates ---
const CHORUS_PROMPT = `你是一个跨文化沟通助手，代表用户与来自不同文化背景的对方进行对话。
核心原则：1. 传达意图而非逐字翻译。2. 适配对方文化的表达习惯和礼仪规范。3. 保留原始的情感基调和沟通目的。`;

const JUDGE_SYSTEM = `你是跨文化翻译质量评审专家。按三维度打分(1-5)。只输出JSON。
intent(意图保留): 1=完全丢失 3=核心传达但细节丢失 5=完整传达含隐含义
cultural(文化适当性): 1=严重冒犯 3=基本可接受但不自然 5=完全符合目标文化如母语者
natural(自然度): 1=机器翻译痕迹严重 3=基本流畅 5=完全自然`;

// --- Three Groups ---
const targetLang = (c) => c === 'ja' ? '日语' : '中文';

const groupA = (tc) => callClaude(
  `请将以下内容翻译成${targetLang(tc.target_culture)}，只输出翻译结果，不要解释：\n${tc.input_text}`
);

const groupB = (tc) => callClaude(
  `${CHORUS_PROMPT}\n\n对方文化: ${tc.source_culture}\n对方原始语义: ${tc.input_text}\n\n请用${targetLang(tc.target_culture)}向你的用户呈现这条消息。只输出适配结果。`
);

const groupC = (tc) => callClaude(
  `${CHORUS_PROMPT}\n\n对方文化: ${tc.source_culture}\n对方原始语义: ${tc.input_text}\n意图类型: ${tc.category === 'taboo' ? 'information' : 'chitchat'}\n情感基调: neutral\n正式度: semi-formal\n文化背景说明: ${tc.context}\n\n请用${targetLang(tc.target_culture)}向你的用户呈现这条消息。只输出适配结果。`
);

// --- Judge ---
const judge = (tc, output) => {
  const raw = callClaude(
    `${JUDGE_SYSTEM}\n\n原文: ${tc.input_text}\n原文文化: ${tc.source_culture}\n目标文化: ${tc.target_culture}\n文化背景: ${tc.context}\n翻译输出: ${output}\n\n只输出: {"intent":<1-5>,"cultural":<1-5>,"natural":<1-5>}`
  );
  const match = raw.match(/\{[^}]+\}/);
  if (!match) { console.log(`  Judge parse fail: ${raw.slice(0, 80)}`); return { intent: 0, cultural: 0, natural: 0 }; }
  try {
    const s = JSON.parse(match[0]);
    return {
      intent: Math.min(5, Math.max(1, s.intent || 0)),
      cultural: Math.min(5, Math.max(1, s.cultural || 0)),
      natural: Math.min(5, Math.max(1, s.natural || 0))
    };
  } catch { return { intent: 0, cultural: 0, natural: 0 }; }
};

// --- Main ---
const cases = JSON.parse(readFileSync('spike/test-cases.json', 'utf-8'));
const results = [];

console.log(`\n=== Chorus Spike: ${cases.length} cases × 3 groups ===\n`);

for (const tc of cases) {
  process.stdout.write(`[${tc.id}/${cases.length}] ${tc.input_text.slice(0, 25)}...`);
  try {
    const outA = groupA(tc);
    const outB = groupB(tc);
    const outC = groupC(tc);
    const scoreA = judge(tc, outA);
    const scoreB = judge(tc, outB);
    const scoreC = judge(tc, outC);

    results.push({
      id: tc.id, input: tc.input_text, category: tc.category,
      group_a: { output: outA, scores: scoreA },
      group_b: { output: outB, scores: scoreB },
      group_c: { output: outC, scores: scoreC }
    });
    console.log(` A=${scoreA.cultural} B=${scoreB.cultural} C=${scoreC.cultural}`);
  } catch (err) {
    console.log(` ERROR: ${err.message.slice(0, 60)}`);
    results.push({ id: tc.id, input: tc.input_text, error: err.message });
  }
}

// --- Summary ---
const valid = results.filter(r => !r.error);
const avg = (g, d) => {
  const v = valid.map(r => r[g].scores[d]).filter(x => x > 0);
  return v.length > 0 ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : '0';
};

const summary = {
  total: cases.length, valid: valid.length, errors: results.length - valid.length,
  group_a: { intent: avg('group_a','intent'), cultural: avg('group_a','cultural'), natural: avg('group_a','natural') },
  group_b: { intent: avg('group_b','intent'), cultural: avg('group_b','cultural'), natural: avg('group_b','natural') },
  group_c: { intent: avg('group_c','intent'), cultural: avg('group_c','cultural'), natural: avg('group_c','natural') },
};

const dBA = (parseFloat(summary.group_b.cultural) - parseFloat(summary.group_a.cultural)).toFixed(2);
const dCB = (parseFloat(summary.group_c.cultural) - parseFloat(summary.group_b.cultural)).toFixed(2);
summary.a05 = `${parseFloat(dBA) > 0.5 ? 'CONFIRMED' : 'INCONCLUSIVE'} (B-A = ${dBA})`;
summary.a08 = `${parseFloat(dCB) > 0.3 ? 'CONFIRMED' : 'INCONCLUSIVE'} (C-B = ${dCB})`;

console.log('\n=== RESULTS ===\n');
console.log('Group A (mechanical):    ', summary.group_a);
console.log('Group B (minimal+prompt):', summary.group_b);
console.log('Group C (full+prompt):   ', summary.group_c);
console.log(`\nA-05 (prompt helps):     ${summary.a05}`);
console.log(`A-08 (structure helps):  ${summary.a08}`);

console.log('\n=== DETAIL (cultural dimension) ===\n');
console.log('ID | Category |  A  |  B  |  C  | B-A | C-B');
console.log('---|----------|-----|-----|-----|-----|----');
for (const r of valid) {
  const a = r.group_a.scores.cultural, b = r.group_b.scores.cultural, c = r.group_c.scores.cultural;
  console.log(`${String(r.id).padStart(2)} | ${r.category.padEnd(8)} |  ${a}  |  ${b}  |  ${c}  | ${b-a>=0?'+':''}${b-a}  | ${c-b>=0?'+':''}${c-b}`);
}

mkdirSync('spike/results', { recursive: true });
writeFileSync('spike/results/spike-report.json', JSON.stringify({ summary, cases: results }, null, 2));
console.log('\nReport saved: spike/results/spike-report.json');

// Author: be-ai-integrator
import { execFileSync } from 'child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreParams {
  readonly input_text: string;
  readonly output_text: string;
  readonly source_culture: string;
  readonly target_culture: string;
  readonly context: string;
}

export interface Scores {
  readonly intent: number;
  readonly cultural: number;
  readonly natural: number;
  readonly error: boolean;
}

export interface ConsistencyResult {
  readonly kappa_intent: number;
  readonly kappa_cultural: number;
  readonly kappa_natural: number;
  readonly is_reliable: boolean;
}

// ---------------------------------------------------------------------------
// Judge rubric prompt (from INTERFACE.md chorus-judge-rubric, inlined)
// ---------------------------------------------------------------------------

const JUDGE_RUBRIC_TEMPLATE = `你是一个跨文化翻译质量评审专家。你将看到一段原文和一段翻译输出。
请根据以下三个维度打分（1-5 分）。只输出 JSON，不要解释。

## 维度定义

**意图保留 (intent)**: 翻译是否准确传达了原文的沟通目的？
- 1分: 意图完全丢失或扭曲
- 2分: 意图部分传达，有重大遗漏
- 3分: 核心意图传达，但细微差别丢失
- 4分: 意图准确传达，含大部分细微差别
- 5分: 意图完整传达，包括所有隐含含义

**文化适当性 (cultural)**: 翻译是否符合目标文化的表达习惯？
- 1分: 严重冒犯或完全不合文化规范
- 2分: 存在明显文化不当之处
- 3分: 基本可接受，但不自然
- 4分: 符合文化规范，偶有生硬
- 5分: 完全符合目标文化习惯，如母语者所写

**自然度 (natural)**: 翻译读起来是否自然流畅？
- 1分: 机器翻译痕迹严重，难以理解
- 2分: 能理解但明显不自然
- 3分: 基本流畅，偶有不自然
- 4分: 流畅自然，接近母语水平
- 5分: 完全自然，无翻译痕迹

## 输入
原文: {input_text}
原文文化: {source_culture}
目标文化: {target_culture}
文化背景: {context}
翻译输出: {output_text}

## 输出格式
{"intent": <1-5>, "cultural": <1-5>, "natural": <1-5>}`;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MIN_SCORE = 1;
const MAX_SCORE = 5;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Build the judge prompt with concrete values. BLIND: no group labels.
 */
const buildPrompt = (params: ScoreParams): string =>
  JUDGE_RUBRIC_TEMPLATE
    .replace('{input_text}', params.input_text)
    .replace('{source_culture}', params.source_culture)
    .replace('{target_culture}', params.target_culture)
    .replace('{context}', params.context)
    .replace('{output_text}', params.output_text);

/**
 * Call the LLM via the Claude CLI (execFileSync).
 * Returns raw string output.
 */
const callLLM = (prompt: string): string => {
  const result = execFileSync('claude', ['-p', '--model', 'sonnet'], {
    input: prompt,
    encoding: 'utf-8',
    timeout: 60_000,
  });
  return typeof result === 'string' ? result : String(result);
};

/**
 * Extract JSON from LLM output that may be wrapped in markdown code fences.
 */
const extractJSON = (raw: string): string => {
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return raw.trim();
};

/**
 * Attempt to parse and validate a scores response from the LLM.
 * Returns null if parsing or validation fails.
 */
const parseScores = (raw: string): Scores | null => {
  try {
    const cleaned = extractJSON(raw);
    const parsed: unknown = JSON.parse(cleaned);

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const obj = parsed as Record<string, unknown>;

    if (
      typeof obj.intent !== 'number' ||
      typeof obj.cultural !== 'number' ||
      typeof obj.natural !== 'number'
    ) {
      return null;
    }

    return {
      intent: clamp(obj.intent, MIN_SCORE, MAX_SCORE),
      cultural: clamp(obj.cultural, MIN_SCORE, MAX_SCORE),
      natural: clamp(obj.natural, MIN_SCORE, MAX_SCORE),
      error: false,
    };
  } catch {
    return null;
  }
};

const ERROR_SCORES: Scores = {
  intent: 0,
  cultural: 0,
  natural: 0,
  error: true,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a single translation output using LLM-as-Judge.
 * Retries once on parse failure. Returns zero scores with error flag
 * if both attempts fail.
 */
export const scoreOutput = async (params: ScoreParams): Promise<Scores> => {
  const prompt = buildPrompt(params);
  const MAX_ATTEMPTS = 2;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const raw = callLLM(prompt);
      const scores = parseScores(raw);
      if (scores !== null) {
        return scores;
      }
    } catch {
      // LLM call failed (timeout, process error, etc.) — will retry
    }
  }

  return ERROR_SCORES;
};

/**
 * Validate scoring consistency by double-scoring a sample of cases
 * and computing weighted Cohen's Kappa for each dimension.
 */
export const validateConsistency = async (
  cases: readonly ScoreParams[],
  scoreFn: typeof scoreOutput,
): Promise<ConsistencyResult> => {
  const sampleSize = Math.min(cases.length, 20);
  const sample = shuffleAndTake(cases, sampleSize);

  const firstPass: Scores[] = [];
  const secondPass: Scores[] = [];

  for (const c of sample) {
    firstPass.push(await scoreFn(c));
  }
  for (const c of sample) {
    secondPass.push(await scoreFn(c));
  }

  const kappa_intent = computeWeightedKappa(
    firstPass.map((s) => s.intent),
    secondPass.map((s) => s.intent),
  );
  const kappa_cultural = computeWeightedKappa(
    firstPass.map((s) => s.cultural),
    secondPass.map((s) => s.cultural),
  );
  const kappa_natural = computeWeightedKappa(
    firstPass.map((s) => s.natural),
    secondPass.map((s) => s.natural),
  );

  const RELIABILITY_THRESHOLD = 0.6;

  return {
    kappa_intent,
    kappa_cultural,
    kappa_natural,
    is_reliable:
      kappa_intent >= RELIABILITY_THRESHOLD &&
      kappa_cultural >= RELIABILITY_THRESHOLD &&
      kappa_natural >= RELIABILITY_THRESHOLD,
  };
};

// ---------------------------------------------------------------------------
// Kappa & sampling helpers
// ---------------------------------------------------------------------------

/**
 * Randomly select `n` items from `items` without mutation.
 * Uses Fisher-Yates on a copy.
 */
const shuffleAndTake = <T>(items: readonly T[], n: number): readonly T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
};

/**
 * Compute weighted Cohen's Kappa.
 *
 * Agreement weight:
 *   - exact match  -> 1.0
 *   - differ by 1  -> 0.5
 *   - differ by 2+ -> 0.0
 *
 * kappa = (po - pe) / (1 - pe)
 *
 * pe is the expected weighted agreement by chance based on
 * marginal frequency distributions of both raters.
 */
const computeWeightedKappa = (
  ratingsA: readonly number[],
  ratingsB: readonly number[],
): number => {
  const n = ratingsA.length;
  if (n === 0) return 0;

  // Collect all unique score categories across both raters
  const categorySet = new Set<number>();
  for (const v of ratingsA) categorySet.add(v);
  for (const v of ratingsB) categorySet.add(v);
  const categories = [...categorySet].sort((a, b) => a - b);

  // Observed weighted agreement (po)
  let po = 0;
  for (let i = 0; i < n; i++) {
    const diff = Math.abs(ratingsA[i] - ratingsB[i]);
    if (diff === 0) {
      po += 1.0;
    } else if (diff === 1) {
      po += 0.5;
    }
    // diff >= 2 contributes 0
  }
  po /= n;

  // Marginal distributions
  const freqA = new Map<number, number>();
  const freqB = new Map<number, number>();
  for (const c of categories) {
    freqA.set(c, 0);
    freqB.set(c, 0);
  }
  for (const v of ratingsA) freqA.set(v, (freqA.get(v) ?? 0) + 1);
  for (const v of ratingsB) freqB.set(v, (freqB.get(v) ?? 0) + 1);

  // Expected weighted agreement by chance (pe)
  let pe = 0;
  for (const ci of categories) {
    for (const cj of categories) {
      const diff = Math.abs(ci - cj);
      const weight = diff === 0 ? 1.0 : diff === 1 ? 0.5 : 0.0;
      const pAi = (freqA.get(ci) ?? 0) / n;
      const pBj = (freqB.get(cj) ?? 0) / n;
      pe += weight * pAi * pBj;
    }
  }

  // Guard against division by zero (pe === 1 means perfect chance agreement)
  if (pe >= 1) return 1;

  return (po - pe) / (1 - pe);
};

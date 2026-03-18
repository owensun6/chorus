// Author: be-domain-modeler
import * as fs from 'fs';
import { callLLM, extractSemantic, adaptMessage } from './agent';
import { scoreOutput } from './judge';
import { createEnvelope } from './envelope';
import type { ChorusEnvelope } from './schemas/envelope';
import type { Scores } from './judge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CorpusCase {
  readonly id: number;
  readonly category: string;
  readonly input_text: string;
  readonly source_culture: string;
  readonly target_culture: string;
  readonly context: string;
}

interface RunOptions {
  readonly corpusPath: string;
  readonly outputPath: string;
  readonly singleId?: number;
}

interface GroupScores {
  readonly intent_avg: number;
  readonly cultural_avg: number;
  readonly natural_avg: number;
}

interface HypothesisResult {
  readonly result: string;
  readonly delta: number;
}

interface ValidationReport {
  readonly meta: {
    readonly timestamp: string;
    readonly total_cases: number;
    readonly judge_kappa?: number;
  };
  readonly summary: {
    readonly group_a: GroupScores;
    readonly group_b: GroupScores;
    readonly group_c: GroupScores;
    readonly hypothesis_a05: HypothesisResult;
    readonly hypothesis_a08: HypothesisResult;
  };
  readonly cases: readonly CaseResult[];
}

interface CaseResult {
  readonly id: number;
  readonly category: string;
  readonly group_a: CaseGroupResult;
  readonly group_b: CaseGroupResult;
  readonly group_c: CaseGroupResult;
}

interface CaseGroupResult {
  readonly output: string;
  readonly scores: Scores;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Target language map (BCP47 → natural name for baseline prompt)
// ---------------------------------------------------------------------------

const LANGUAGE_NAMES: Record<string, string> = {
  'zh-CN': '中文',
  'zh': '中文',
  'ja': '日语',
  'en': '英语',
  'en-US': '英语',
  'en-GB': '英语',
  'ko': '韩语',
  'pt-BR': '葡萄牙语',
  'fr': '法语',
  'de': '德语',
  'es': '西班牙语',
};

const getLanguageName = (culture: string): string =>
  LANGUAGE_NAMES[culture] ?? culture;

// ---------------------------------------------------------------------------
// Group runners
// ---------------------------------------------------------------------------

const runGroupA = async (c: CorpusCase): Promise<CaseGroupResult> => {
  try {
    const targetLang = getLanguageName(c.target_culture);
    const prompt = `请将以下内容翻译成${targetLang}，只输出翻译结果：\n${c.input_text}`;
    const output = callLLM(prompt);
    const scores = await scoreOutput({
      input_text: c.input_text,
      output_text: output,
      source_culture: c.source_culture,
      target_culture: c.target_culture,
      context: c.context,
    });
    return { output, scores };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      output: '',
      scores: { intent: 0, cultural: 0, natural: 0, error: true },
      error: message,
    };
  }
};

const runGroupB = async (c: CorpusCase): Promise<CaseGroupResult> => {
  try {
    const envelope: ChorusEnvelope = createEnvelope({
      original_semantic: c.input_text,
      sender_culture: c.source_culture,
    });
    const output = await adaptMessage(envelope, c.target_culture);
    const scores = await scoreOutput({
      input_text: c.input_text,
      output_text: output,
      source_culture: c.source_culture,
      target_culture: c.target_culture,
      context: c.context,
    });
    return { output, scores };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      output: '',
      scores: { intent: 0, cultural: 0, natural: 0, error: true },
      error: message,
    };
  }
};

const runGroupC = async (c: CorpusCase): Promise<CaseGroupResult> => {
  try {
    const semantic = await extractSemantic(c.input_text, c.source_culture);
    const envelope: ChorusEnvelope = createEnvelope({
      original_semantic: semantic.original_semantic,
      sender_culture: c.source_culture,
      intent_type: semantic.intent_type,
      formality: semantic.formality,
      emotional_tone: semantic.emotional_tone,
    });
    const output = await adaptMessage(envelope, c.target_culture);
    const scores = await scoreOutput({
      input_text: c.input_text,
      output_text: output,
      source_culture: c.source_culture,
      target_culture: c.target_culture,
      context: c.context,
    });
    return { output, scores };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      output: '',
      scores: { intent: 0, cultural: 0, natural: 0, error: true },
      error: message,
    };
  }
};

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

const computeGroupAvg = (results: readonly CaseGroupResult[]): GroupScores => {
  const valid = results.filter((r) => !r.scores.error);
  const count = valid.length;

  if (count === 0) {
    return { intent_avg: 0, cultural_avg: 0, natural_avg: 0 };
  }

  const sumIntent = valid.reduce((s, r) => s + r.scores.intent, 0);
  const sumCultural = valid.reduce((s, r) => s + r.scores.cultural, 0);
  const sumNatural = valid.reduce((s, r) => s + r.scores.natural, 0);

  return {
    intent_avg: Math.round((sumIntent / count) * 100) / 100,
    cultural_avg: Math.round((sumCultural / count) * 100) / 100,
    natural_avg: Math.round((sumNatural / count) * 100) / 100,
  };
};

const computeOverallAvg = (group: GroupScores): number =>
  Math.round(
    ((group.intent_avg + group.cultural_avg + group.natural_avg) / 3) * 100,
  ) / 100;

const determineHypothesis = (
  deltaValue: number,
  threshold: number,
): HypothesisResult => {
  const result = deltaValue >= threshold ? 'CONFIRMED' : 'INCONCLUSIVE';
  return {
    result,
    delta: Math.round(deltaValue * 100) / 100,
  };
};

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

const runValidation = async (options: RunOptions): Promise<ValidationReport> => {
  const rawCorpus = fs.readFileSync(options.corpusPath, 'utf-8');
  const corpus: CorpusCase[] = JSON.parse(rawCorpus);

  const cases = options.singleId !== undefined
    ? corpus.filter((c) => c.id === options.singleId)
    : corpus;

  const caseResults: CaseResult[] = [];

  for (const c of cases) {
    const groupA = await runGroupA(c);
    const groupB = await runGroupB(c);
    const groupC = await runGroupC(c);

    caseResults.push({
      id: c.id,
      category: c.category,
      group_a: groupA,
      group_b: groupB,
      group_c: groupC,
    });
  }

  const allA = caseResults.map((r) => r.group_a);
  const allB = caseResults.map((r) => r.group_b);
  const allC = caseResults.map((r) => r.group_c);

  const avgA = computeGroupAvg(allA);
  const avgB = computeGroupAvg(allB);
  const avgC = computeGroupAvg(allC);

  const overallA = computeOverallAvg(avgA);
  const overallB = computeOverallAvg(avgB);
  const overallC = computeOverallAvg(avgC);

  const report: ValidationReport = {
    meta: {
      timestamp: new Date().toISOString(),
      total_cases: caseResults.length,
    },
    summary: {
      group_a: avgA,
      group_b: avgB,
      group_c: avgC,
      hypothesis_a05: determineHypothesis(overallB - overallA, 0.5),
      hypothesis_a08: determineHypothesis(overallC - overallB, 0.3),
    },
    cases: caseResults,
  };

  fs.writeFileSync(options.outputPath, JSON.stringify(report, null, 2), 'utf-8');

  return report;
};

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

/* istanbul ignore next -- CLI entry point, tested via integration */
if (require.main === module) {
  const args = process.argv.slice(2);

  const getArg = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  const corpusPath = getArg('--corpus') ?? 'data/test-corpus.json';
  const outputPath = getArg('--output') ?? 'results/report.json';
  const singleRaw = getArg('--single');
  const singleId = singleRaw !== undefined ? Number(singleRaw) : undefined;

  runValidation({ corpusPath, outputPath, singleId })
    .then((report) => {
      console.log(`Validation complete. ${report.meta.total_cases} cases processed.`);
      console.log(`Report written to ${outputPath}`);
      process.exit(0);
    })
    .catch((err: unknown) => {
      console.error('Validation failed:', err);
      process.exit(1);
    });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  runValidation,
  runGroupA,
  runGroupB,
  runGroupC,
  computeGroupAvg,
  computeOverallAvg,
  determineHypothesis,
  getLanguageName,
};
export type {
  CorpusCase,
  RunOptions,
  GroupScores,
  HypothesisResult,
  ValidationReport,
  CaseResult,
  CaseGroupResult,
};

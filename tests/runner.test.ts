// Author: be-domain-modeler
import * as fs from 'fs';
import * as agent from '../src/agent';
import * as judge from '../src/judge';
import {
  runValidation,
  runGroupA,
  runGroupB,
  runGroupC,
  computeGroupAvg,
  computeOverallAvg,
  determineHypothesis,
  getLanguageName,
} from '../src/runner';
import type { CorpusCase, CaseGroupResult } from '../src/runner';
import type { Scores } from '../src/judge';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('fs');
jest.mock('../src/agent');
jest.mock('../src/judge');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedCallLLM = agent.callLLM as jest.MockedFunction<typeof agent.callLLM>;
const mockedExtractSemantic = agent.extractSemantic as jest.MockedFunction<typeof agent.extractSemantic>;
const mockedAdaptMessage = agent.adaptMessage as jest.MockedFunction<typeof agent.adaptMessage>;
const mockedScoreOutput = judge.scoreOutput as jest.MockedFunction<typeof judge.scoreOutput>;

const SAMPLE_CORPUS: CorpusCase[] = [
  {
    id: 1,
    category: 'taboo',
    input_text: '你看起来胖了不少啊',
    source_culture: 'zh-CN',
    target_culture: 'ja',
    context: '体重评论在日本文化中属于冒犯',
  },
  {
    id: 2,
    category: 'slang',
    input_text: '这人太卷了',
    source_culture: 'zh-CN',
    target_culture: 'ja',
    context: '内卷文化用语',
  },
  {
    id: 3,
    category: 'formality',
    input_text: 'つまらないものですが',
    source_culture: 'ja',
    target_culture: 'zh-CN',
    context: '日本谦虚送礼表达',
  },
];

const GOOD_SCORES: Scores = { intent: 4, cultural: 4, natural: 4, error: false };

beforeEach(() => {
  jest.clearAllMocks();

  mockedFs.readFileSync.mockReturnValue(JSON.stringify(SAMPLE_CORPUS));
  mockedFs.writeFileSync.mockImplementation(() => undefined);

  mockedCallLLM.mockReturnValue('translated output');
  mockedExtractSemantic.mockResolvedValue({
    original_semantic: 'semantic meaning',
    intent_type: 'greeting',
    formality: 'casual',
    emotional_tone: 'neutral',
  });
  mockedAdaptMessage.mockResolvedValue('adapted output');
  mockedScoreOutput.mockResolvedValue(GOOD_SCORES);
});

// ---------------------------------------------------------------------------
// runValidation — full pipeline
// ---------------------------------------------------------------------------

describe('runValidation', () => {
  it('reads corpus and processes all cases', async () => {
    const report = await runValidation({
      corpusPath: 'data/test-corpus.json',
      outputPath: 'results/report.json',
    });

    expect(mockedFs.readFileSync).toHaveBeenCalledWith(
      'data/test-corpus.json',
      'utf-8',
    );
    expect(report.meta.total_cases).toBe(3);
    expect(report.cases).toHaveLength(3);
  });

  it('writes report to output path', async () => {
    await runValidation({
      corpusPath: 'data/test-corpus.json',
      outputPath: 'results/report.json',
    });

    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
      'results/report.json',
      expect.any(String),
      'utf-8',
    );

    const writtenJson = mockedFs.writeFileSync.mock.calls[0][1] as string;
    const parsed = JSON.parse(writtenJson);
    expect(parsed.meta).toBeDefined();
    expect(parsed.summary).toBeDefined();
    expect(parsed.cases).toBeDefined();
  });

  it('includes timestamp in meta', async () => {
    const report = await runValidation({
      corpusPath: 'data/test-corpus.json',
      outputPath: 'results/report.json',
    });

    expect(report.meta.timestamp).toBeDefined();
    expect(new Date(report.meta.timestamp).getTime()).not.toBeNaN();
  });

  it('computes summary averages correctly', async () => {
    const report = await runValidation({
      corpusPath: 'data/test-corpus.json',
      outputPath: 'results/report.json',
    });

    expect(report.summary.group_a.intent_avg).toBe(4);
    expect(report.summary.group_a.cultural_avg).toBe(4);
    expect(report.summary.group_a.natural_avg).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Three groups produce different prompts/calls
// ---------------------------------------------------------------------------

describe('three groups produce different behavior', () => {
  it('Group A calls callLLM with simple translate prompt', async () => {
    const c = SAMPLE_CORPUS[0];
    await runGroupA(c);

    expect(mockedCallLLM).toHaveBeenCalledWith(
      expect.stringContaining('请将以下内容翻译成'),
    );
    expect(mockedCallLLM).toHaveBeenCalledWith(
      expect.stringContaining(c.input_text),
    );
  });

  it('Group B calls adaptMessage with minimal envelope (no extract)', async () => {
    const c = SAMPLE_CORPUS[0];
    await runGroupB(c);

    expect(mockedExtractSemantic).not.toHaveBeenCalled();
    expect(mockedAdaptMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chorus_version: '0.1',
        original_semantic: c.input_text,
        sender_culture: c.source_culture,
      }),
      c.target_culture,
    );
  });

  it('Group C calls extractSemantic then adaptMessage with full envelope', async () => {
    const c = SAMPLE_CORPUS[0];
    await runGroupC(c);

    expect(mockedExtractSemantic).toHaveBeenCalledWith(
      c.input_text,
      c.source_culture,
    );
    expect(mockedAdaptMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chorus_version: '0.1',
        original_semantic: 'semantic meaning',
        sender_culture: c.source_culture,
        intent_type: 'greeting',
        formality: 'casual',
        emotional_tone: 'neutral',
      }),
      c.target_culture,
    );
  });

  it('Group A does not call adaptMessage or extractSemantic', async () => {
    await runGroupA(SAMPLE_CORPUS[0]);

    expect(mockedAdaptMessage).not.toHaveBeenCalled();
    expect(mockedExtractSemantic).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Single-case mode
// ---------------------------------------------------------------------------

describe('single-case mode', () => {
  it('processes only the specified case', async () => {
    const report = await runValidation({
      corpusPath: 'data/test-corpus.json',
      outputPath: 'results/report.json',
      singleId: 2,
    });

    expect(report.meta.total_cases).toBe(1);
    expect(report.cases).toHaveLength(1);
    expect(report.cases[0].id).toBe(2);
  });

  it('returns empty report when singleId does not exist', async () => {
    const report = await runValidation({
      corpusPath: 'data/test-corpus.json',
      outputPath: 'results/report.json',
      singleId: 999,
    });

    expect(report.meta.total_cases).toBe(0);
    expect(report.cases).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('continues processing when one group fails for a case', async () => {
    mockedCallLLM
      .mockImplementationOnce(() => { throw new Error('LLM timeout'); })
      .mockReturnValue('translated');

    const report = await runValidation({
      corpusPath: 'data/test-corpus.json',
      outputPath: 'results/report.json',
    });

    expect(report.cases).toHaveLength(3);

    const firstCase = report.cases[0];
    expect(firstCase.group_a.error).toBeDefined();
    expect(firstCase.group_a.scores.error).toBe(true);
  });

  it('marks errored group with error message', async () => {
    mockedCallLLM.mockImplementation(() => {
      throw new Error('network failure');
    });

    const result = await runGroupA(SAMPLE_CORPUS[0]);

    expect(result.error).toBe('network failure');
    expect(result.scores.error).toBe(true);
    expect(result.output).toBe('');
  });

  it('handles extractSemantic failure in Group C gracefully', async () => {
    mockedExtractSemantic.mockRejectedValueOnce(
      new Error('LLM call failed: timeout'),
    );

    const result = await runGroupC(SAMPLE_CORPUS[0]);

    expect(result.error).toBe('LLM call failed: timeout');
    expect(result.scores.error).toBe(true);
  });

  it('handles adaptMessage failure in Group B gracefully', async () => {
    mockedAdaptMessage.mockRejectedValueOnce(
      new Error('LLM call failed: rate limit'),
    );

    const result = await runGroupB(SAMPLE_CORPUS[0]);

    expect(result.error).toBe('LLM call failed: rate limit');
    expect(result.scores.error).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Summary calculation
// ---------------------------------------------------------------------------

describe('computeGroupAvg', () => {
  it('computes correct averages', () => {
    const results: CaseGroupResult[] = [
      { output: 'a', scores: { intent: 4, cultural: 3, natural: 5, error: false } },
      { output: 'b', scores: { intent: 2, cultural: 5, natural: 3, error: false } },
    ];

    const avg = computeGroupAvg(results);

    expect(avg.intent_avg).toBe(3);
    expect(avg.cultural_avg).toBe(4);
    expect(avg.natural_avg).toBe(4);
  });

  it('excludes error cases from averages', () => {
    const results: CaseGroupResult[] = [
      { output: 'a', scores: { intent: 4, cultural: 4, natural: 4, error: false } },
      { output: '', scores: { intent: 0, cultural: 0, natural: 0, error: true }, error: 'fail' },
    ];

    const avg = computeGroupAvg(results);

    expect(avg.intent_avg).toBe(4);
    expect(avg.cultural_avg).toBe(4);
    expect(avg.natural_avg).toBe(4);
  });

  it('returns zeros when all cases are errors', () => {
    const results: CaseGroupResult[] = [
      { output: '', scores: { intent: 0, cultural: 0, natural: 0, error: true }, error: 'fail' },
    ];

    const avg = computeGroupAvg(results);

    expect(avg.intent_avg).toBe(0);
    expect(avg.cultural_avg).toBe(0);
    expect(avg.natural_avg).toBe(0);
  });

  it('rounds to two decimal places', () => {
    const results: CaseGroupResult[] = [
      { output: 'a', scores: { intent: 3, cultural: 4, natural: 5, error: false } },
      { output: 'b', scores: { intent: 4, cultural: 3, natural: 4, error: false } },
      { output: 'c', scores: { intent: 5, cultural: 5, natural: 3, error: false } },
    ];

    const avg = computeGroupAvg(results);

    expect(avg.intent_avg).toBe(4);
    expect(avg.cultural_avg).toBe(4);
    expect(avg.natural_avg).toBe(4);
  });
});

describe('computeOverallAvg', () => {
  it('computes the mean of three dimension averages', () => {
    const group = { intent_avg: 3, cultural_avg: 4, natural_avg: 5 };
    expect(computeOverallAvg(group)).toBe(4);
  });

  it('rounds to two decimal places', () => {
    const group = { intent_avg: 3.1, cultural_avg: 4.2, natural_avg: 5.3 };
    expect(computeOverallAvg(group)).toBe(4.2);
  });
});

// ---------------------------------------------------------------------------
// Hypothesis determination
// ---------------------------------------------------------------------------

describe('determineHypothesis', () => {
  it('returns CONFIRMED when delta exceeds threshold', () => {
    const result = determineHypothesis(1.5, 0.5);

    expect(result.result).toBe('CONFIRMED');
    expect(result.delta).toBe(1.5);
  });

  it('returns CONFIRMED when delta equals threshold', () => {
    const result = determineHypothesis(0.5, 0.5);

    expect(result.result).toBe('CONFIRMED');
    expect(result.delta).toBe(0.5);
  });

  it('returns INCONCLUSIVE when delta is below threshold', () => {
    const result = determineHypothesis(0.1, 0.5);

    expect(result.result).toBe('INCONCLUSIVE');
    expect(result.delta).toBe(0.1);
  });

  it('returns INCONCLUSIVE for negative delta', () => {
    const result = determineHypothesis(-0.3, 0.5);

    expect(result.result).toBe('INCONCLUSIVE');
    expect(result.delta).toBe(-0.3);
  });

  it('rounds delta to two decimal places', () => {
    const result = determineHypothesis(0.333333, 0.1);

    expect(result.delta).toBe(0.33);
  });
});

// ---------------------------------------------------------------------------
// getLanguageName
// ---------------------------------------------------------------------------

describe('getLanguageName', () => {
  it('returns Chinese for zh-CN', () => {
    expect(getLanguageName('zh-CN')).toBe('中文');
  });

  it('returns Japanese for ja', () => {
    expect(getLanguageName('ja')).toBe('日语');
  });

  it('returns the raw culture code for unknown cultures', () => {
    expect(getLanguageName('sw')).toBe('sw');
  });
});

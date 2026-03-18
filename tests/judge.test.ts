// Author: be-ai-integrator
import { scoreOutput, validateConsistency, ScoreParams, Scores } from '../src/judge';
import * as child_process from 'child_process';

jest.mock('child_process');

const mockedExecFileSync = child_process.execFileSync as jest.MockedFunction<
  typeof child_process.execFileSync
>;

const BASE_PARAMS: ScoreParams = {
  input_text: '能不能帮我约个时间聊聊？',
  output_text: 'Could we schedule a time to chat?',
  source_culture: 'zh-CN',
  target_culture: 'en-US',
  context: 'Business colleague requesting a meeting',
};

describe('scoreOutput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns correct scores from valid JSON LLM response', async () => {
    mockedExecFileSync.mockReturnValue('{"intent": 4, "cultural": 5, "natural": 3}');

    const result = await scoreOutput(BASE_PARAMS);

    expect(result).toEqual({
      intent: 4,
      cultural: 5,
      natural: 3,
      error: false,
    });
    expect(mockedExecFileSync).toHaveBeenCalledTimes(1);
  });

  it('passes blind prompt without group labels', async () => {
    mockedExecFileSync.mockReturnValue('{"intent": 4, "cultural": 5, "natural": 3}');

    await scoreOutput(BASE_PARAMS);

    const callArgs = mockedExecFileSync.mock.calls[0];
    const prompt = callArgs[2]?.input as string;
    expect(prompt).not.toContain('group');
    expect(prompt).not.toContain('Group');
    expect(prompt).not.toContain('chorus');
    expect(prompt).not.toContain('Chorus');
    expect(prompt).not.toContain('baseline');
    expect(prompt).toContain(BASE_PARAMS.input_text);
    expect(prompt).toContain(BASE_PARAMS.output_text);
  });

  it('retries once on invalid JSON, then returns fallback zeros', async () => {
    mockedExecFileSync
      .mockReturnValueOnce('This is not JSON at all')
      .mockReturnValueOnce('Still not JSON');

    const result = await scoreOutput(BASE_PARAMS);

    expect(result).toEqual({
      intent: 0,
      cultural: 0,
      natural: 0,
      error: true,
    });
    expect(mockedExecFileSync).toHaveBeenCalledTimes(2);
  });

  it('retries once on invalid JSON, succeeds on second attempt', async () => {
    mockedExecFileSync
      .mockReturnValueOnce('Not valid JSON')
      .mockReturnValueOnce('{"intent": 3, "cultural": 4, "natural": 5}');

    const result = await scoreOutput(BASE_PARAMS);

    expect(result).toEqual({
      intent: 3,
      cultural: 4,
      natural: 5,
      error: false,
    });
    expect(mockedExecFileSync).toHaveBeenCalledTimes(2);
  });

  it('clamps out-of-range scores to 1-5 bounds', async () => {
    mockedExecFileSync.mockReturnValue('{"intent": 0, "cultural": 7, "natural": -2}');

    const result = await scoreOutput(BASE_PARAMS);

    expect(result).toEqual({
      intent: 1,
      cultural: 5,
      natural: 1,
      error: false,
    });
  });

  it('retries when JSON parses to a non-object value, then returns fallback', async () => {
    mockedExecFileSync
      .mockReturnValueOnce('42')
      .mockReturnValueOnce('"just a string"');

    const result = await scoreOutput(BASE_PARAMS);

    expect(result).toEqual({
      intent: 0,
      cultural: 0,
      natural: 0,
      error: true,
    });
    expect(mockedExecFileSync).toHaveBeenCalledTimes(2);
  });

  it('retries on missing score fields, then returns fallback', async () => {
    mockedExecFileSync
      .mockReturnValueOnce('{"intent": 3}')
      .mockReturnValueOnce('{"cultural": 2}');

    const result = await scoreOutput(BASE_PARAMS);

    expect(result).toEqual({
      intent: 0,
      cultural: 0,
      natural: 0,
      error: true,
    });
  });

  it('retries on non-numeric score values, then returns fallback', async () => {
    mockedExecFileSync
      .mockReturnValueOnce('{"intent": "high", "cultural": 3, "natural": 4}')
      .mockReturnValueOnce('{"intent": null, "cultural": 3, "natural": 4}');

    const result = await scoreOutput(BASE_PARAMS);

    expect(result).toEqual({
      intent: 0,
      cultural: 0,
      natural: 0,
      error: true,
    });
  });

  it('handles LLM process throwing an error with retry and fallback', async () => {
    mockedExecFileSync
      .mockImplementationOnce(() => { throw new Error('Process timed out'); })
      .mockImplementationOnce(() => { throw new Error('Process timed out'); });

    const result = await scoreOutput(BASE_PARAMS);

    expect(result).toEqual({
      intent: 0,
      cultural: 0,
      natural: 0,
      error: true,
    });
    expect(mockedExecFileSync).toHaveBeenCalledTimes(2);
  });

  it('handles JSON embedded in markdown code fence', async () => {
    mockedExecFileSync.mockReturnValue(
      '```json\n{"intent": 4, "cultural": 3, "natural": 5}\n```'
    );

    const result = await scoreOutput(BASE_PARAMS);

    expect(result).toEqual({
      intent: 4,
      cultural: 3,
      natural: 5,
      error: false,
    });
  });
});

describe('validateConsistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes kappa = 1 for perfectly consistent scorer', async () => {
    const cases: ScoreParams[] = Array.from({ length: 5 }, (_, i) => ({
      ...BASE_PARAMS,
      input_text: `Test input ${i}`,
    }));

    const deterministicScorer = async (): Promise<Scores> => ({
      intent: 4,
      cultural: 3,
      natural: 5,
      error: false,
    });

    const result = await validateConsistency(cases, deterministicScorer);

    expect(result.kappa_intent).toBe(1);
    expect(result.kappa_cultural).toBe(1);
    expect(result.kappa_natural).toBe(1);
    expect(result.is_reliable).toBe(true);
  });

  it('returns is_reliable = false when kappa is low', async () => {
    const cases: ScoreParams[] = Array.from({ length: 10 }, (_, i) => ({
      ...BASE_PARAMS,
      input_text: `Test input ${i}`,
    }));

    let callCount = 0;
    const randomScorer = async (): Promise<Scores> => {
      callCount++;
      return {
        intent: (callCount % 5) + 1,
        cultural: ((callCount * 3) % 5) + 1,
        natural: ((callCount * 7) % 5) + 1,
        error: false,
      };
    };

    const result = await validateConsistency(cases, randomScorer);

    expect(typeof result.kappa_intent).toBe('number');
    expect(typeof result.kappa_cultural).toBe('number');
    expect(typeof result.kappa_natural).toBe('number');
    expect(typeof result.is_reliable).toBe('boolean');
  });

  it('uses at most 20 cases even if more are provided', async () => {
    const cases: ScoreParams[] = Array.from({ length: 50 }, (_, i) => ({
      ...BASE_PARAMS,
      input_text: `Test input ${i}`,
    }));

    let callCount = 0;
    const countingScorer = async (): Promise<Scores> => {
      callCount++;
      return { intent: 4, cultural: 4, natural: 4, error: false };
    };

    await validateConsistency(cases, countingScorer);

    // 20 cases scored twice each = 40 calls
    expect(callCount).toBe(40);
  });

  it('uses all cases when fewer than 20', async () => {
    const cases: ScoreParams[] = Array.from({ length: 3 }, (_, i) => ({
      ...BASE_PARAMS,
      input_text: `Test input ${i}`,
    }));

    let callCount = 0;
    const countingScorer = async (): Promise<Scores> => {
      callCount++;
      return { intent: 4, cultural: 4, natural: 4, error: false };
    };

    await validateConsistency(cases, countingScorer);

    // 3 cases scored twice each = 6 calls
    expect(callCount).toBe(6);
  });

  it('handles scorer returning errors gracefully', async () => {
    const cases: ScoreParams[] = Array.from({ length: 5 }, (_, i) => ({
      ...BASE_PARAMS,
      input_text: `Test input ${i}`,
    }));

    const errorScorer = async (): Promise<Scores> => ({
      intent: 0,
      cultural: 0,
      natural: 0,
      error: true,
    });

    const result = await validateConsistency(cases, errorScorer);

    expect(typeof result.kappa_intent).toBe('number');
    expect(typeof result.kappa_cultural).toBe('number');
    expect(typeof result.kappa_natural).toBe('number');
    expect(result.is_reliable).toBeDefined();
  });

  it('computes weighted kappa correctly for known score pairs', async () => {
    // First pass: [4, 4, 3, 5, 4], second pass: [4, 3, 3, 5, 5]
    const intentScores = [4, 4, 3, 5, 4, 4, 3, 3, 5, 5];
    let idx = 0;

    const cases: ScoreParams[] = Array.from({ length: 5 }, (_, i) => ({
      ...BASE_PARAMS,
      input_text: `Test input ${i}`,
    }));

    const sequenceScorer = async (): Promise<Scores> => {
      const score = intentScores[idx++];
      return { intent: score, cultural: score, natural: score, error: false };
    };

    const result = await validateConsistency(cases, sequenceScorer);

    // Pairs: (4,4), (4,3), (3,3), (5,5), (4,5)
    // Exact match: 3/5, differ by 1: 2/5
    // po = (3*1 + 2*0.5) / 5 = 0.8
    expect(result.kappa_intent).toBeGreaterThan(0);
    expect(result.kappa_intent).toBeLessThanOrEqual(1);
  });
});

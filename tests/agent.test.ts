// Author: be-ai-integrator
import * as childProcess from 'child_process';
import {
  extractSemantic,
  adaptMessage,
  callLLM,
  CHORUS_PROMPT_TEMPLATE,
  buildExtractionPrompt,
  buildAdaptationPrompt,
  parseSemanticJSON,
} from '../src/agent';
import type { ChorusEnvelope, SemanticResult } from '../src/agent';

// ---------------------------------------------------------------------------
// Mock child_process.execFileSync (safe variant, no shell injection risk)
// ---------------------------------------------------------------------------

jest.mock('child_process', () => ({
  execFileSync: jest.fn(),
}));

const mockedExecFileSync = childProcess.execFileSync as jest.MockedFunction<
  typeof childProcess.execFileSync
>;

beforeEach(() => {
  mockedExecFileSync.mockReset();
});

// ---------------------------------------------------------------------------
// callLLM
// ---------------------------------------------------------------------------

describe('callLLM', () => {
  it('invokes claude CLI with correct args and returns trimmed output', () => {
    mockedExecFileSync.mockReturnValue('  hello world  ');

    const result = callLLM('test prompt');

    expect(result).toBe('hello world');
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      'claude',
      ['-p', '--model', 'sonnet'],
      expect.objectContaining({
        input: 'test prompt',
        encoding: 'utf-8',
        timeout: 60_000,
      }),
    );
  });

  it('throws a descriptive error when execFileSync fails', () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error('spawn ENOENT');
    });

    expect(() => callLLM('bad prompt')).toThrow('LLM call failed: spawn ENOENT');
  });

  it('handles non-Error throws gracefully', () => {
    mockedExecFileSync.mockImplementation(() => {
      throw 'string error';  // eslint-disable-line no-throw-literal
    });

    expect(() => callLLM('bad prompt')).toThrow('LLM call failed: string error');
  });
});

// ---------------------------------------------------------------------------
// parseSemanticJSON
// ---------------------------------------------------------------------------

describe('parseSemanticJSON', () => {
  it('parses a valid full JSON response', () => {
    const raw = JSON.stringify({
      original_semantic: '请求安排会面',
      intent_type: 'request',
      formality: 'formal',
      emotional_tone: 'polite',
    });

    const result = parseSemanticJSON(raw);
    expect(result).toEqual({
      original_semantic: '请求安排会面',
      intent_type: 'request',
      formality: 'formal',
      emotional_tone: 'polite',
    });
  });

  it('parses JSON embedded in surrounding text', () => {
    const raw = 'Here is the result:\n{"original_semantic": "greeting"}\nDone.';
    const result = parseSemanticJSON(raw);
    expect(result.original_semantic).toBe('greeting');
  });

  it('handles minimal response (only required field)', () => {
    const raw = '{"original_semantic": "just a test"}';
    const result = parseSemanticJSON(raw);
    expect(result).toEqual({ original_semantic: 'just a test' });
    expect(result.intent_type).toBeUndefined();
    expect(result.formality).toBeUndefined();
    expect(result.emotional_tone).toBeUndefined();
  });

  it('throws when no JSON object found', () => {
    expect(() => parseSemanticJSON('no json here')).toThrow(
      'Failed to parse LLM response as JSON',
    );
  });

  it('throws when original_semantic is missing', () => {
    const raw = '{"intent_type": "request"}';
    expect(() => parseSemanticJSON(raw)).toThrow(
      'missing required field: original_semantic',
    );
  });

  it('ignores non-string optional fields', () => {
    const raw = JSON.stringify({
      original_semantic: 'test',
      intent_type: 123,
      formality: null,
    });
    const result = parseSemanticJSON(raw);
    expect(result).toEqual({ original_semantic: 'test' });
  });
});

// ---------------------------------------------------------------------------
// extractSemantic
// ---------------------------------------------------------------------------

describe('extractSemantic', () => {
  const mockLLMResponse = JSON.stringify({
    original_semantic: '用户希望安排一次非正式会面讨论项目进展',
    intent_type: 'request',
    formality: 'semi-formal',
    emotional_tone: 'polite',
  });

  it('extracts semantic from Chinese input with correct structure', async () => {
    mockedExecFileSync.mockReturnValue(mockLLMResponse);

    const result: SemanticResult = await extractSemantic(
      '能不能帮我约个时间聊聊？',
      'zh-CN',
    );

    expect(result.original_semantic).toBe(
      '用户希望安排一次非正式会面讨论项目进展',
    );
    expect(result.intent_type).toBe('request');
    expect(result.formality).toBe('semi-formal');
    expect(result.emotional_tone).toBe('polite');
  });

  it('includes the chorus prompt template in the LLM call', async () => {
    mockedExecFileSync.mockReturnValue(mockLLMResponse);

    await extractSemantic('hello', 'en');

    const callInput = mockedExecFileSync.mock.calls[0][2] as { input: string };
    expect(callInput.input).toContain(CHORUS_PROMPT_TEMPLATE);
    expect(callInput.input).toContain('传达意图，而非逐字翻译');
  });

  it('includes user culture in the prompt', async () => {
    mockedExecFileSync.mockReturnValue(mockLLMResponse);

    await extractSemantic('test input', 'ja');

    const callInput = mockedExecFileSync.mock.calls[0][2] as { input: string };
    expect(callInput.input).toContain('ja');
  });

  it('propagates LLM errors', async () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error('timeout');
    });

    await expect(extractSemantic('test', 'en')).rejects.toThrow(
      'LLM call failed',
    );
  });
});

// ---------------------------------------------------------------------------
// adaptMessage
// ---------------------------------------------------------------------------

describe('adaptMessage', () => {
  const sampleEnvelope: ChorusEnvelope = {
    chorus_version: '0.1',
    original_semantic: '请求安排一次会面讨论，态度友好随和',
    sender_culture: 'zh-CN',
    intent_type: 'request',
    formality: 'semi-formal',
    emotional_tone: 'polite',
  };

  it('returns adapted text from LLM', async () => {
    const adapted =
      "Hey, I was wondering if you'd have time for a quick chat about the project?";
    mockedExecFileSync.mockReturnValue(adapted);

    const result = await adaptMessage(sampleEnvelope, 'en-US');

    expect(typeof result).toBe('string');
    expect(result).toBe(adapted);
  });

  it('includes the chorus prompt template in the LLM call', async () => {
    mockedExecFileSync.mockReturnValue('adapted text');

    await adaptMessage(sampleEnvelope, 'en-US');

    const callInput = mockedExecFileSync.mock.calls[0][2] as { input: string };
    expect(callInput.input).toContain(CHORUS_PROMPT_TEMPLATE);
    expect(callInput.input).toContain('适配对方文化的表达习惯和礼仪规范');
  });

  it('includes envelope fields in the prompt', async () => {
    mockedExecFileSync.mockReturnValue('adapted');

    await adaptMessage(sampleEnvelope, 'ja');

    const callInput = mockedExecFileSync.mock.calls[0][2] as { input: string };
    expect(callInput.input).toContain('original_semantic: 请求安排一次会面讨论，态度友好随和');
    expect(callInput.input).toContain('sender_culture: zh-CN');
    expect(callInput.input).toContain('intent_type: request');
    expect(callInput.input).toContain('formality: semi-formal');
    expect(callInput.input).toContain('emotional_tone: polite');
    expect(callInput.input).toContain('ja');
  });

  it('handles envelope with only required fields', async () => {
    const minimalEnvelope: ChorusEnvelope = {
      chorus_version: '0.1',
      original_semantic: 'simple greeting',
      sender_culture: 'en',
    };

    mockedExecFileSync.mockReturnValue('hello');
    const result = await adaptMessage(minimalEnvelope, 'zh-CN');
    expect(result).toBe('hello');

    const callInput = mockedExecFileSync.mock.calls[0][2] as { input: string };
    expect(callInput.input).not.toContain('intent_type:');
    expect(callInput.input).not.toContain('formality:');
    expect(callInput.input).not.toContain('emotional_tone:');
  });

  it('includes relationship_level when present', async () => {
    const envelopeWithRelationship: ChorusEnvelope = {
      ...sampleEnvelope,
      relationship_level: 'colleague',
    };

    mockedExecFileSync.mockReturnValue('adapted');
    await adaptMessage(envelopeWithRelationship, 'en');

    const callInput = mockedExecFileSync.mock.calls[0][2] as { input: string };
    expect(callInput.input).toContain('relationship_level: colleague');
  });

  it('propagates LLM errors', async () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error('network failure');
    });

    await expect(adaptMessage(sampleEnvelope, 'en')).rejects.toThrow(
      'LLM call failed',
    );
  });
});

// ---------------------------------------------------------------------------
// buildExtractionPrompt / buildAdaptationPrompt
// ---------------------------------------------------------------------------

describe('buildExtractionPrompt', () => {
  it('contains all required sections', () => {
    const prompt = buildExtractionPrompt('你好', 'zh-CN');

    expect(prompt).toContain(CHORUS_PROMPT_TEMPLATE);
    expect(prompt).toContain('用户文化背景: zh-CN');
    expect(prompt).toContain('用户输入: 你好');
    expect(prompt).toContain('只输出 JSON');
    expect(prompt).toContain('original_semantic');
  });
});

describe('buildAdaptationPrompt', () => {
  it('contains all required sections for a full envelope', () => {
    const envelope: ChorusEnvelope = {
      chorus_version: '0.1',
      original_semantic: 'test semantic',
      sender_culture: 'zh-CN',
      intent_type: 'request',
      formality: 'formal',
      emotional_tone: 'polite',
    };

    const prompt = buildAdaptationPrompt(envelope, 'en-US');

    expect(prompt).toContain(CHORUS_PROMPT_TEMPLATE);
    expect(prompt).toContain('目标文化: en-US');
    expect(prompt).toContain('chorus_version: 0.1');
    expect(prompt).toContain('original_semantic: test semantic');
    expect(prompt).toContain('sender_culture: zh-CN');
    expect(prompt).toContain('intent_type: request');
    expect(prompt).toContain('formality: formal');
    expect(prompt).toContain('emotional_tone: polite');
  });
});

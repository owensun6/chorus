// Author: be-ai-integrator
import { execFileSync } from 'child_process';

/**
 * Chorus Protocol — LLM integration module.
 * Handles semantic extraction from user input and cultural adaptation of envelopes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SemanticResult {
  readonly original_semantic: string;
  readonly intent_type?: string;
  readonly formality?: string;
  readonly emotional_tone?: string;
}

export interface ChorusEnvelope {
  readonly chorus_version: string;
  readonly original_semantic: string;
  readonly sender_culture: string;
  readonly intent_type?: string;
  readonly formality?: string;
  readonly emotional_tone?: string;
  readonly relationship_level?: string;
}

// ---------------------------------------------------------------------------
// Prompt template (inlined from INTERFACE.md chorus-prompt-template)
// ---------------------------------------------------------------------------

const CHORUS_PROMPT_TEMPLATE = `你是一个跨文化沟通助手，代表用户与来自不同文化背景的对方进行对话。

核心原则：
1. 传达意图，而非逐字翻译。
2. 适配对方文化的表达习惯和礼仪规范。
3. 保留原始的情感基调和沟通目的。

你收到的消息包含对方的原始语义意图和文化背景信息。
请根据这些信息，用你的用户最熟悉的语言和文化方式呈现消息。`;

// ---------------------------------------------------------------------------
// LLM caller (internal helper)
// ---------------------------------------------------------------------------

const LLM_TIMEOUT_MS = 60_000;

export function callLLM(prompt: string): string {
  try {
    const result = execFileSync('claude', ['-p', '--model', 'sonnet'], {
      input: prompt,
      encoding: 'utf-8',
      timeout: LLM_TIMEOUT_MS,
    });
    return result.trim();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(`LLM call failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// extractSemantic
// ---------------------------------------------------------------------------

function buildExtractionPrompt(
  userInput: string,
  userCulture: string,
): string {
  return [
    CHORUS_PROMPT_TEMPLATE,
    '',
    '---',
    '',
    '任务：分析以下用户输入，提取语义意图信息。',
    `用户文化背景: ${userCulture}`,
    `用户输入: ${userInput}`,
    '',
    '请以 JSON 格式返回，包含以下字段:',
    '- original_semantic (string, 必填): 用自然语言描述用户的沟通意图',
    '- intent_type (string, 可选): greeting | request | proposal | rejection | chitchat | apology | gratitude | information',
    '- formality (string, 可选): formal | semi-formal | casual',
    '- emotional_tone (string, 可选): polite | neutral | enthusiastic | cautious | apologetic',
    '',
    '只输出 JSON，不要解释。',
  ].join('\n');
}

function parseSemanticJSON(raw: string): SemanticResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `Failed to parse LLM response as JSON: no object found in "${raw}"`,
    );
  }

  const parsed: unknown = JSON.parse(jsonMatch[0]);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('LLM response is not a valid JSON object');
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj['original_semantic'] !== 'string') {
    throw new Error(
      'LLM response missing required field: original_semantic',
    );
  }

  return {
    original_semantic: obj['original_semantic'] as string,
    ...(typeof obj['intent_type'] === 'string'
      ? { intent_type: obj['intent_type'] }
      : {}),
    ...(typeof obj['formality'] === 'string'
      ? { formality: obj['formality'] }
      : {}),
    ...(typeof obj['emotional_tone'] === 'string'
      ? { emotional_tone: obj['emotional_tone'] }
      : {}),
  };
}

export async function extractSemantic(
  userInput: string,
  userCulture: string,
): Promise<SemanticResult> {
  const prompt = buildExtractionPrompt(userInput, userCulture);
  const raw = callLLM(prompt);
  return parseSemanticJSON(raw);
}

// ---------------------------------------------------------------------------
// adaptMessage
// ---------------------------------------------------------------------------

function buildAdaptationPrompt(
  envelope: ChorusEnvelope,
  targetCulture: string,
): string {
  const envelopeLines = [
    `chorus_version: ${envelope.chorus_version}`,
    `original_semantic: ${envelope.original_semantic}`,
    `sender_culture: ${envelope.sender_culture}`,
  ];

  if (envelope.intent_type) {
    envelopeLines.push(`intent_type: ${envelope.intent_type}`);
  }
  if (envelope.formality) {
    envelopeLines.push(`formality: ${envelope.formality}`);
  }
  if (envelope.emotional_tone) {
    envelopeLines.push(`emotional_tone: ${envelope.emotional_tone}`);
  }
  if (envelope.relationship_level) {
    envelopeLines.push(
      `relationship_level: ${envelope.relationship_level}`,
    );
  }

  return [
    CHORUS_PROMPT_TEMPLATE,
    '',
    '---',
    '',
    '任务：将以下 Chorus 信封的语义意图适配为目标文化的自然表达。',
    `目标文化: ${targetCulture}`,
    '',
    '信封内容:',
    ...envelopeLines,
    '',
    '请直接输出适配后的文本，不要包含任何元数据或解释。',
  ].join('\n');
}

export async function adaptMessage(
  envelope: ChorusEnvelope,
  targetCulture: string,
): Promise<string> {
  const prompt = buildAdaptationPrompt(envelope, targetCulture);
  return callLLM(prompt);
}

// ---------------------------------------------------------------------------
// Exports for testing internal helpers
// ---------------------------------------------------------------------------

export {
  CHORUS_PROMPT_TEMPLATE,
  buildExtractionPrompt,
  buildAdaptationPrompt,
  parseSemanticJSON,
};

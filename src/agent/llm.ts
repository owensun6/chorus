// Author: be-ai-integrator
import OpenAI from "openai";
import type { ChorusEnvelope } from "../shared/types";

// --- Types ---

interface ExtractResult {
  readonly original_semantic: string;
  readonly cultural_context?: string;
  readonly intent_type?: string;
  readonly formality?: string;
  readonly emotional_tone?: string;
}

// --- Constants ---

const DEFAULT_BASE_URL =
  "https://coding.dashscope.aliyuncs.com/v1" as const;

const DEFAULT_MODEL = "qwen3.5-plus" as const;

// --- Prompt Templates ---

const buildSenderPrompt = (
  userInput: string,
  senderCulture: string,
): string =>
  `你是一个跨文化沟通助手。用户刚刚说了一句话，你需要：
1. 提取这句话的核心语义意图（original_semantic）。
2. 为这句话生成一段文化背景说明（cultural_context）。
要求：
- cultural_context 用 ${senderCulture} 对应的语言书写。
- 长度控制在 10-500 字符。
用户输入: ${userInput}
用户文化: ${senderCulture}
请输出 JSON:
{"original_semantic":"...","cultural_context":"...","intent_type":"...","formality":"...","emotional_tone":"..."}`;

const buildReceiverPrompt = (
  envelope: ChorusEnvelope,
  originalText: string,
  receiverCulture: string,
): string => {
  const contextNote =
    envelope.cultural_context ??
    "（无文化背景说明，请仅根据 sender_culture 标签推断）";

  return `你是一个跨文化沟通助手，代表用户与来自不同文化背景的对方进行对话。
核心原则：传达意图，而非逐字翻译。适配对方文化的表达习惯。
你收到的消息来自 ${envelope.sender_culture} 文化背景的发送者。
原始语义意图: ${envelope.original_semantic}
文化背景说明: ${contextNote}
原文: ${originalText}
请用 ${receiverCulture} 文化最自然的方式表达这段消息。只输出适配文本。`;
};

// --- Public API ---

const createLLMClient = (apiKey: string, baseUrl?: string): OpenAI =>
  new OpenAI({
    apiKey,
    baseURL: baseUrl ?? DEFAULT_BASE_URL,
  });

const VALID_INTENT_TYPES = new Set([
  "greeting", "request", "proposal", "rejection",
  "chitchat", "apology", "gratitude", "information",
]);
const VALID_FORMALITY = new Set(["formal", "semi-formal", "casual"]);
const VALID_EMOTIONAL_TONE = new Set([
  "polite", "neutral", "enthusiastic", "cautious", "apologetic",
]);

const enumOrUndefined = (value: unknown, valid: Set<string>): string | undefined => {
  const s = typeof value === "string" ? value : undefined;
  return s !== undefined && valid.has(s) ? s : undefined;
};

const extractSemantic = async (
  client: OpenAI,
  userInput: string,
  senderCulture: string,
  model: string = DEFAULT_MODEL,
): Promise<ExtractResult> => {
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: buildSenderPrompt(userInput, senderCulture) }],
  });

  const raw = response.choices[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return {
      original_semantic: String(parsed.original_semantic ?? ""),
      cultural_context:
        parsed.cultural_context === "" || parsed.cultural_context == null
          ? undefined
          : String(parsed.cultural_context),
      intent_type: enumOrUndefined(parsed.intent_type, VALID_INTENT_TYPES),
      formality: enumOrUndefined(parsed.formality, VALID_FORMALITY),
      emotional_tone: enumOrUndefined(parsed.emotional_tone, VALID_EMOTIONAL_TONE),
    };
  } catch {
    throw new Error("failed to parse LLM response");
  }
};

const adaptMessage = async (
  client: OpenAI,
  envelope: ChorusEnvelope,
  originalText: string,
  receiverCulture: string,
  model: string = DEFAULT_MODEL,
): Promise<string> => {
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: buildReceiverPrompt(envelope, originalText, receiverCulture),
        },
      ],
    });

    return response.choices[0]?.message?.content ?? "";
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timeout")) {
      throw new Error(`LLM request timeout: ${message}`);
    }
    throw err;
  }
};

export { createLLMClient, extractSemantic, adaptMessage };
export type { ExtractResult };

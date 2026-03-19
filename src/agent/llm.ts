// Author: be-ai-integrator
import OpenAI from "openai";
import type { ChorusEnvelope, ConversationTurn } from "../shared/types";

// --- Types ---

interface ExtractResult {
  readonly original_semantic: string;
  readonly cultural_context?: string;
}

// --- Constants ---

const DEFAULT_BASE_URL =
  "https://coding.dashscope.aliyuncs.com/v1" as const;

const DEFAULT_MODEL = "qwen3-coder-next" as const;

// --- Prompt Templates ---

const buildSemanticPrompt = (userInput: string): string =>
  `用一句话提取以下内容的核心语义意图，直接输出结果，不要解释：
${userInput}`;

const buildCulturalContextPrompt = (
  userInput: string,
  senderCulture: string,
): string =>
  `描述以下内容在 ${senderCulture} 文化中的语用含义和社交规范。
要求：用 ${senderCulture} 对应的语言书写，10-500字，包含具体文化信息，不要泛化描述。直接输出，不要解释格式。
内容：${userInput}`;

const buildReceiverPrompt = (
  envelope: ChorusEnvelope,
  originalText: string,
  receiverCulture: string,
  history?: readonly ConversationTurn[],
): string => {
  const contextNote =
    envelope.cultural_context ??
    "（无文化背景说明，请仅根据 sender_culture 标签推断）";

  const historyBlock =
    history && history.length > 0
      ? "对话历史:\n" +
        history.map((t) => `[${t.role}] ${t.originalText} → ${t.adaptedText}`).join("\n") +
        "\n---\n"
      : "";

  return `${historyBlock}你是一个跨文化沟通助手，代表用户与来自不同文化背景的对方进行对话。
核心原则：传达意图，而非逐字翻译。适配对方文化的表达习惯。
你收到的消息来自 ${envelope.sender_culture} 文化背景的发送者。
原始语义意图: ${envelope.original_semantic}
文化背景说明: ${contextNote}
原文: ${originalText}
请用 ${receiverCulture} 文化最自然的方式表达这段消息。只输出适配文本。`;
};

// --- Core: plain text LLM calls (no JSON, no enum) ---

const callLLMStream = async (
  client: OpenAI,
  prompt: string,
  onToken?: (chunk: string) => void,
  model: string = DEFAULT_MODEL,
): Promise<string> => {
  const stream = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  let accumulated = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) {
      if (onToken) onToken(delta);
      accumulated += delta;
    }
  }
  return accumulated.trim();
};

const extractSemanticStream = async (
  client: OpenAI,
  userInput: string,
  senderCulture: string,
  onToken?: (chunk: string) => void,
  model: string = DEFAULT_MODEL,
): Promise<ExtractResult> => {
  // Call 1: extract semantic intent (plain text)
  const original_semantic = await callLLMStream(
    client,
    buildSemanticPrompt(userInput),
    undefined, // no streaming for this short call
    model,
  );

  // Call 2: generate cultural context (plain text, streamed for UX)
  const cultural_context = await callLLMStream(
    client,
    buildCulturalContextPrompt(userInput, senderCulture),
    onToken,
    model,
  );

  return {
    original_semantic: original_semantic || userInput,
    cultural_context: cultural_context && cultural_context.length >= 10
      ? cultural_context
      : undefined,
  };
};

const adaptMessageStream = async (
  client: OpenAI,
  envelope: ChorusEnvelope,
  originalText: string,
  receiverCulture: string,
  history?: readonly ConversationTurn[],
  onChunk?: (text: string) => void,
  model: string = DEFAULT_MODEL,
): Promise<string> => {
  try {
    const prompt = buildReceiverPrompt(envelope, originalText, receiverCulture, history);
    return await callLLMStream(client, prompt, onChunk, model);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timeout")) {
      throw new Error(`LLM request timeout: ${message}`);
    }
    throw err;
  }
};

// Non-streaming: thin wrappers
const extractSemantic = (
  client: OpenAI,
  userInput: string,
  senderCulture: string,
  model: string = DEFAULT_MODEL,
): Promise<ExtractResult> =>
  extractSemanticStream(client, userInput, senderCulture, undefined, model);

const adaptMessage = (
  client: OpenAI,
  envelope: ChorusEnvelope,
  originalText: string,
  receiverCulture: string,
  model: string = DEFAULT_MODEL,
): Promise<string> =>
  adaptMessageStream(client, envelope, originalText, receiverCulture, undefined, undefined, model);

const createLLMClient = (apiKey: string, baseUrl?: string): OpenAI =>
  new OpenAI({
    apiKey,
    baseURL: baseUrl ?? DEFAULT_BASE_URL,
  });

export { createLLMClient, extractSemantic, adaptMessage, extractSemanticStream, adaptMessageStream };
export type { ExtractResult };

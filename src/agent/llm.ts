// Author: be-ai-integrator
import OpenAI from "openai";
import type { ChorusEnvelope, ConversationTurn } from "../shared/types";
import { extractErrorMessage } from "../shared/log";

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
  receiverPersonality?: string,
): string => {
  const contextNote =
    envelope.cultural_context ??
    "（无文化背景说明，请仅根据 sender_culture 标签推断）";

  const roleDescription = receiverPersonality
    ? `你是用户的私人跨文化助手。你的风格：${receiverPersonality}\n对方的 Agent 转来了一条消息，请用你自己的风格转告给用户。`
    : "你是用户的私人跨文化助手。对方的 Agent 转来了一条消息，请你转告给用户。\n\n像一个懂两种文化的朋友传话：先说对方的意思，再简短解释文化背景（如果有必要）。";

  const historyBlock =
    history && history.length > 0
      ? "对话历史:\n" +
        history.map((t) => `[${t.role}] ${t.originalText} → ${t.adaptedText}`).join("\n") +
        "\n---\n"
      : "";

  return `${historyBlock}${roleDescription}

规则：
- 只用 ${receiverCulture} 语言，不混入其他语言
- 2-4 句话，简洁自然
- 不用 markdown、不用 emoji、不用代码格式

对方（${envelope.sender_culture}）说: ${originalText}
对方的意图: ${envelope.original_semantic}
文化背景: ${contextNote}

转告给用户：`;
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
  receiverPersonality?: string,
  onChunk?: (text: string) => void,
  model: string = DEFAULT_MODEL,
): Promise<string> => {
  try {
    const prompt = buildReceiverPrompt(envelope, originalText, receiverCulture, history, receiverPersonality);
    return await callLLMStream(client, prompt, onChunk, model);
  } catch (err: unknown) {
    const message = extractErrorMessage(err);
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
  receiverPersonality?: string,
  model: string = DEFAULT_MODEL,
): Promise<string> =>
  adaptMessageStream(client, envelope, originalText, receiverCulture, undefined, receiverPersonality, undefined, model);

const createLLMClient = (apiKey: string, baseUrl?: string): OpenAI =>
  new OpenAI({
    apiKey,
    baseURL: baseUrl ?? DEFAULT_BASE_URL,
  });

export { createLLMClient, extractSemantic, adaptMessage, extractSemanticStream, adaptMessageStream };
export type { ExtractResult };

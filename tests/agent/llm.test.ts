// Author: be-ai-integrator
import type { ChorusEnvelope, ConversationTurn } from "../../src/shared/types";
import {
  createLLMClient,
  extractSemantic,
  adaptMessage,
  extractSemanticStream,
  adaptMessageStream,
} from "../../src/agent/llm";

// --- Mock OpenAI client factory ---

const buildMockClient = (responseContent: string) => ({
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{ message: { content: responseContent } }],
      }),
    },
  },
});

const buildTimeoutClient = () => ({
  chat: {
    completions: {
      create: jest.fn().mockRejectedValue(new Error("LLM request timeout")),
    },
  },
});

// --- Tests ---

describe("createLLMClient", () => {
  test("test_case_6: creates client successfully with apiKey and default baseUrl", () => {
    const client = createLLMClient("test-api-key");
    expect(client).toBeDefined();
    expect(client.chat).toBeDefined();
    expect(client.chat.completions).toBeDefined();
  });

  test("creates client with custom baseUrl", () => {
    const client = createLLMClient("test-api-key", "https://custom.api.com/v1");
    expect(client).toBeDefined();
  });
});

describe("extractSemantic", () => {
  const validResponse = JSON.stringify({
    original_semantic: "Suggesting exercise out of health concern",
    cultural_context:
      "In Chinese culture, commenting on weight is a normal expression of care.",
    intent_type: "chitchat",
    formality: "casual",
    emotional_tone: "polite",
  });

  test("test_case_1: normal extraction — returns parsed result", async () => {
    const mockClient = buildMockClient(validResponse);

    const result = await extractSemantic(
      mockClient as any,
      "你最近胖了，多运动运动",
      "zh-CN",
    );

    expect(result.original_semantic).toBe(
      "Suggesting exercise out of health concern",
    );
    expect(result.cultural_context).toBe(
      "In Chinese culture, commenting on weight is a normal expression of care.",
    );
    expect(result.intent_type).toBe("chitchat");
    expect(result.formality).toBe("casual");
    expect(result.emotional_tone).toBe("polite");

    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
    const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArgs.model).toBe("qwen3.5-plus");
    expect(callArgs.messages).toBeDefined();
  });

  test("test_case_2: LLM returns invalid JSON — throws parse error", async () => {
    const mockClient = buildMockClient("this is not json at all");

    await expect(
      extractSemantic(mockClient as any, "hello", "en-US"),
    ).rejects.toThrow("failed to parse LLM response");
  });

  test("test_case_3: cultural_context is empty string — returns undefined", async () => {
    const responseWithEmptyContext = JSON.stringify({
      original_semantic: "Greeting",
      cultural_context: "",
      intent_type: "greeting",
      formality: "casual",
      emotional_tone: "neutral",
    });
    const mockClient = buildMockClient(responseWithEmptyContext);

    const result = await extractSemantic(mockClient as any, "hey", "en-US");

    expect(result.original_semantic).toBe("Greeting");
    expect(result.cultural_context).toBeUndefined();
  });

  test("does not mutate input parameters", async () => {
    const mockClient = buildMockClient(validResponse);
    const inputText = "你最近胖了";
    const culture = "zh-CN";

    await extractSemantic(mockClient as any, inputText, culture);

    expect(inputText).toBe("你最近胖了");
    expect(culture).toBe("zh-CN");
  });
});

describe("adaptMessage", () => {
  const envelope: ChorusEnvelope = {
    chorus_version: "0.2",
    original_semantic: "Suggesting exercise out of health concern",
    sender_culture: "zh-CN",
    cultural_context:
      "In Chinese culture, commenting on weight is a normal expression of care.",
    intent_type: "chitchat",
    formality: "casual",
    emotional_tone: "polite",
  };

  test("test_case_4: normal adaptation — returns adapted text", async () => {
    const adaptedText =
      "Hey, I've been getting into running lately — want to join sometime?";
    const mockClient = buildMockClient(adaptedText);

    const result = await adaptMessage(
      mockClient as any,
      envelope,
      "你最近胖了，多运动运动",
      "en-US",
    );

    expect(result).toBe(adaptedText);
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);

    const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
    expect(callArgs.model).toBe("qwen3.5-plus");
    expect(callArgs.messages).toBeDefined();
  });

  test("test_case_5: LLM timeout — throws error containing 'LLM request timeout'", async () => {
    const mockClient = buildTimeoutClient();

    await expect(
      adaptMessage(
        mockClient as any,
        envelope,
        "你最近胖了，多运动运动",
        "en-US",
      ),
    ).rejects.toThrow("LLM request timeout");
  });

  test("adapts with missing cultural_context gracefully", async () => {
    const envelopeNoContext: ChorusEnvelope = {
      chorus_version: "0.2",
      original_semantic: "Just a greeting",
      sender_culture: "zh-CN",
    };
    const adaptedText = "Hey there!";
    const mockClient = buildMockClient(adaptedText);

    const result = await adaptMessage(
      mockClient as any,
      envelopeNoContext,
      "你好",
      "en-US",
    );

    expect(result).toBe(adaptedText);
  });
});

// --- Streaming mock helpers ---

const buildStreamMockClient = (chunks: readonly string[]) => ({
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const text of chunks) {
            yield { choices: [{ delta: { content: text } }] };
          }
        },
      }),
    },
  },
});

const buildStreamTimeoutClient = () => ({
  chat: {
    completions: {
      create: jest.fn().mockRejectedValue(new Error("connection timeout")),
    },
  },
});

// --- extractSemanticStream ---

describe("extractSemanticStream", () => {
  const jsonPart1 = '{"original_semantic":"test meaning"';
  const jsonPart2 = ',"cultural_context":"cultural note"';
  const jsonPart3 = ',"intent_type":"greeting","formality":"casual","emotional_tone":"polite"}';

  test("calls onToken for each chunk", async () => {
    const mockClient = buildStreamMockClient([jsonPart1, jsonPart2, jsonPart3]);
    const tokens: string[] = [];

    await extractSemanticStream(
      mockClient as any,
      "hello",
      "en-US",
      (chunk: string) => { tokens.push(chunk); },
    );

    expect(tokens).toEqual([jsonPart1, jsonPart2, jsonPart3]);
  });

  test("returns valid ExtractResult from concatenated chunks", async () => {
    const mockClient = buildStreamMockClient([jsonPart1, jsonPart2, jsonPart3]);

    const result = await extractSemanticStream(
      mockClient as any,
      "hello",
      "en-US",
    );

    expect(result.original_semantic).toBe("test meaning");
    expect(result.cultural_context).toBe("cultural note");
    expect(result.intent_type).toBe("greeting");
    expect(result.formality).toBe("casual");
    expect(result.emotional_tone).toBe("polite");
  });

  test("throws on invalid JSON response", async () => {
    const mockClient = buildStreamMockClient(["not", " valid", " json"]);

    await expect(
      extractSemanticStream(mockClient as any, "hello", "en-US"),
    ).rejects.toThrow("failed to parse LLM response");
  });
});

// --- adaptMessageStream ---

describe("adaptMessageStream", () => {
  const envelope: ChorusEnvelope = {
    chorus_version: "0.2",
    original_semantic: "Suggesting exercise out of health concern",
    sender_culture: "zh-CN",
    cultural_context:
      "In Chinese culture, commenting on weight is a normal expression of care.",
    intent_type: "chitchat",
    formality: "casual",
    emotional_tone: "polite",
  };

  test("calls onChunk for each text delta", async () => {
    const mockClient = buildStreamMockClient(["Hey, ", "how are ", "you?"]);
    const chunks: string[] = [];

    await adaptMessageStream(
      mockClient as any,
      envelope,
      "你好",
      "en-US",
      undefined,
      (text: string) => { chunks.push(text); },
    );

    expect(chunks).toEqual(["Hey, ", "how are ", "you?"]);
  });

  test("returns full concatenated text", async () => {
    const mockClient = buildStreamMockClient(["Hello ", "World"]);

    const result = await adaptMessageStream(
      mockClient as any,
      envelope,
      "你好",
      "en-US",
    );

    expect(result).toBe("Hello World");
  });

  test("injects history into prompt when provided", async () => {
    const mockClient = buildStreamMockClient(["adapted reply"]);
    const history: readonly ConversationTurn[] = [
      {
        role: "sent",
        originalText: "你好",
        adaptedText: "Hello",
        envelope: { ...envelope },
        timestamp: "2026-03-19T00:00:00Z",
      },
      {
        role: "received",
        originalText: "Hi there",
        adaptedText: "你好呀",
        envelope: { ...envelope, sender_culture: "en-US" },
        timestamp: "2026-03-19T00:00:01Z",
      },
    ];

    await adaptMessageStream(
      mockClient as any,
      envelope,
      "你最近怎么样",
      "en-US",
      history,
    );

    const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content as string;
    expect(promptContent).toContain("对话历史:");
    expect(promptContent).toContain("[sent] 你好 → Hello");
    expect(promptContent).toContain("[received] Hi there → 你好呀");
  });

  test("without history produces prompt without history section", async () => {
    const mockClient = buildStreamMockClient(["adapted text"]);

    await adaptMessageStream(
      mockClient as any,
      envelope,
      "你好",
      "en-US",
    );

    const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content as string;
    expect(promptContent).not.toContain("对话历史:");
  });
});

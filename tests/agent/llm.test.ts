// Author: be-ai-integrator
import type { ChorusEnvelope, ConversationTurn } from "../../src/shared/types";
import {
  createLLMClient,
  adaptMessage,
  generateCulturalContext,
  adaptMessageStream,
} from "../../src/agent/llm";

// --- Mock: streaming async iterable ---

const buildStreamMock = (chunks: readonly string[]) => ({
  [Symbol.asyncIterator]: async function* () {
    for (const text of chunks) {
      yield { choices: [{ delta: { content: text } }] };
    }
  },
});

// Mock client that returns different responses per call
const buildMultiCallClient = (responses: readonly string[][]) => {
  const createFn = jest.fn();
  for (const chunks of responses) {
    createFn.mockResolvedValueOnce(buildStreamMock(chunks));
  }
  return { chat: { completions: { create: createFn } } };
};

const buildSingleCallClient = (chunks: readonly string[]) =>
  buildMultiCallClient([[...chunks]]);

const buildTimeoutClient = () => ({
  chat: {
    completions: {
      create: jest.fn().mockRejectedValue(new Error("LLM request timeout")),
    },
  },
});

// --- generateCulturalContext (single LLM call) ---

describe("generateCulturalContext", () => {
  test("returns cultural_context from LLM call", async () => {
    const mockClient = buildSingleCallClient(
      ["中国文化中直接评论体重是亲近关系的关心表达"],
    );

    const result = await generateCulturalContext(mockClient as any, "你最近胖了", "zh-CN");

    expect(result.cultural_context).toBe("中国文化中直接评论体重是亲近关系的关心表达");
    expect(mockClient.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  test("cultural_context too short is dropped", async () => {
    const mockClient = buildSingleCallClient(["short"]);

    const result = await generateCulturalContext(mockClient as any, "hi", "en-US");

    expect(result.cultural_context).toBeUndefined();
  });

  test("calls onToken during generation", async () => {
    const mockClient = buildSingleCallClient(["文化", "背景", "说明长文本"]);
    const tokens: string[] = [];

    await generateCulturalContext(
      mockClient as any,
      "test",
      "zh-CN",
      (chunk: string) => { tokens.push(chunk); },
    );

    expect(tokens).toEqual(["文化", "背景", "说明长文本"]);
  });
});

// --- adaptMessage ---

describe("adaptMessage", () => {
  const envelope: ChorusEnvelope = {
    chorus_version: "0.4",
    sender_id: "alice@example.com",
    original_text: "关心对方健康",
    sender_culture: "zh-CN",
    cultural_context: "中国文化中直接评论体重是亲近关系的关心表达不带恶意",
  };

  test("returns adapted text", async () => {
    const mockClient = buildSingleCallClient(["I hope you're", " taking care of yourself!"]);

    const result = await adaptMessage(mockClient as any, envelope, "en-US");

    expect(result).toBe("I hope you're taking care of yourself!");
  });

  test("timeout throws LLM request timeout", async () => {
    const mockClient = buildTimeoutClient();

    await expect(
      adaptMessage(mockClient as any, envelope, "en-US"),
    ).rejects.toThrow("LLM request timeout");
  });
});

// --- adaptMessageStream ---

describe("adaptMessageStream", () => {
  const envelope: ChorusEnvelope = {
    chorus_version: "0.4",
    sender_id: "alice@example.com",
    original_text: "test",
    sender_culture: "zh-CN",
  };

  test("calls onChunk for each delta", async () => {
    const mockClient = buildSingleCallClient(["Hey, ", "how are ", "you?"]);
    const chunks: string[] = [];

    await adaptMessageStream(
      mockClient as any,
      envelope,
      "en-US",
      undefined,
      undefined,
      (text: string) => { chunks.push(text); },
    );

    expect(chunks).toEqual(["Hey, ", "how are ", "you?"]);
  });

  test("injects history into prompt", async () => {
    const mockClient = buildSingleCallClient(["adapted reply"]);
    const history: readonly ConversationTurn[] = [
      {
        role: "sent",
        originalText: "你好",
        adaptedText: "Hello",
        envelope: { ...envelope },
        timestamp: "2026-03-19T00:00:00Z",
      },
    ];

    await adaptMessageStream(
      mockClient as any,
      envelope,
      "en-US",
      history,
    );

    const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content as string;
    expect(promptContent).toContain("对话历史:");
    expect(promptContent).toContain("[sent] 你好 → Hello");
  });

  test("without history omits history section", async () => {
    const mockClient = buildSingleCallClient(["adapted"]);

    await adaptMessageStream(mockClient as any, envelope, "en-US");

    const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
    const promptContent = callArgs.messages[0].content as string;
    expect(promptContent).not.toContain("对话历史:");
  });
});

// --- createLLMClient ---

describe("createLLMClient", () => {
  test("creates client with default base URL", () => {
    const client = createLLMClient("test-key");
    expect(client).toBeDefined();
  });

  test("creates client with custom base URL", () => {
    const client = createLLMClient("test-key", "https://custom.api.com/v1");
    expect(client).toBeDefined();
  });
});

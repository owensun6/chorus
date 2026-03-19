// Author: be-ai-integrator
import type { ChorusEnvelope } from "../../src/shared/types";
import {
  createLLMClient,
  extractSemantic,
  adaptMessage,
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
    expect(callArgs.model).toBe("qwen-plus");
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
    expect(callArgs.model).toBe("qwen-plus");
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

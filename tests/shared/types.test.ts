// Author: be-domain-modeler
import {
  ChorusEnvelopeSchema,
  ChorusAgentCardSchema,
} from "../../src/shared/types";

describe("ChorusEnvelope v0.4", () => {
  const validEnvelope = {
    chorus_version: "0.4" as const,
    sender_id: "alice@chorus.example",
    original_text: "出于关心对方健康的目的，建议对方多运动",
    sender_culture: "zh-CN",
    cultural_context:
      "中国文化中，直接评论体重是亲近关系的日常关心表达，通常不带恶意。",
  };

  test("test_case_1: all required fields pass validation", () => {
    const result = ChorusEnvelopeSchema.parse(validEnvelope);
    expect(result.chorus_version).toBe("0.4");
    expect(result.sender_id).toBe("alice@chorus.example");
    expect(result.original_text).toBe(validEnvelope.original_text);
    expect(result.sender_culture).toBe("zh-CN");
    expect(result.cultural_context).toBe(validEnvelope.cultural_context);
  });

  test("test_case_2: missing original_text is rejected", () => {
    const { original_text: _, ...invalid } = validEnvelope;
    expect(() => ChorusEnvelopeSchema.parse(invalid)).toThrow();
  });

  test("missing sender_id is rejected", () => {
    const { sender_id: _, ...invalid } = validEnvelope;
    expect(() => ChorusEnvelopeSchema.parse(invalid)).toThrow();
  });

  test("sender_id without @ is rejected", () => {
    const invalid = { ...validEnvelope, sender_id: "alice-no-host" };
    expect(() => ChorusEnvelopeSchema.parse(invalid)).toThrow();
  });

  test("test_sender_id_max_length: 128-char sender_id passes, 129-char fails", () => {
    // 62 + '@' + 65 = 128 chars — at the limit
    const id128 = "a".repeat(62) + "@" + "b".repeat(65);
    expect(id128.length).toBe(128);
    const valid = { ...validEnvelope, sender_id: id128 };
    expect(() => ChorusEnvelopeSchema.parse(valid)).not.toThrow();

    // 63 + '@' + 65 = 129 chars — one over the limit
    const id129 = "a".repeat(63) + "@" + "b".repeat(65);
    expect(id129.length).toBe(129);
    const invalid = { ...validEnvelope, sender_id: id129 };
    expect(() => ChorusEnvelopeSchema.parse(invalid)).toThrow();
  });

  test("test_case_3: cultural_context too short is rejected", () => {
    const invalid = { ...validEnvelope, cultural_context: "short" };
    expect(() => ChorusEnvelopeSchema.parse(invalid)).toThrow();
  });

  test("test_case_4: cultural_context too long is rejected", () => {
    const invalid = { ...validEnvelope, cultural_context: "x".repeat(501) };
    expect(() => ChorusEnvelopeSchema.parse(invalid)).toThrow();
  });

  test("allows additional properties (passthrough)", () => {
    const extended = { ...validEnvelope, future_field: "hello" };
    const result = ChorusEnvelopeSchema.parse(extended);
    expect((result as Record<string, unknown>).future_field).toBe("hello");
  });

  test("parse returns new object (immutability)", () => {
    const input = { ...validEnvelope };
    const output = ChorusEnvelopeSchema.parse(input);
    expect(output).not.toBe(input);
  });

  test("conversation_id and turn_number are optional", () => {
    const withOptionals = {
      ...validEnvelope,
      conversation_id: "conv-123",
      turn_number: 3,
    };
    const result = ChorusEnvelopeSchema.parse(withOptionals);
    expect(result.conversation_id).toBe("conv-123");
    expect(result.turn_number).toBe(3);
  });

  test("conversation_id exceeding 64 chars rejected", () => {
    const invalid = {
      ...validEnvelope,
      conversation_id: "x".repeat(65),
    };
    expect(() => ChorusEnvelopeSchema.parse(invalid)).toThrow();
  });

  test("turn_number = 0 rejected, turn_number = 1 accepted", () => {
    expect(() =>
      ChorusEnvelopeSchema.parse({ ...validEnvelope, turn_number: 0 })
    ).toThrow();
    const valid = ChorusEnvelopeSchema.parse({ ...validEnvelope, turn_number: 1 });
    expect(valid.turn_number).toBe(1);
  });

  test("rejects old versions (0.2, 0.3)", () => {
    expect(() =>
      ChorusEnvelopeSchema.parse({ ...validEnvelope, chorus_version: "0.2" })
    ).toThrow();
    expect(() =>
      ChorusEnvelopeSchema.parse({ ...validEnvelope, chorus_version: "0.3" })
    ).toThrow();
  });
});

describe("ChorusAgentCard v0.3", () => {
  const validCard = {
    card_version: "0.3" as const,
    user_culture: "zh-CN",
    supported_languages: ["zh-CN", "ja", "en"],
  };

  test("test_case_5: valid card passes", () => {
    const result = ChorusAgentCardSchema.parse(validCard);
    expect(result.card_version).toBe("0.3");
    expect(result.user_culture).toBe("zh-CN");
    expect(result.supported_languages).toEqual(["zh-CN", "ja", "en"]);
  });

  test("rejects empty supported_languages", () => {
    const invalid = { ...validCard, supported_languages: [] };
    expect(() => ChorusAgentCardSchema.parse(invalid)).toThrow();
  });
});

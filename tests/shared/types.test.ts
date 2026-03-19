// Author: be-domain-modeler
import { readFileSync } from "fs";
import { join } from "path";
import {
  ChorusEnvelopeSchema,
  ChorusAgentCardSchema,
  CHORUS_MEDIA_TYPE,
} from "../../src/shared/types";

describe("ChorusEnvelope v0.2", () => {
  const validEnvelope = {
    chorus_version: "0.2" as const,
    original_semantic: "出于关心对方健康的目的，建议对方多运动",
    sender_culture: "zh-CN",
    cultural_context:
      "中国文化中，直接评论体重是亲近关系的日常关心表达，通常不带恶意。",
    intent_type: "chitchat" as const,
    formality: "casual" as const,
    emotional_tone: "polite" as const,
  };

  test("test_case_1: all required fields pass validation", () => {
    const result = ChorusEnvelopeSchema.parse(validEnvelope);
    expect(result.chorus_version).toBe("0.2");
    expect(result.original_semantic).toBe(validEnvelope.original_semantic);
    expect(result.sender_culture).toBe("zh-CN");
    expect(result.cultural_context).toBe(validEnvelope.cultural_context);
  });

  test("test_case_2: missing original_semantic is rejected", () => {
    const { original_semantic: _, ...invalid } = validEnvelope;
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
});

describe("ChorusAgentCard v0.2", () => {
  const validCard = {
    chorus_version: "0.2" as const,
    user_culture: "zh-CN",
    supported_languages: ["zh-CN", "ja", "en"],
  };

  test("test_case_5: valid card without communication_preferences passes", () => {
    const result = ChorusAgentCardSchema.parse(validCard);
    expect(result.chorus_version).toBe("0.2");
    expect(result.user_culture).toBe("zh-CN");
    expect(result.supported_languages).toEqual(["zh-CN", "ja", "en"]);
  });

  test("rejects empty supported_languages", () => {
    const invalid = { ...validCard, supported_languages: [] };
    expect(() => ChorusAgentCardSchema.parse(invalid)).toThrow();
  });
});

describe("ChorusEnvelope v0.3", () => {
  test("v0.3 envelope with conversation_id and turn_number passes", () => {
    const v03 = {
      chorus_version: "0.3" as const,
      original_semantic: "test",
      sender_culture: "zh-CN",
      conversation_id: "conv-123",
      turn_number: 3,
    };
    const result = ChorusEnvelopeSchema.parse(v03);
    expect(result.conversation_id).toBe("conv-123");
    expect(result.turn_number).toBe(3);
  });

  test("v0.2 envelope without new fields still passes", () => {
    const v02 = {
      chorus_version: "0.2" as const,
      original_semantic: "test",
      sender_culture: "ja",
    };
    const result = ChorusEnvelopeSchema.parse(v02);
    expect(result.chorus_version).toBe("0.2");
    expect(result.conversation_id).toBeUndefined();
  });

  test("conversation_id exceeding 64 chars rejected", () => {
    const invalid = {
      chorus_version: "0.3",
      original_semantic: "test",
      sender_culture: "zh-CN",
      conversation_id: "x".repeat(65),
    };
    expect(() => ChorusEnvelopeSchema.parse(invalid)).toThrow();
  });

  test("turn_number = 0 rejected, turn_number = 1 accepted", () => {
    const base = {
      chorus_version: "0.3",
      original_semantic: "test",
      sender_culture: "zh-CN",
    };
    expect(() => ChorusEnvelopeSchema.parse({ ...base, turn_number: 0 })).toThrow();
    const valid = ChorusEnvelopeSchema.parse({ ...base, turn_number: 1 });
    expect(valid.turn_number).toBe(1);
  });
});

describe("JSON Schema files v0.3", () => {
  test("chorus-envelope.schema.json is v0.3", () => {
    const raw = readFileSync(
      join(__dirname, "../../spec/chorus-envelope.schema.json"),
      "utf-8",
    );
    const schema = JSON.parse(raw);
    expect(schema.$id).toContain("v0.3");
    expect(schema.properties.chorus_version.enum).toEqual(["0.2", "0.3"]);
    expect(schema.properties.conversation_id).toBeDefined();
    expect(schema.properties.turn_number).toBeDefined();
    expect(schema.additionalProperties).toBe(true);
  });

  test("chorus-agent-card.schema.json is v0.2", () => {
    const raw = readFileSync(
      join(__dirname, "../../spec/chorus-agent-card.schema.json"),
      "utf-8",
    );
    const schema = JSON.parse(raw);
    expect(schema.$id).toContain("v0.2");
    expect(schema.properties.chorus_version.const).toBe("0.2");
    expect(schema.additionalProperties).toBe(true);
  });
});

describe("CHORUS_MEDIA_TYPE constant", () => {
  test("has correct value", () => {
    expect(CHORUS_MEDIA_TYPE).toBe("application/vnd.chorus.envelope+json");
  });
});

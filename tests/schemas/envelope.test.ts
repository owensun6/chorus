// Author: be-domain-modeler
import { ChorusEnvelopeSchema } from "../../src/schemas/envelope";
import type { ChorusEnvelope } from "../../src/schemas/envelope";

describe("ChorusEnvelopeSchema", () => {
  const validFull: ChorusEnvelope = {
    chorus_version: "0.1",
    original_semantic: "Request a meeting, polite tone, non-urgent",
    sender_culture: "zh-CN",
    intent_type: "request",
    formality: "semi-formal",
    emotional_tone: "polite",
    relationship_level: "colleague",
  };

  const validRequired: ChorusEnvelope = {
    chorus_version: "0.1",
    original_semantic: "Simple greeting",
    sender_culture: "en-US",
  };

  describe("valid envelopes", () => {
    it("parses envelope with all fields", () => {
      const result = ChorusEnvelopeSchema.safeParse(validFull);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.chorus_version).toBe("0.1");
        expect(result.data.intent_type).toBe("request");
        expect(result.data.formality).toBe("semi-formal");
        expect(result.data.emotional_tone).toBe("polite");
        expect(result.data.relationship_level).toBe("colleague");
      }
    });

    it("parses envelope with only required fields", () => {
      const result = ChorusEnvelopeSchema.safeParse(validRequired);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.chorus_version).toBe("0.1");
        expect(result.data.original_semantic).toBe("Simple greeting");
        expect(result.data.sender_culture).toBe("en-US");
        expect(result.data.intent_type).toBeUndefined();
        expect(result.data.formality).toBeUndefined();
        expect(result.data.emotional_tone).toBeUndefined();
        expect(result.data.relationship_level).toBeUndefined();
      }
    });

    it("accepts various valid BCP47 tags", () => {
      const tags = ["en", "zh-CN", "ja", "pt-BR", "zh-Hant-TW", "kor"];
      for (const tag of tags) {
        const result = ChorusEnvelopeSchema.safeParse({
          ...validRequired,
          sender_culture: tag,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("missing required fields", () => {
    it("rejects missing chorus_version", () => {
      const { chorus_version, ...rest } = validRequired;
      const result = ChorusEnvelopeSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects missing original_semantic", () => {
      const { original_semantic, ...rest } = validRequired;
      const result = ChorusEnvelopeSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects missing sender_culture", () => {
      const { sender_culture, ...rest } = validRequired;
      const result = ChorusEnvelopeSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe("invalid field values", () => {
    it("rejects wrong chorus_version", () => {
      const result = ChorusEnvelopeSchema.safeParse({
        ...validRequired,
        chorus_version: "0.2",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty original_semantic", () => {
      const result = ChorusEnvelopeSchema.safeParse({
        ...validRequired,
        original_semantic: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid BCP47 sender_culture", () => {
      const invalidTags = ["123", "EN-us", "zh_CN", "", "x"];
      for (const tag of invalidTags) {
        const result = ChorusEnvelopeSchema.safeParse({
          ...validRequired,
          sender_culture: tag,
        });
        expect(result.success).toBe(false);
      }
    });

    it("rejects invalid intent_type", () => {
      const result = ChorusEnvelopeSchema.safeParse({
        ...validRequired,
        intent_type: "unknown_intent",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid formality", () => {
      const result = ChorusEnvelopeSchema.safeParse({
        ...validRequired,
        formality: "very-formal",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid emotional_tone", () => {
      const result = ChorusEnvelopeSchema.safeParse({
        ...validRequired,
        emotional_tone: "angry",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid relationship_level", () => {
      const result = ChorusEnvelopeSchema.safeParse({
        ...validRequired,
        relationship_level: "stranger",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("forward compatibility", () => {
    it("ignores unknown optional fields (strips by default)", () => {
      const result = ChorusEnvelopeSchema.safeParse({
        ...validRequired,
        future_field: "some_value",
        another_unknown: 42,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty("future_field");
        expect(result.data).not.toHaveProperty("another_unknown");
      }
    });
  });
});

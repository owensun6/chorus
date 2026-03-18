// Author: be-domain-modeler
import { ChorusAgentCardSchema } from "../../src/schemas/agent-card";
import type { ChorusAgentCard } from "../../src/schemas/agent-card";

describe("ChorusAgentCardSchema", () => {
  const validFull: ChorusAgentCard = {
    chorus_version: "0.1",
    user_culture: "zh-CN",
    supported_languages: ["zh-CN", "en", "ja"],
    communication_preferences: {
      directness: "direct",
      formality_default: "semi-formal",
    },
  };

  const validRequired: ChorusAgentCard = {
    chorus_version: "0.1",
    user_culture: "en-US",
    supported_languages: ["en"],
  };

  describe("valid agent cards", () => {
    it("parses card with all fields", () => {
      const result = ChorusAgentCardSchema.safeParse(validFull);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.chorus_version).toBe("0.1");
        expect(result.data.user_culture).toBe("zh-CN");
        expect(result.data.supported_languages).toEqual(["zh-CN", "en", "ja"]);
        expect(result.data.communication_preferences?.directness).toBe("direct");
        expect(result.data.communication_preferences?.formality_default).toBe(
          "semi-formal"
        );
      }
    });

    it("parses card with only required fields", () => {
      const result = ChorusAgentCardSchema.safeParse(validRequired);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.chorus_version).toBe("0.1");
        expect(result.data.user_culture).toBe("en-US");
        expect(result.data.supported_languages).toEqual(["en"]);
        expect(result.data.communication_preferences).toBeUndefined();
      }
    });

    it("accepts card with partial communication_preferences", () => {
      const result = ChorusAgentCardSchema.safeParse({
        ...validRequired,
        communication_preferences: { directness: "adaptive" },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.communication_preferences?.directness).toBe("adaptive");
        expect(
          result.data.communication_preferences?.formality_default
        ).toBeUndefined();
      }
    });

    it("accepts card with empty communication_preferences object", () => {
      const result = ChorusAgentCardSchema.safeParse({
        ...validRequired,
        communication_preferences: {},
      });
      expect(result.success).toBe(true);
    });
  });

  describe("missing required fields", () => {
    it("rejects missing chorus_version", () => {
      const { chorus_version, ...rest } = validRequired;
      const result = ChorusAgentCardSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects missing user_culture", () => {
      const { user_culture, ...rest } = validRequired;
      const result = ChorusAgentCardSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects missing supported_languages", () => {
      const { supported_languages, ...rest } = validRequired;
      const result = ChorusAgentCardSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe("invalid field values", () => {
    it("rejects empty supported_languages array", () => {
      const result = ChorusAgentCardSchema.safeParse({
        ...validRequired,
        supported_languages: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid user_culture BCP47", () => {
      const result = ChorusAgentCardSchema.safeParse({
        ...validRequired,
        user_culture: "INVALID",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid directness value", () => {
      const result = ChorusAgentCardSchema.safeParse({
        ...validRequired,
        communication_preferences: { directness: "very-direct" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid formality_default value", () => {
      const result = ChorusAgentCardSchema.safeParse({
        ...validRequired,
        communication_preferences: { formality_default: "ultra-formal" },
      });
      expect(result.success).toBe(false);
    });

    it("rejects wrong chorus_version", () => {
      const result = ChorusAgentCardSchema.safeParse({
        ...validRequired,
        chorus_version: "1.0",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("forward compatibility", () => {
    it("ignores unknown top-level fields", () => {
      const result = ChorusAgentCardSchema.safeParse({
        ...validRequired,
        future_extension: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty("future_extension");
      }
    });
  });
});

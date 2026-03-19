// Author: be-domain-modeler
import { ZodError } from "zod";
import {
  createEnvelope,
  createChorusMessage,
  findChorusDataPart,
  parseEnvelope,
} from "../../src/agent/envelope";
import {
  CHORUS_MEDIA_TYPE,
  CHORUS_EXTENSION_URI,
} from "../../src/shared/types";
import type { A2AMessage, ChorusEnvelope } from "../../src/shared/types";

describe("envelope pure functions", () => {
  // --- createEnvelope ---

  describe("createEnvelope", () => {
    it("returns a complete envelope with cultural_context and extras", () => {
      const env = createEnvelope("Hello", "en-US", "Business meeting context here", {
        intent_type: "greeting",
        formality: "formal",
        emotional_tone: "polite",
      });

      expect(env).toEqual({
        chorus_version: "0.2",
        original_semantic: "Hello",
        sender_culture: "en-US",
        cultural_context: "Business meeting context here",
        intent_type: "greeting",
        formality: "formal",
        emotional_tone: "polite",
      });
    });

    it("returns a degraded envelope without cultural_context", () => {
      const env = createEnvelope("Bonjour", "fr-FR");

      expect(env).toEqual({
        chorus_version: "0.2",
        original_semantic: "Bonjour",
        sender_culture: "fr-FR",
      });
      expect(env.cultural_context).toBeUndefined();
      expect(env.intent_type).toBeUndefined();
      expect(env.formality).toBeUndefined();
      expect(env.emotional_tone).toBeUndefined();
    });

    it("does not mutate the extras object", () => {
      const extras = { intent_type: "request" as const };
      const env = createEnvelope("Test", "ja-JP", undefined, extras);

      expect(env.intent_type).toBe("request");
      expect(Object.keys(extras)).toEqual(["intent_type"]);
    });
  });

  // --- createChorusMessage ---

  describe("createChorusMessage", () => {
    it("creates A2AMessage with 2 parts and correct structure", () => {
      const envelope: ChorusEnvelope = {
        chorus_version: "0.2",
        original_semantic: "Hi",
        sender_culture: "en-US",
      };

      const msg = createChorusMessage("Hi there", envelope);

      expect(msg.role).toBe("ROLE_USER");
      expect(msg.parts).toHaveLength(2);

      // Part 0: TextPart
      const textPart = msg.parts[0];
      expect(textPart).toEqual({
        text: "Hi there",
        mediaType: "text/plain",
      });

      // Part 1: DataPart with Chorus envelope
      const dataPart = msg.parts[1];
      expect(dataPart).toEqual({
        data: envelope,
        mediaType: CHORUS_MEDIA_TYPE,
      });

      // Extensions
      expect(msg.extensions).toEqual([CHORUS_EXTENSION_URI]);
    });
  });

  // --- findChorusDataPart ---

  describe("findChorusDataPart", () => {
    it("extracts envelope from a valid A2AMessage", () => {
      const envelope: ChorusEnvelope = {
        chorus_version: "0.2",
        original_semantic: "Test",
        sender_culture: "zh-CN",
      };

      const message: A2AMessage = {
        role: "ROLE_USER",
        parts: [
          { text: "Test text", mediaType: "text/plain" },
          { data: { ...envelope }, mediaType: CHORUS_MEDIA_TYPE },
        ],
        extensions: [CHORUS_EXTENSION_URI],
      };

      const result = findChorusDataPart(message);

      expect(result.status).toBe("found");
      if (result.status === "found") {
        expect(result.envelope).toEqual(envelope);
      }
    });

    it("returns not_found when no Chorus DataPart exists", () => {
      const message: A2AMessage = {
        role: "ROLE_USER",
        parts: [{ text: "Plain message", mediaType: "text/plain" }],
      };

      const result = findChorusDataPart(message);

      expect(result.status).toBe("not_found");
    });

    it("returns not_found when DataPart has wrong mediaType", () => {
      const message: A2AMessage = {
        role: "ROLE_USER",
        parts: [
          { text: "Hello", mediaType: "text/plain" },
          { data: { some: "data" }, mediaType: "application/json" },
        ],
      };

      const result = findChorusDataPart(message);

      expect(result.status).toBe("not_found");
    });

    it("returns invalid when DataPart data fails schema validation", () => {
      const message: A2AMessage = {
        role: "ROLE_USER",
        parts: [
          {
            data: { chorus_version: "9.9", invalid_field: true },
            mediaType: CHORUS_MEDIA_TYPE,
          },
        ],
      };

      const result = findChorusDataPart(message);

      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toBeDefined();
      }
    });
  });

  // --- parseEnvelope ---

  describe("parseEnvelope", () => {
    it("parses valid envelope data", () => {
      const data = {
        chorus_version: "0.2",
        original_semantic: "Hola",
        sender_culture: "es-ES",
        intent_type: "greeting",
      };

      const result = parseEnvelope(data);

      expect(result).toEqual(data);
    });

    it("rejects invalid data with ZodError", () => {
      const badData = {
        chorus_version: "1.0",
        original_semantic: "",
      };

      expect(() => parseEnvelope(badData)).toThrow(ZodError);
    });

    it("rejects data missing required fields", () => {
      expect(() => parseEnvelope({})).toThrow(ZodError);
    });

    it("rejects data with invalid sender_culture format", () => {
      const badCulture = {
        chorus_version: "0.2",
        original_semantic: "Test",
        sender_culture: "not-a-bcp47",
      };

      expect(() => parseEnvelope(badCulture)).toThrow(ZodError);
    });
  });

  // --- v0.3 envelope support ---

  describe("createEnvelope v0.3 auto-detection", () => {
    it("produces v0.3 when conversation_id and turn_number are provided", () => {
      const env = createEnvelope("Hello", "en-US", undefined, {
        conversation_id: "conv-abc-123",
        turn_number: 1,
      });

      expect(env).toEqual({
        chorus_version: "0.3",
        original_semantic: "Hello",
        sender_culture: "en-US",
        conversation_id: "conv-abc-123",
        turn_number: 1,
      });
    });

    it("produces v0.3 when only conversation_id is provided", () => {
      const env = createEnvelope("Hola", "es-ES", undefined, {
        conversation_id: "conv-xyz",
      });

      expect(env.chorus_version).toBe("0.3");
      expect(env.conversation_id).toBe("conv-xyz");
      expect(env.turn_number).toBeUndefined();
    });

    it("produces v0.3 when only turn_number is provided", () => {
      const env = createEnvelope("Bonjour", "fr-FR", undefined, {
        turn_number: 5,
      });

      expect(env.chorus_version).toBe("0.3");
      expect(env.turn_number).toBe(5);
      expect(env.conversation_id).toBeUndefined();
    });

    it("produces v0.2 when no v0.3 fields are provided", () => {
      const env = createEnvelope("Ciao", "it-IT", undefined, {
        intent_type: "greeting",
      });

      expect(env.chorus_version).toBe("0.2");
      expect(env.conversation_id).toBeUndefined();
      expect(env.turn_number).toBeUndefined();
    });

    it("produces v0.3 with all extras combined", () => {
      const env = createEnvelope("Hi", "en-US", "Team standup context", {
        intent_type: "information",
        formality: "semi-formal",
        emotional_tone: "neutral",
        conversation_id: "conv-full",
        turn_number: 3,
      });

      expect(env).toEqual({
        chorus_version: "0.3",
        original_semantic: "Hi",
        sender_culture: "en-US",
        cultural_context: "Team standup context",
        intent_type: "information",
        formality: "semi-formal",
        emotional_tone: "neutral",
        conversation_id: "conv-full",
        turn_number: 3,
      });
    });
  });

  describe("parseEnvelope v0.3", () => {
    it("parses valid v0.3 data with conversation_id and turn_number", () => {
      const data = {
        chorus_version: "0.3",
        original_semantic: "Test v0.3",
        sender_culture: "ja-JP",
        conversation_id: "conv-parse-test",
        turn_number: 2,
      };

      const result = parseEnvelope(data);

      expect(result).toEqual(data);
    });

    it("still parses valid v0.2 data (backward compat)", () => {
      const data = {
        chorus_version: "0.2",
        original_semantic: "Legacy",
        sender_culture: "de-DE",
      };

      const result = parseEnvelope(data);

      expect(result).toEqual(data);
    });
  });

  describe("findChorusDataPart v0.3", () => {
    it("extracts v0.3 envelope from A2AMessage", () => {
      const envelope: ChorusEnvelope = {
        chorus_version: "0.3",
        original_semantic: "Multi-turn",
        sender_culture: "zh-CN",
        conversation_id: "conv-find-test",
        turn_number: 4,
      };

      const message: A2AMessage = {
        role: "ROLE_USER",
        parts: [
          { text: "Multi-turn text", mediaType: "text/plain" },
          { data: { ...envelope }, mediaType: CHORUS_MEDIA_TYPE },
        ],
        extensions: [CHORUS_EXTENSION_URI],
      };

      const result = findChorusDataPart(message);

      expect(result.status).toBe("found");
      if (result.status === "found") {
        expect(result.envelope).toEqual(envelope);
        expect(result.envelope.conversation_id).toBe("conv-find-test");
        expect(result.envelope.turn_number).toBe(4);
      }
    });
  });
});

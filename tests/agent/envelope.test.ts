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

      expect(result).toEqual(envelope);
    });

    it("returns null when no Chorus DataPart exists", () => {
      const message: A2AMessage = {
        role: "ROLE_USER",
        parts: [{ text: "Plain message", mediaType: "text/plain" }],
      };

      const result = findChorusDataPart(message);

      expect(result).toBeNull();
    });

    it("returns null when DataPart has wrong mediaType", () => {
      const message: A2AMessage = {
        role: "ROLE_USER",
        parts: [
          { text: "Hello", mediaType: "text/plain" },
          { data: { some: "data" }, mediaType: "application/json" },
        ],
      };

      const result = findChorusDataPart(message);

      expect(result).toBeNull();
    });

    it("returns null when DataPart data fails schema validation", () => {
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

      expect(result).toBeNull();
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
});

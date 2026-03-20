// Author: be-domain-modeler
import { ZodError } from "zod";
import {
  createEnvelope,
  validateEnvelopeData,
  parseEnvelope,
} from "../../src/agent/envelope";
import type { ChorusEnvelope } from "../../src/shared/types";

describe("envelope pure functions", () => {
  // --- createEnvelope ---

  describe("createEnvelope", () => {
    it("returns a v0.4 envelope with all fields", () => {
      const env = createEnvelope(
        "alice@chorus.example",
        "Hello there",
        "en-US",
        "Business meeting context here",
        { conversation_id: "conv-1", turn_number: 1 },
      );

      expect(env).toEqual({
        chorus_version: "0.4",
        sender_id: "alice@chorus.example",
        original_text: "Hello there",
        sender_culture: "en-US",
        cultural_context: "Business meeting context here",
        conversation_id: "conv-1",
        turn_number: 1,
      });
    });

    it("returns envelope without optional fields", () => {
      const env = createEnvelope("bob@example.com", "Bonjour", "fr-FR");

      expect(env).toEqual({
        chorus_version: "0.4",
        sender_id: "bob@example.com",
        original_text: "Bonjour",
        sender_culture: "fr-FR",
      });
      expect(env.cultural_context).toBeUndefined();
      expect(env.conversation_id).toBeUndefined();
      expect(env.turn_number).toBeUndefined();
    });

    it("does not mutate the extras object", () => {
      const extras = { conversation_id: "conv-x" };
      createEnvelope("a@b", "Test", "ja", undefined, extras);
      expect(Object.keys(extras)).toEqual(["conversation_id"]);
    });
  });

  // --- validateEnvelopeData ---

  describe("validateEnvelopeData", () => {
    it("validates a correct v0.4 envelope", () => {
      const data = {
        chorus_version: "0.4",
        sender_id: "alice@example.com",
        original_text: "Test",
        sender_culture: "zh-CN",
      };

      const result = validateEnvelopeData(data);
      expect(result.status).toBe("found");
      if (result.status === "found") {
        expect(result.envelope.sender_id).toBe("alice@example.com");
      }
    });

    it("returns not_found for null input", () => {
      const result = validateEnvelopeData(null);
      expect(result.status).toBe("not_found");
    });

    it("returns not_found for undefined input", () => {
      const result = validateEnvelopeData(undefined);
      expect(result.status).toBe("not_found");
    });

    it("returns invalid for bad data", () => {
      const result = validateEnvelopeData({ chorus_version: "9.9" });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.error).toBeDefined();
      }
    });
  });

  // --- parseEnvelope ---

  describe("parseEnvelope", () => {
    it("parses valid v0.4 envelope data", () => {
      const data = {
        chorus_version: "0.4",
        sender_id: "test@host",
        original_text: "Hola",
        sender_culture: "es-ES",
      };

      const result = parseEnvelope(data);
      expect(result).toEqual(data);
    });

    it("rejects invalid data with ZodError", () => {
      const badData = {
        chorus_version: "1.0",
        original_text: "",
      };
      expect(() => parseEnvelope(badData)).toThrow(ZodError);
    });

    it("rejects data missing required fields", () => {
      expect(() => parseEnvelope({})).toThrow(ZodError);
    });

    it("rejects data with invalid sender_culture format", () => {
      const badCulture = {
        chorus_version: "0.4",
        sender_id: "a@b",
        original_text: "Test",
        sender_culture: "not-a-bcp47",
      };
      expect(() => parseEnvelope(badCulture)).toThrow(ZodError);
    });

    it("rejects data with invalid sender_id format", () => {
      const badSenderId = {
        chorus_version: "0.4",
        sender_id: "no-at-sign",
        original_text: "Test",
        sender_culture: "en-US",
      };
      expect(() => parseEnvelope(badSenderId)).toThrow(ZodError);
    });
  });
});

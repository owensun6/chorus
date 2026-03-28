// Author: be-domain-modeler
// Drift detector: ensures JSON schema files stay in sync with Zod runtime schema.
import { readFileSync } from "fs";
import { resolve } from "path";
import { ChorusEnvelopeSchema } from "../../src/shared/types";

const loadJsonSchema = (relPath: string) =>
  JSON.parse(readFileSync(resolve(__dirname, "../../", relPath), "utf-8"));

describe("Zod ↔ JSON Schema sync", () => {
  const jsonSchema = loadJsonSchema("packages/chorus-skill/envelope.schema.json");
  const templateSchema = loadJsonSchema("packages/chorus-skill/templates/shared/envelope.schema.json");

  test("JSON schema additionalProperties matches Zod strict mode", () => {
    // Zod .strict() rejects unknown keys → JSON schema must be additionalProperties: false
    expect(jsonSchema.additionalProperties).toBe(false);
    expect(templateSchema.additionalProperties).toBe(false);
  });

  test("JSON schema original_text maxLength matches Zod behavior", () => {
    const jsonMax = jsonSchema.properties.original_text.maxLength;
    expect(jsonMax).toBeDefined();
    expect(templateSchema.properties.original_text.maxLength).toBe(jsonMax);

    // Verify Zod accepts text at the JSON schema limit
    const atLimit = { chorus_version: "0.4" as const, sender_id: "a@b", original_text: "x".repeat(jsonMax), sender_culture: "en" };
    expect(ChorusEnvelopeSchema.safeParse(atLimit).success).toBe(true);

    // Verify Zod rejects text exceeding the JSON schema limit
    const overLimit = { ...atLimit, original_text: "x".repeat(jsonMax + 1) };
    expect(ChorusEnvelopeSchema.safeParse(overLimit).success).toBe(false);
  });

  test("both JSON schema files are identical", () => {
    expect(JSON.stringify(jsonSchema)).toBe(JSON.stringify(templateSchema));
  });

  test("JSON schema required fields match Zod required keys", () => {
    // Zod .strict() object: all non-optional keys are required
    const zodRequired = Object.entries(ChorusEnvelopeSchema.shape)
      .filter(([, v]) => !(v as { isOptional: () => boolean }).isOptional())
      .map(([k]) => k)
      .sort();
    const jsonRequired = [...jsonSchema.required].sort();
    expect(jsonRequired).toEqual(zodRequired);
  });
});

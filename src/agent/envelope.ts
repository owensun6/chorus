// Author: be-domain-modeler
import {
  ChorusEnvelopeSchema,
} from "../shared/types";
import type {
  ChorusEnvelope,
} from "../shared/types";

/**
 * Optional fields that can be attached to a ChorusEnvelope.
 */
interface EnvelopeExtras {
  readonly conversation_id?: string;
  readonly turn_number?: number;
}

/**
 * Creates a v0.4 ChorusEnvelope.
 * Pure function — returns a new object every call, never mutates inputs.
 */
const createEnvelope = (
  senderId: string,
  originalText: string,
  culture: string,
  culturalContext?: string,
  extras?: EnvelopeExtras,
): ChorusEnvelope => ({
  chorus_version: "0.4",
  sender_id: senderId,
  original_text: originalText,
  sender_culture: culture,
  ...(culturalContext !== undefined ? { cultural_context: culturalContext } : {}),
  ...(extras?.conversation_id !== undefined
    ? { conversation_id: extras.conversation_id }
    : {}),
  ...(extras?.turn_number !== undefined ? { turn_number: extras.turn_number } : {}),
});

type FindEnvelopeResult =
  | { readonly status: "found"; readonly envelope: ChorusEnvelope }
  | { readonly status: "not_found" }
  | { readonly status: "invalid"; readonly error: string };

/**
 * Validates arbitrary data against ChorusEnvelopeSchema.
 * Returns a discriminated result: found+valid, not_found (null input), found+invalid.
 */
const validateEnvelopeData = (data: unknown): FindEnvelopeResult => {
  if (data === null || data === undefined) {
    return { status: "not_found" };
  }

  const result = ChorusEnvelopeSchema.safeParse(data);
  if (result.success) {
    return { status: "found", envelope: result.data };
  }

  const fieldErrors = result.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { status: "invalid", error: fieldErrors };
};

/**
 * Strict parse: validates arbitrary data against ChorusEnvelopeSchema.
 * Throws ZodError when validation fails.
 */
const parseEnvelope = (data: unknown): ChorusEnvelope =>
  ChorusEnvelopeSchema.parse(data);

export { createEnvelope, validateEnvelopeData, parseEnvelope };
export type { EnvelopeExtras, FindEnvelopeResult };

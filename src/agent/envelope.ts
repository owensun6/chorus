// Author: be-domain-modeler
import {
  ChorusEnvelopeSchema,
  CHORUS_MEDIA_TYPE,
  CHORUS_EXTENSION_URI,
} from "../shared/types";
import type {
  ChorusEnvelope,
  A2AMessage,
  DataPart,
} from "../shared/types";

/**
 * Optional fields that can be attached to a ChorusEnvelope.
 */
interface EnvelopeExtras {
  readonly intent_type?: ChorusEnvelope["intent_type"];
  readonly formality?: ChorusEnvelope["formality"];
  readonly emotional_tone?: ChorusEnvelope["emotional_tone"];
  readonly conversation_id?: string;
  readonly turn_number?: number;
}

/**
 * Creates a ChorusEnvelope from the given semantic text and culture tag.
 * Auto-detects version: v0.3 when conversation_id or turn_number present, v0.2 otherwise.
 * Pure function — returns a new object every call, never mutates inputs.
 */
const createEnvelope = (
  semantic: string,
  culture: string,
  culturalContext?: string,
  extras?: EnvelopeExtras,
): ChorusEnvelope => {
  const hasV03Fields =
    extras?.conversation_id !== undefined || extras?.turn_number !== undefined;

  return {
    chorus_version: hasV03Fields ? "0.3" : "0.2",
    original_semantic: semantic,
    sender_culture: culture,
    ...(culturalContext !== undefined ? { cultural_context: culturalContext } : {}),
    ...(extras?.intent_type !== undefined ? { intent_type: extras.intent_type } : {}),
    ...(extras?.formality !== undefined ? { formality: extras.formality } : {}),
    ...(extras?.emotional_tone !== undefined
      ? { emotional_tone: extras.emotional_tone }
      : {}),
    ...(extras?.conversation_id !== undefined
      ? { conversation_id: extras.conversation_id }
      : {}),
    ...(extras?.turn_number !== undefined ? { turn_number: extras.turn_number } : {}),
  };
};

/**
 * Wraps plain text + a ChorusEnvelope into an A2AMessage with two parts:
 *   [0] TextPart  (mediaType: "text/plain")
 *   [1] DataPart  (mediaType: CHORUS_MEDIA_TYPE)
 */
const createChorusMessage = (
  text: string,
  envelope: ChorusEnvelope,
): A2AMessage => ({
  role: "ROLE_USER",
  parts: [
    { text, mediaType: "text/plain" },
    { data: { ...envelope }, mediaType: CHORUS_MEDIA_TYPE },
  ],
  extensions: [CHORUS_EXTENSION_URI],
});

type FindEnvelopeResult =
  | { readonly status: "found"; readonly envelope: ChorusEnvelope }
  | { readonly status: "not_found" }
  | { readonly status: "invalid"; readonly error: string };

/**
 * Scans an A2AMessage for a DataPart whose mediaType matches CHORUS_MEDIA_TYPE.
 * Returns a discriminated result distinguishing: found+valid, not found, found+invalid.
 */
const findChorusDataPart = (message: A2AMessage): FindEnvelopeResult => {
  const chorusPart = message.parts.find(
    (p): p is DataPart =>
      "data" in p && p.mediaType === CHORUS_MEDIA_TYPE,
  );

  if (chorusPart === undefined) {
    return { status: "not_found" };
  }

  const result = ChorusEnvelopeSchema.safeParse(chorusPart.data);
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

export { createEnvelope, createChorusMessage, findChorusDataPart, parseEnvelope };
export type { EnvelopeExtras, FindEnvelopeResult };

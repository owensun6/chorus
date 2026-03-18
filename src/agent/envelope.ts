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
}

/**
 * Creates a ChorusEnvelope v0.2 from the given semantic text and culture tag.
 * Pure function — returns a new object every call, never mutates inputs.
 */
const createEnvelope = (
  semantic: string,
  culture: string,
  culturalContext?: string,
  extras?: EnvelopeExtras,
): ChorusEnvelope => ({
  chorus_version: "0.2",
  original_semantic: semantic,
  sender_culture: culture,
  ...(culturalContext !== undefined ? { cultural_context: culturalContext } : {}),
  ...(extras?.intent_type !== undefined ? { intent_type: extras.intent_type } : {}),
  ...(extras?.formality !== undefined ? { formality: extras.formality } : {}),
  ...(extras?.emotional_tone !== undefined
    ? { emotional_tone: extras.emotional_tone }
    : {}),
});

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

/**
 * Scans an A2AMessage for a DataPart whose mediaType matches CHORUS_MEDIA_TYPE.
 * If found, validates the data against ChorusEnvelopeSchema.
 * Returns the parsed envelope on success, or null when absent / invalid.
 */
const findChorusDataPart = (message: A2AMessage): ChorusEnvelope | null => {
  const chorusPart = message.parts.find(
    (p): p is DataPart =>
      "data" in p && p.mediaType === CHORUS_MEDIA_TYPE,
  );

  if (chorusPart === undefined) {
    return null;
  }

  const result = ChorusEnvelopeSchema.safeParse(chorusPart.data);
  return result.success ? result.data : null;
};

/**
 * Strict parse: validates arbitrary data against ChorusEnvelopeSchema.
 * Throws ZodError when validation fails.
 */
const parseEnvelope = (data: unknown): ChorusEnvelope =>
  ChorusEnvelopeSchema.parse(data);

export { createEnvelope, createChorusMessage, findChorusDataPart, parseEnvelope };
export type { EnvelopeExtras };

// Author: be-domain-modeler
import { ChorusEnvelopeSchema } from './schemas/envelope';
import type { ChorusEnvelope } from './schemas/envelope';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateEnvelopeParams {
  readonly original_semantic: string;
  readonly sender_culture: string;
  readonly intent_type?: string;
  readonly formality?: string;
  readonly emotional_tone?: string;
  readonly relationship_level?: string;
}

interface Part {
  readonly text?: string;
  readonly data?: unknown;
  readonly mediaType?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHORUS_MEDIA_TYPE = 'application/vnd.chorus.envelope+json';

// ---------------------------------------------------------------------------
// createEnvelope
// ---------------------------------------------------------------------------

const createEnvelope = (params: CreateEnvelopeParams): ChorusEnvelope => {
  const raw: Record<string, unknown> = {
    chorus_version: '0.1',
    original_semantic: params.original_semantic,
    sender_culture: params.sender_culture,
  };

  if (params.intent_type !== undefined) {
    raw['intent_type'] = params.intent_type;
  }
  if (params.formality !== undefined) {
    raw['formality'] = params.formality;
  }
  if (params.emotional_tone !== undefined) {
    raw['emotional_tone'] = params.emotional_tone;
  }
  if (params.relationship_level !== undefined) {
    raw['relationship_level'] = params.relationship_level;
  }

  const envelope = ChorusEnvelopeSchema.parse(raw);
  return Object.freeze(envelope);
};

// ---------------------------------------------------------------------------
// parseEnvelope
// ---------------------------------------------------------------------------

const parseEnvelope = (parts: readonly Part[]): ChorusEnvelope | null => {
  const chorusPart = parts.find(
    (p) => p.mediaType === CHORUS_MEDIA_TYPE,
  );

  if (!chorusPart || chorusPart.data === undefined) {
    return null;
  }

  try {
    return ChorusEnvelopeSchema.parse(chorusPart.data);
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// validateEnvelope
// ---------------------------------------------------------------------------

type ValidationSuccess = { readonly success: true; readonly envelope: ChorusEnvelope };
type ValidationFailure = { readonly success: false; readonly errors: readonly string[] };

const validateEnvelope = (
  data: unknown,
): ValidationSuccess | ValidationFailure => {
  const result = ChorusEnvelopeSchema.safeParse(data);

  if (result.success) {
    return { success: true, envelope: result.data };
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.')}: ${issue.message}`,
  );

  return { success: false, errors };
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { createEnvelope, parseEnvelope, validateEnvelope, CHORUS_MEDIA_TYPE };
export type { CreateEnvelopeParams, Part, ValidationSuccess, ValidationFailure };

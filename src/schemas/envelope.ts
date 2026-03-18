// Author: be-domain-modeler
import { z } from "zod";

const BCP47_REGEX = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2}|-[0-9]{3})?$/;

const bcp47String = z.string().regex(BCP47_REGEX, "Invalid BCP47 language tag");

const IntentType = z.enum([
  "greeting",
  "request",
  "proposal",
  "rejection",
  "chitchat",
  "apology",
  "gratitude",
  "information",
]);

const Formality = z.enum(["formal", "semi-formal", "casual"]);

const EmotionalTone = z.enum([
  "polite",
  "neutral",
  "enthusiastic",
  "cautious",
  "apologetic",
]);

const RelationshipLevel = z.enum([
  "new_acquaintance",
  "colleague",
  "close_friend",
]);

const ChorusEnvelopeSchema = z.object({
  chorus_version: z.literal("0.1"),
  original_semantic: z.string().min(1, "original_semantic must not be empty"),
  sender_culture: bcp47String,
  intent_type: IntentType.optional(),
  formality: Formality.optional(),
  emotional_tone: EmotionalTone.optional(),
  relationship_level: RelationshipLevel.optional(),
});

type ChorusEnvelope = z.infer<typeof ChorusEnvelopeSchema>;

export {
  ChorusEnvelopeSchema,
  IntentType,
  Formality,
  EmotionalTone,
  RelationshipLevel,
  bcp47String,
  BCP47_REGEX,
};
export type { ChorusEnvelope };

// Author: be-domain-modeler
import { z } from "zod";

// --- Constants ---

const BCP47_REGEX = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2}|-[0-9]{3})?$/;

const CHORUS_MEDIA_TYPE = "application/vnd.chorus.envelope+json" as const;

const CHORUS_EXTENSION_URI =
  "https://chorus-protocol.org/extensions/envelope/v0.2" as const;

// --- Shared Primitives ---

const bcp47String = z
  .string()
  .regex(BCP47_REGEX, "Invalid BCP47 language tag");

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

// --- ChorusEnvelope v0.2/v0.3 ---

const ChorusEnvelopeSchema = z
  .object({
    chorus_version: z.enum(["0.2", "0.3"]),
    original_semantic: z
      .string()
      .min(1, "original_semantic must not be empty"),
    sender_culture: bcp47String,
    cultural_context: z.string().min(10).max(500).optional(),
    intent_type: IntentType.optional(),
    formality: Formality.optional(),
    emotional_tone: EmotionalTone.optional(),
    conversation_id: z.string().max(64).optional(),
    turn_number: z.number().int().min(1).optional(),
  })
  .passthrough();

type ChorusEnvelope = z.infer<typeof ChorusEnvelopeSchema>;

// --- Conversation Types ---

interface ConversationTurn {
  readonly role: "sent" | "received";
  readonly originalText: string;
  readonly adaptedText: string;
  readonly envelope: ChorusEnvelope;
  readonly timestamp: string;
}

// --- Streaming Callback Types ---

type OnTokenCallback = (chunk: string) => void;
type OnChunkCallback = (text: string) => void;

// --- ChorusAgentCardExtension v0.2 ---

const ChorusAgentCardSchema = z
  .object({
    chorus_version: z.literal("0.2"),
    user_culture: bcp47String,
    supported_languages: z
      .array(bcp47String)
      .min(1, "At least one language required"),
  })
  .passthrough();

type ChorusAgentCard = z.infer<typeof ChorusAgentCardSchema>;

// --- A2A Message Types ---

const TextPartSchema = z.object({
  text: z.string(),
  mediaType: z.string(),
});

const DataPartSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  mediaType: z.string(),
});

const PartSchema = z.union([TextPartSchema, DataPartSchema]);

type TextPart = z.infer<typeof TextPartSchema>;
type DataPart = z.infer<typeof DataPartSchema>;
type Part = z.infer<typeof PartSchema>;

const A2AMessageSchema = z.object({
  role: z.enum(["ROLE_USER", "ROLE_AGENT"]),
  parts: z.array(PartSchema).min(1),
  extensions: z.array(z.string()).optional(),
});

type A2AMessage = z.infer<typeof A2AMessageSchema>;

// --- Routing Server Types (plain interfaces — no runtime schema needed) ---

interface AgentRegistration {
  readonly agent_id: string;
  readonly endpoint: string;
  readonly agent_card: ChorusAgentCard;
  readonly registered_at: string;
}

export {
  BCP47_REGEX,
  CHORUS_MEDIA_TYPE,
  CHORUS_EXTENSION_URI,
  bcp47String,
  IntentType,
  Formality,
  EmotionalTone,
  ChorusEnvelopeSchema,
  ChorusAgentCardSchema,
  TextPartSchema,
  DataPartSchema,
  PartSchema,
  A2AMessageSchema,
};

export type {
  ChorusEnvelope,
  ChorusAgentCard,
  TextPart,
  DataPart,
  Part,
  A2AMessage,
  AgentRegistration,
  ConversationTurn,
  OnTokenCallback,
  OnChunkCallback,
};

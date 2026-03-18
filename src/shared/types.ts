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

// --- ChorusEnvelope v0.2 ---

const ChorusEnvelopeSchema = z
  .object({
    chorus_version: z.literal("0.2"),
    original_semantic: z
      .string()
      .min(1, "original_semantic must not be empty"),
    sender_culture: bcp47String,
    cultural_context: z.string().min(10).max(500).optional(),
    intent_type: IntentType.optional(),
    formality: Formality.optional(),
    emotional_tone: EmotionalTone.optional(),
  })
  .passthrough();

type ChorusEnvelope = z.infer<typeof ChorusEnvelopeSchema>;

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

// --- Routing Server Types ---

const AgentRegistrationSchema = z.object({
  agent_id: z.string().min(1),
  endpoint: z.string().url(),
  agent_card: ChorusAgentCardSchema,
  registered_at: z.string().datetime(),
});

type AgentRegistration = z.infer<typeof AgentRegistrationSchema>;

const MessagePayloadSchema = z.object({
  sender_agent_id: z.string().min(1),
  target_agent_id: z.string().min(1),
  message: A2AMessageSchema,
});

type MessagePayload = z.infer<typeof MessagePayloadSchema>;

// --- Standard API Response ---

const ApiSuccessSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  metadata: z.object({ timestamp: z.string() }),
});

const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
  metadata: z.object({ timestamp: z.string() }),
});

type ApiSuccess = z.infer<typeof ApiSuccessSchema>;
type ApiError = z.infer<typeof ApiErrorSchema>;

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
  AgentRegistrationSchema,
  MessagePayloadSchema,
  ApiSuccessSchema,
  ApiErrorSchema,
};

export type {
  ChorusEnvelope,
  ChorusAgentCard,
  TextPart,
  DataPart,
  Part,
  A2AMessage,
  AgentRegistration,
  MessagePayload,
  ApiSuccess,
  ApiError,
};

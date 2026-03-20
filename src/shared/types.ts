// Author: be-domain-modeler
import { z } from "zod";

// --- Constants ---

const BCP47_REGEX = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2}|-[0-9]{3})?$/;

// --- Shared Primitives ---

const bcp47String = z
  .string()
  .regex(BCP47_REGEX, "Invalid BCP47 language tag");

const SENDER_ID_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/;

// --- ChorusEnvelope v0.4 ---

const ChorusEnvelopeSchema = z
  .object({
    chorus_version: z.literal("0.4"),
    sender_id: z
      .string()
      .regex(SENDER_ID_REGEX, "sender_id must be name@host format"),
    original_text: z
      .string()
      .min(1, "original_text must not be empty"),
    sender_culture: bcp47String,
    cultural_context: z.string().min(10).max(500).optional(),
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
  SENDER_ID_REGEX,
  bcp47String,
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

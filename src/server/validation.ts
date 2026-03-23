// Author: be-api-router
import { z } from "zod";
import { ChorusAgentCardSchema, ChorusEnvelopeSchema } from "../shared/types";

const RegisterAgentBodySchema = z.object({
  agent_id: z.string().min(1, "agent_id is required"),
  endpoint: z.string().url("endpoint must be a valid URL"),
  agent_card: ChorusAgentCardSchema,
});

type RegisterAgentBody = z.infer<typeof RegisterAgentBodySchema>;

const SelfRegisterBodySchema = z.object({
  agent_id: z.string().min(1, "agent_id is required"),
  agent_card: ChorusAgentCardSchema,
  endpoint: z.string().url("endpoint must be a valid URL").optional(),
  invite_code: z.string().min(1).optional(),
});

type SelfRegisterBody = z.infer<typeof SelfRegisterBodySchema>;

const MessagePayloadBodySchema = z.object({
  receiver_id: z.string().min(1),
  envelope: ChorusEnvelopeSchema,
  stream: z.boolean().optional().default(false),
});

type MessagePayloadBody = z.infer<typeof MessagePayloadBodySchema>;

export { RegisterAgentBodySchema, SelfRegisterBodySchema, MessagePayloadBodySchema };
export type { RegisterAgentBody, SelfRegisterBody, MessagePayloadBody };

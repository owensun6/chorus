// Author: be-api-router
import { z } from "zod";
import { ChorusAgentCardSchema } from "../shared/types";

const RegisterAgentBodySchema = z.object({
  agent_id: z.string().min(1, "agent_id is required"),
  endpoint: z.string().url("endpoint must be a valid URL"),
  agent_card: ChorusAgentCardSchema,
});

type RegisterAgentBody = z.infer<typeof RegisterAgentBodySchema>;

const MessagePayloadBodySchema = z.object({
  sender_agent_id: z.string().min(1),
  target_agent_id: z.string().min(1),
  message: z.object({
    role: z.string(),
    parts: z.array(z.unknown()).min(1),
  }).passthrough(),
  stream: z.boolean().optional().default(false),
});

type MessagePayloadBody = z.infer<typeof MessagePayloadBodySchema>;

export { RegisterAgentBodySchema, MessagePayloadBodySchema };
export type { RegisterAgentBody, MessagePayloadBody };

// Author: be-api-router
import { z } from "zod";
import { ChorusAgentCardSchema } from "../shared/types";

const RegisterAgentBodySchema = z.object({
  agent_id: z.string().min(1, "agent_id is required"),
  endpoint: z.string().url("endpoint must be a valid URL"),
  agent_card: ChorusAgentCardSchema,
});

type RegisterAgentBody = z.infer<typeof RegisterAgentBodySchema>;

export { RegisterAgentBodySchema };
export type { RegisterAgentBody };

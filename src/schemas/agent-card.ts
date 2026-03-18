// Author: be-domain-modeler
import { z } from "zod";
import { bcp47String } from "./envelope";

const Directness = z.enum(["direct", "indirect", "adaptive"]);

const FormalityDefault = z.enum(["formal", "semi-formal", "casual"]);

const CommunicationPreferences = z.object({
  directness: Directness.optional(),
  formality_default: FormalityDefault.optional(),
});

const ChorusAgentCardSchema = z.object({
  chorus_version: z.literal("0.1"),
  user_culture: bcp47String,
  supported_languages: z.array(z.string()).min(1, "At least one language required"),
  communication_preferences: CommunicationPreferences.optional(),
});

type ChorusAgentCard = z.infer<typeof ChorusAgentCardSchema>;

export {
  ChorusAgentCardSchema,
  CommunicationPreferences,
  Directness,
  FormalityDefault,
};
export type { ChorusAgentCard };

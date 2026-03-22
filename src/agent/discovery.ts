// Author: be-domain-modeler
import type { ChorusAgentCard, AgentRegistration } from "../shared/types";

/**
 * Extracts the primary language subtag from a BCP47 tag.
 * "zh-CN" → "zh", "ja" → "ja"
 */
const primarySubtag = (bcp47: string): string => bcp47.split("-")[0];

/**
 * Bidirectional language compatibility check.
 * Returns true only when A can serve B's culture AND B can serve A's culture.
 */
const canCommunicate = (
  cardA: ChorusAgentCard,
  cardB: ChorusAgentCard
): boolean => {
  const aServersB = cardA.supported_languages.some(
    (lang) => primarySubtag(lang) === primarySubtag(cardB.user_culture)
  );
  const bServersA = cardB.supported_languages.some(
    (lang) => primarySubtag(lang) === primarySubtag(cardA.user_culture)
  );
  return aServersB && bServersA;
};

/**
 * Fetches registered agents from the router and returns only
 * those whose agent_card is bidirectionally compatible with myCard.
 */
const discoverCompatibleAgents = async (
  routerUrl: string,
  myCard: ChorusAgentCard
): Promise<AgentRegistration[]> => {
  const url = `${routerUrl}/discover`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch agents from ${routerUrl}: ${response.status} ${response.statusText}`
    );
  }

  const body = (await response.json()) as { data: AgentRegistration[] };
  const agents: AgentRegistration[] = body.data;

  return agents.filter((reg) => canCommunicate(myCard, reg.agent_card));
};

export { primarySubtag, canCommunicate, discoverCompatibleAgents };

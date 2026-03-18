// Author: be-api-router
import type { AgentRegistration, ChorusAgentCard } from "../shared/types";

class AgentRegistry {
  private readonly agents: Map<string, AgentRegistration> = new Map();

  register(
    agentId: string,
    endpoint: string,
    agentCard: ChorusAgentCard
  ): AgentRegistration {
    const existing = this.agents.get(agentId);
    const registeredAt = existing
      ? existing.registered_at
      : new Date().toISOString();

    const registration: AgentRegistration = {
      agent_id: agentId,
      endpoint,
      agent_card: { ...agentCard },
      registered_at: registeredAt,
    };

    this.agents.set(agentId, registration);

    return { ...registration, agent_card: { ...registration.agent_card } };
  }

  get(agentId: string): AgentRegistration | undefined {
    const entry = this.agents.get(agentId);
    if (!entry) {
      return undefined;
    }
    return { ...entry, agent_card: { ...entry.agent_card } };
  }

  list(): AgentRegistration[] {
    return Array.from(this.agents.values()).map((entry) => ({
      ...entry,
      agent_card: { ...entry.agent_card },
    }));
  }

  remove(agentId: string): boolean {
    return this.agents.delete(agentId);
  }
}

export { AgentRegistry };

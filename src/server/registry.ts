// Author: be-api-router
import type { AgentRegistration, ChorusAgentCard } from "../shared/types";

class AgentRegistry {
  private readonly agents: Map<string, AgentRegistration> = new Map();
  private readonly maxAgents: number;
  private messagesDelivered: number = 0;
  private messagesFailed: number = 0;

  constructor(maxAgents: number = 100) {
    this.maxAgents = maxAgents;
  }

  register(
    agentId: string,
    endpoint: string,
    agentCard: ChorusAgentCard
  ): AgentRegistration | null {
    const existing = this.agents.get(agentId);

    if (!existing && this.agents.size >= this.maxAgents) {
      return null;
    }

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

  recordDelivery(): void {
    this.messagesDelivered += 1;
  }

  recordFailure(): void {
    this.messagesFailed += 1;
  }

  getStats(): {
    agents_registered: number;
    messages_delivered: number;
    messages_failed: number;
  } {
    return {
      agents_registered: this.agents.size,
      messages_delivered: this.messagesDelivered,
      messages_failed: this.messagesFailed,
    };
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

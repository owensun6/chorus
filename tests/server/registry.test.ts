// Author: be-api-router
import { AgentRegistry } from "../../src/server/registry";
import type { AgentRegistration } from "../../src/shared/types";

describe("AgentRegistry", () => {
  const validCard = {
    chorus_version: "0.2" as const,
    user_culture: "en-US",
    supported_languages: ["en", "zh-CN"],
  };

  const agentId = "agent-alpha";
  const endpoint = "https://alpha.example.com/a2a";

  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it("registers a new agent and returns AgentRegistration", () => {
    const result = registry.register(agentId, endpoint, validCard);

    expect(result.agent_id).toBe(agentId);
    expect(result.endpoint).toBe(endpoint);
    expect(result.agent_card).toEqual(validCard);
    expect(typeof result.registered_at).toBe("string");
    expect(() => new Date(result.registered_at)).not.toThrow();
  });

  it("returns a new object, not a reference to internal state", () => {
    const result = registry.register(agentId, endpoint, validCard);
    const fetched = registry.get(agentId);

    expect(result).not.toBe(fetched);
    expect(result).toEqual(fetched);
  });

  it("gets a registered agent by id", () => {
    registry.register(agentId, endpoint, validCard);
    const result = registry.get(agentId);

    expect(result).toBeDefined();
    expect(result!.agent_id).toBe(agentId);
    expect(result!.endpoint).toBe(endpoint);
  });

  it("returns undefined for nonexistent agent", () => {
    const result = registry.get("ghost-agent");
    expect(result).toBeUndefined();
  });

  it("lists all registered agents", () => {
    registry.register("a1", "https://a1.example.com", validCard);
    registry.register("a2", "https://a2.example.com", validCard);

    const all = registry.list();
    expect(all).toHaveLength(2);
    expect(all.map((a: { agent_id: string }) => a.agent_id).sort()).toEqual(["a1", "a2"]);
  });

  it("returns empty array when no agents registered", () => {
    const all = registry.list();
    expect(all).toEqual([]);
  });

  it("removes a registered agent and returns true", () => {
    registry.register(agentId, endpoint, validCard);
    const removed = registry.remove(agentId);

    expect(removed).toBe(true);
    expect(registry.get(agentId)).toBeUndefined();
  });

  it("returns false when removing nonexistent agent", () => {
    const removed = registry.remove("ghost-agent");
    expect(removed).toBe(false);
  });

  it("re-registers an existing agent: updates endpoint and card, keeps registered_at", () => {
    const first = registry.register(agentId, endpoint, validCard);
    const originalTimestamp = first.registered_at;

    const updatedCard = {
      ...validCard,
      supported_languages: ["en", "ja"],
    };
    const newEndpoint = "https://alpha-v2.example.com/a2a";

    const second = registry.register(agentId, newEndpoint, updatedCard);

    expect(second.agent_id).toBe(agentId);
    expect(second.endpoint).toBe(newEndpoint);
    expect(second.agent_card).toEqual(updatedCard);
    expect(second.registered_at).toBe(originalTimestamp);
  });
});

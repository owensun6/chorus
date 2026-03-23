// Author: be-api-router
import { AgentRegistry } from "../../src/server/registry";
import { createTestDb } from "../helpers/test-db";
import type Database from "better-sqlite3";

describe("AgentRegistry", () => {
  const validCard = {
    card_version: "0.3" as const,
    user_culture: "en-US",
    supported_languages: ["en", "zh-CN"],
  };

  const agentId = "agent-alpha";
  const endpoint = "https://alpha.example.com/a2a";

  let db: Database.Database;
  let registry: AgentRegistry;

  beforeEach(() => {
    db = createTestDb();
    registry = new AgentRegistry(db);
  });

  afterEach(() => {
    db.close();
  });

  it("registers a new agent and returns AgentRegistration", () => {
    const result = registry.register(agentId, endpoint, validCard);

    expect(result).not.toBeNull();
    expect(result!.agent_id).toBe(agentId);
    expect(result!.endpoint).toBe(endpoint);
    expect(result!.agent_card).toEqual(validCard);
    expect(typeof result!.registered_at).toBe("string");
    expect(() => new Date(result!.registered_at)).not.toThrow();
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
    const originalTimestamp = first!.registered_at;

    const updatedCard = {
      ...validCard,
      supported_languages: ["en", "ja"],
    };
    const newEndpoint = "https://alpha-v2.example.com/a2a";

    const second = registry.register(agentId, newEndpoint, updatedCard);

    expect(second!.agent_id).toBe(agentId);
    expect(second!.endpoint).toBe(newEndpoint);
    expect(second!.agent_card).toEqual(updatedCard);
    expect(second!.registered_at).toBe(originalTimestamp);
  });

  describe("max agent limit", () => {
    it("returns null when registry is full and agent_id is new", () => {
      const small = new AgentRegistry(db, 2);
      small.register("a1", "https://a1.example.com", validCard);
      small.register("a2", "https://a2.example.com", validCard);

      const result = small.register("a3", "https://a3.example.com", validCard);
      expect(result).toBeNull();
    });

    it("allows re-registration of existing agent when registry is full", () => {
      const small = new AgentRegistry(db, 2);
      small.register("a1", "https://a1.example.com", validCard);
      small.register("a2", "https://a2.example.com", validCard);

      const result = small.register("a1", "https://a1-v2.example.com", validCard);
      expect(result).not.toBeNull();
      expect(result!.agent_id).toBe("a1");
      expect(result!.endpoint).toBe("https://a1-v2.example.com");
    });

    it("allows registration after removing an agent from a full registry", () => {
      const small = new AgentRegistry(db, 2);
      small.register("a1", "https://a1.example.com", validCard);
      small.register("a2", "https://a2.example.com", validCard);

      small.remove("a1");
      const result = small.register("a3", "https://a3.example.com", validCard);
      expect(result).not.toBeNull();
      expect(result!.agent_id).toBe("a3");
    });

    it("defaults to maxAgents=100", () => {
      const large = new AgentRegistry(db);
      for (let i = 0; i < 100; i++) {
        const r = large.register(`a${i}`, `https://a${i}.example.com`, validCard);
        expect(r).not.toBeNull();
      }
      const overflow = large.register("a100", "https://a100.example.com", validCard);
      expect(overflow).toBeNull();
    });
  });

  describe("observability counters", () => {
    it("starts with zero counters", () => {
      const stats = registry.getStats();
      expect(stats).toEqual({
        agents_registered: 0,
        messages_delivered: 0,
        messages_queued: 0,
        messages_failed: 0,
      });
    });

    it("tracks agents_registered count", () => {
      registry.register("a1", "https://a1.example.com", validCard);
      registry.register("a2", "https://a2.example.com", validCard);

      expect(registry.getStats().agents_registered).toBe(2);
    });

    it("increments messagesDelivered via recordDelivery()", () => {
      registry.recordDelivery();
      registry.recordDelivery();
      registry.recordDelivery();

      expect(registry.getStats().messages_delivered).toBe(3);
    });

    it("increments messagesFailed via recordFailure()", () => {
      registry.recordFailure();
      registry.recordFailure();

      expect(registry.getStats().messages_failed).toBe(2);
    });

    it("tracks delivery and failure counters independently", () => {
      registry.recordDelivery();
      registry.recordDelivery();
      registry.recordFailure();

      const stats = registry.getStats();
      expect(stats.messages_delivered).toBe(2);
      expect(stats.messages_failed).toBe(1);
    });

    it("getStats returns a snapshot, not a live reference", () => {
      const stats1 = registry.getStats();
      registry.recordDelivery();
      const stats2 = registry.getStats();

      expect(stats1.messages_delivered).toBe(0);
      expect(stats2.messages_delivered).toBe(1);
    });
  });
});

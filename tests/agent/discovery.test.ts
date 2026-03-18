// Author: be-domain-modeler
import {
  primarySubtag,
  canCommunicate,
  discoverCompatibleAgents,
} from "../../src/agent/discovery";
import type { ChorusAgentCard, AgentRegistration } from "../../src/shared/types";

// --- Helper factories ---

const makeCard = (
  userCulture: string,
  supportedLanguages: readonly string[]
): ChorusAgentCard => ({
  chorus_version: "0.2",
  user_culture: userCulture,
  supported_languages: [...supportedLanguages],
});

const makeRegistration = (
  id: string,
  card: ChorusAgentCard
): AgentRegistration => ({
  agent_id: id,
  endpoint: `https://${id}.example.com`,
  agent_card: card,
  registered_at: new Date().toISOString(),
});

// --- primarySubtag ---

describe("primarySubtag", () => {
  it('extracts primary subtag from "zh-CN" → "zh"', () => {
    expect(primarySubtag("zh-CN")).toBe("zh");
  });

  it('returns full tag when no subtag: "ja" → "ja"', () => {
    expect(primarySubtag("ja")).toBe("ja");
  });

  it('handles complex tags: "en-US" → "en"', () => {
    expect(primarySubtag("en-US")).toBe("en");
  });
});

// --- canCommunicate ---

describe("canCommunicate", () => {
  it("returns true when both agents can serve each other's culture (zh-CN ↔ ja)", () => {
    const cardA = makeCard("zh-CN", ["zh", "ja"]);
    const cardB = makeCard("ja", ["ja", "zh"]);
    expect(canCommunicate(cardA, cardB)).toBe(true);
  });

  it("returns false when communication is one-way only", () => {
    const cardA = makeCard("zh-CN", ["zh", "ja"]); // A supports ja → can serve B
    const cardB = makeCard("ja", ["ja"]);           // B does NOT support zh → cannot serve A
    expect(canCommunicate(cardA, cardB)).toBe(false);
  });

  it("returns false when cardA has empty supported_languages", () => {
    // Note: Zod schema requires min(1), but canCommunicate should still guard
    const cardA = { chorus_version: "0.2" as const, user_culture: "zh-CN", supported_languages: [] as string[] };
    const cardB = makeCard("ja", ["ja", "zh"]);
    expect(canCommunicate(cardA as ChorusAgentCard, cardB)).toBe(false);
  });

  it("returns false when cardB has empty supported_languages", () => {
    const cardA = makeCard("zh-CN", ["zh", "ja"]);
    const cardB = { chorus_version: "0.2" as const, user_culture: "ja", supported_languages: [] as string[] };
    expect(canCommunicate(cardA, cardB as ChorusAgentCard)).toBe(false);
  });

  it("does NOT mutate input card objects", () => {
    const cardA = makeCard("zh-CN", ["zh", "ja"]);
    const cardB = makeCard("ja", ["ja", "zh"]);
    const snapshotA = JSON.stringify(cardA);
    const snapshotB = JSON.stringify(cardB);

    canCommunicate(cardA, cardB);

    expect(JSON.stringify(cardA)).toBe(snapshotA);
    expect(JSON.stringify(cardB)).toBe(snapshotB);
  });
});

// --- discoverCompatibleAgents ---

describe("discoverCompatibleAgents", () => {
  const routerUrl = "https://router.example.com";

  const myCard = makeCard("zh-CN", ["zh", "ja"]);

  const compatibleCard = makeCard("ja", ["ja", "zh"]);
  const incompatibleCard = makeCard("ko", ["ko"]);

  const agents: AgentRegistration[] = [
    makeRegistration("agent-ja", compatibleCard),
    makeRegistration("agent-ko", incompatibleCard),
  ];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("filters out incompatible agents and returns only compatible ones", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: agents, metadata: { timestamp: new Date().toISOString() } }),
    } as Response);

    const result = await discoverCompatibleAgents(routerUrl, myCard);

    expect(result).toHaveLength(1);
    expect(result[0].agent_id).toBe("agent-ja");
  });

  it("throws an error with routerUrl on HTTP failure", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as Response);

    await expect(discoverCompatibleAgents(routerUrl, myCard)).rejects.toThrow(
      routerUrl
    );
  });

  it("throws an error when fetch itself rejects (network error)", async () => {
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("network down"));

    await expect(discoverCompatibleAgents(routerUrl, myCard)).rejects.toThrow();
  });
});

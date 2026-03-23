// Author: be-api-router
import { randomUUID, createHash } from "crypto";
import type Database from "better-sqlite3";
import type { AgentRegistration, ChorusAgentCard } from "../shared/types";

const hashKey = (key: string): string =>
  createHash("sha256").update(key).digest("hex");

type SelfRegisterError =
  | "registry_full"
  | "agent_id_taken"
  | "invite_required"
  | "invite_invalid"
  | "invite_revoked"
  | "invite_exhausted"
  | "invite_expired";

type SelfRegisterResult =
  | { readonly ok: true; readonly registration: AgentRegistration; readonly api_key: string; readonly created: boolean }
  | { readonly ok: false; readonly error: SelfRegisterError };

class AgentRegistry {
  private readonly db: Database.Database;
  private readonly maxAgents: number;

  // Prepared statements
  private readonly stmtGetAgent: Database.Statement;
  private readonly stmtUpsertAgent: Database.Statement;
  private readonly stmtDeleteAgent: Database.Statement;
  private readonly stmtListAgents: Database.Statement;
  private readonly stmtCountAgents: Database.Statement;
  private readonly stmtHasKey: Database.Statement;
  private readonly stmtGetAgentByHash: Database.Statement;
  private readonly stmtUpsertKeyHash: Database.Statement;
  private readonly stmtDeleteKey: Database.Statement;
  private readonly stmtGetStat: Database.Statement;
  private readonly stmtIncStat: Database.Statement;
  private readonly stmtGetKeyHash: Database.Statement;
  private readonly stmtGetInviteCode: Database.Statement;
  private readonly stmtIncrementInviteUse: Database.Statement;
  private readonly stmtCountInviteCodes: Database.Statement;

  constructor(db: Database.Database, maxAgents: number = 100) {
    this.db = db;
    this.maxAgents = maxAgents;

    this.stmtGetAgent = db.prepare("SELECT agent_id, endpoint, agent_card, registered_at FROM agents WHERE agent_id = ?");
    this.stmtUpsertAgent = db.prepare(`
      INSERT INTO agents (agent_id, endpoint, agent_card, registered_at)
      VALUES (@agent_id, @endpoint, @agent_card, @registered_at)
      ON CONFLICT(agent_id) DO UPDATE SET
        endpoint = @endpoint,
        agent_card = @agent_card
    `);
    this.stmtDeleteAgent = db.prepare("DELETE FROM agents WHERE agent_id = ?");
    this.stmtListAgents = db.prepare("SELECT agent_id, endpoint, agent_card, registered_at FROM agents");
    this.stmtCountAgents = db.prepare("SELECT COUNT(*) as count FROM agents");
    this.stmtHasKey = db.prepare("SELECT 1 FROM api_keys WHERE agent_id = ?");
    this.stmtGetAgentByHash = db.prepare("SELECT agent_id FROM api_keys WHERE api_key_hash = ?");
    this.stmtUpsertKeyHash = db.prepare(`
      INSERT INTO api_keys (api_key_hash, agent_id) VALUES (?, ?)
      ON CONFLICT(agent_id) DO UPDATE SET api_key_hash = excluded.api_key_hash
    `);
    this.stmtDeleteKey = db.prepare("DELETE FROM api_keys WHERE agent_id = ?");
    this.stmtGetStat = db.prepare("SELECT value FROM stats WHERE key = ?");
    this.stmtIncStat = db.prepare("UPDATE stats SET value = value + 1 WHERE key = ?");
    this.stmtGetKeyHash = db.prepare("SELECT api_key_hash FROM api_keys WHERE agent_id = ?");
    this.stmtGetInviteCode = db.prepare("SELECT code_hash, expires_at, max_uses, use_count, revoked FROM invite_codes WHERE code_hash = ?");
    this.stmtIncrementInviteUse = db.prepare("UPDATE invite_codes SET use_count = use_count + 1 WHERE code_hash = ?");
    this.stmtCountInviteCodes = db.prepare("SELECT COUNT(*) as count FROM invite_codes");
  }

  register(
    agentId: string,
    endpoint: string,
    agentCard: ChorusAgentCard
  ): AgentRegistration | null {
    return this.registerAgent(agentId, endpoint, agentCard);
  }

  registerSelf(
    agentId: string,
    agentCard: ChorusAgentCard,
    endpoint?: string,
    inviteCode?: string,
    currentKeyHash?: string,
  ): SelfRegisterResult {
    // BEGIN IMMEDIATE transaction: acquires a write lock before any reads,
    // preventing stale-read / double-spend on invite code use_count under
    // concurrent registration attempts against a limited invite code.
    const apiKey = `ca_${randomUUID().replace(/-/g, "")}`;

    const run = this.db.transaction((): SelfRegisterResult => {
      // Step 1: Check if agent exists — determines rotation vs new registration path
      const existing = this.get(agentId);

      if (existing) {
        // --- Rotation path: ownership check only, no invite code needed ---
        const storedRow = this.stmtGetKeyHash.get(agentId) as { api_key_hash: string } | undefined;
        if (!currentKeyHash || !storedRow || currentKeyHash !== storedRow.api_key_hash) {
          return { ok: false, error: "agent_id_taken" };
        }
        const registration = this.registerAgent(agentId, endpoint, agentCard);
        if (!registration) return { ok: false, error: "registry_full" };
        this.stmtUpsertKeyHash.run(hashKey(apiKey), agentId);
        return { ok: true, registration, api_key: apiKey, created: false };
      }

      // --- New registration path: invite code required when gating is active ---
      const codeCount = (this.stmtCountInviteCodes.get() as { count: number }).count;
      const hasGating = codeCount > 0;
      let validatedCodeHash: string | undefined;

      if (hasGating) {
        if (!inviteCode) {
          return { ok: false, error: "invite_required" };
        }
        validatedCodeHash = hashKey(inviteCode);
        const row = this.stmtGetInviteCode.get(validatedCodeHash) as InviteCodeRow | undefined;
        if (!row) {
          return { ok: false, error: "invite_invalid" };
        }
        if (row.revoked) {
          return { ok: false, error: "invite_revoked" };
        }
        if (row.max_uses !== null && row.use_count >= row.max_uses) {
          return { ok: false, error: "invite_exhausted" };
        }
        if (row.expires_at !== null && new Date(row.expires_at) < new Date()) {
          return { ok: false, error: "invite_expired" };
        }
      }

      if (this.agentCount() >= this.maxAgents) {
        return { ok: false, error: "registry_full" };
      }

      // Reserve invite code (only for new registrations, only after all checks pass)
      if (hasGating && validatedCodeHash) {
        this.stmtIncrementInviteUse.run(validatedCodeHash);
      }

      const registration = this.registerAgent(agentId, endpoint, agentCard);
      if (!registration) return { ok: false, error: "registry_full" };
      this.stmtUpsertKeyHash.run(hashKey(apiKey), agentId);
      return { ok: true, registration, api_key: apiKey, created: true };
    });

    return run.immediate();
  }

  hasInviteCodes(): boolean {
    return (this.stmtCountInviteCodes.get() as { count: number }).count > 0;
  }

  isValidAgentKey(key: string): boolean {
    return this.stmtGetAgentByHash.get(hashKey(key)) !== undefined;
  }

  getAgentIdByKey(key: string): string | undefined {
    return (this.stmtGetAgentByHash.get(hashKey(key)) as { agent_id: string } | undefined)?.agent_id;
  }

  recordDelivery(): void {
    this.stmtIncStat.run("messages_delivered");
  }

  recordQueued(): void {
    this.stmtIncStat.run("messages_queued");
  }

  recordFailure(): void {
    this.stmtIncStat.run("messages_failed");
  }

  getStats(): {
    agents_registered: number;
    messages_delivered: number;
    messages_queued: number;
    messages_failed: number;
  } {
    return {
      agents_registered: this.agentCount(),
      messages_delivered: this.getStat("messages_delivered"),
      messages_queued: this.getStat("messages_queued"),
      messages_failed: this.getStat("messages_failed"),
    };
  }

  get(agentId: string): AgentRegistration | undefined {
    const row = this.stmtGetAgent.get(agentId) as AgentRow | undefined;
    if (!row) return undefined;
    return rowToRegistration(row);
  }

  list(): AgentRegistration[] {
    const rows = this.stmtListAgents.all() as AgentRow[];
    return rows.map(rowToRegistration);
  }

  remove(agentId: string): boolean {
    this.stmtDeleteKey.run(agentId);
    const result = this.stmtDeleteAgent.run(agentId);
    return result.changes > 0;
  }

  private registerAgent(
    agentId: string,
    endpoint: string | undefined,
    agentCard: ChorusAgentCard
  ): AgentRegistration | null {
    const existing = this.get(agentId);

    if (!existing && this.agentCount() >= this.maxAgents) {
      return null;
    }

    const registeredAt = existing
      ? existing.registered_at
      : new Date().toISOString();

    this.stmtUpsertAgent.run({
      agent_id: agentId,
      endpoint: endpoint ?? null,
      agent_card: JSON.stringify(agentCard),
      registered_at: registeredAt,
    });

    return {
      agent_id: agentId,
      ...(endpoint ? { endpoint } : {}),
      agent_card: { ...agentCard },
      registered_at: registeredAt,
    };
  }

  private agentCount(): number {
    return (this.stmtCountAgents.get() as { count: number }).count;
  }

  private getStat(key: string): number {
    return (this.stmtGetStat.get(key) as { value: number } | undefined)?.value ?? 0;
  }
}

interface AgentRow {
  readonly agent_id: string;
  readonly endpoint: string | null;
  readonly agent_card: string;
  readonly registered_at: string;
}

interface InviteCodeRow {
  readonly code_hash: string;
  readonly expires_at: string | null;
  readonly max_uses: number | null;
  readonly use_count: number;
  readonly revoked: number;
}

const rowToRegistration = (row: AgentRow): AgentRegistration => ({
  agent_id: row.agent_id,
  ...(row.endpoint ? { endpoint: row.endpoint } : {}),
  agent_card: JSON.parse(row.agent_card),
  registered_at: row.registered_at,
});

export { AgentRegistry, hashKey };
export type { SelfRegisterResult, SelfRegisterError };

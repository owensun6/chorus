// Author: be-api-router
import { randomUUID } from "crypto";

interface SessionRecord {
  readonly token: string;
  readonly agentId: string;
  readonly expiresAt: number;
  readonly used: boolean;
}

interface AgentSessionStore {
  readonly create: (agentId: string, ttlMs: number) => string;
  readonly validate: (sessionToken: string) => string | null;
  readonly cleanup: () => number;
}

const createAgentSessionStore = (): AgentSessionStore => {
  const sessions = new Map<string, SessionRecord>();

  const create = (agentId: string, ttlMs: number): string => {
    const token = `cs_${randomUUID().replace(/-/g, "")}`;
    sessions.set(token, {
      token,
      agentId,
      expiresAt: Date.now() + ttlMs,
      used: false,
    });
    return token;
  };

  const validate = (sessionToken: string): string | null => {
    const record = sessions.get(sessionToken);
    if (!record) return null;

    // Expired
    if (Date.now() > record.expiresAt) {
      sessions.delete(sessionToken);
      return null;
    }

    // Single-use: mark as used and delete
    sessions.delete(sessionToken);

    if (record.used) return null;

    return record.agentId;
  };

  const cleanup = (): number => {
    const now = Date.now();
    const expired: string[] = [];
    for (const [token, record] of sessions) {
      if (now > record.expiresAt) expired.push(token);
    }
    expired.forEach((t) => sessions.delete(t));
    return expired.length;
  };

  return { create, validate, cleanup };
};

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

export { createAgentSessionStore, SESSION_TTL_MS };
export type { AgentSessionStore };

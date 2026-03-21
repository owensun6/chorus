// Author: be-domain-modeler
import { formatSSE, SSE_ENCODER } from "../shared/sse";

interface InboxConnection {
  readonly agentId: string;
  readonly controller: ReadableStreamDefaultController;
  readonly connectedAt: string;
}

interface InboxManager {
  readonly connect: (agentId: string, controller: ReadableStreamDefaultController) => void;
  readonly disconnect: (agentId: string) => void;
  readonly deliver: (agentId: string, data: Record<string, unknown>) => boolean;
  readonly isConnected: (agentId: string) => boolean;
  readonly getConnectionCount: () => number;
}

const createInboxManager = (): InboxManager => {
  const connections = new Map<string, InboxConnection>();

  const connect = (agentId: string, controller: ReadableStreamDefaultController): void => {
    const existing = connections.get(agentId);
    if (existing) {
      try { existing.controller.close(); } catch { /* already closed */ }
    }
    connections.set(agentId, {
      agentId,
      controller,
      connectedAt: new Date().toISOString(),
    });
  };

  const disconnect = (agentId: string): void => {
    const conn = connections.get(agentId);
    if (conn) {
      try { conn.controller.close(); } catch { /* already closed */ }
      connections.delete(agentId);
    }
  };

  const deliver = (agentId: string, data: Record<string, unknown>): boolean => {
    const conn = connections.get(agentId);
    if (!conn) return false;

    try {
      conn.controller.enqueue(SSE_ENCODER.encode(formatSSE("message", data)));
      return true;
    } catch {
      connections.delete(agentId);
      return false;
    }
  };

  const isConnected = (agentId: string): boolean => connections.has(agentId);

  const getConnectionCount = (): number => connections.size;

  return { connect, disconnect, deliver, isConnected, getConnectionCount };
};

export { createInboxManager };
export type { InboxManager, InboxConnection };

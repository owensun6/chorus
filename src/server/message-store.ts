// Author: be-domain-modeler
import type { ChorusEnvelope } from "../shared/types";

interface StoredMessage {
  readonly id: number;
  readonly trace_id: string;
  readonly sender_id: string;
  readonly receiver_id: string;
  readonly envelope: ChorusEnvelope;
  readonly delivered_via: "sse" | "webhook";
  readonly timestamp: string;
}

interface MessageStore {
  readonly append: (msg: Omit<StoredMessage, "id" | "timestamp">) => StoredMessage;
  readonly listForAgent: (agentId: string, since?: number) => readonly StoredMessage[];
  readonly getStats: () => { total_stored: number };
}

const createMessageStore = (maxPerAgent: number = 1000): MessageStore => {
  const inboxes = new Map<string, StoredMessage[]>();
  let nextId = 1;
  let totalStored = 0;

  const append = (msg: Omit<StoredMessage, "id" | "timestamp">): StoredMessage => {
    const stored: StoredMessage = {
      ...msg,
      id: nextId,
      timestamp: new Date().toISOString(),
    };
    nextId += 1;

    // Store for receiver
    const receiverMessages = inboxes.get(msg.receiver_id) ?? [];
    const trimmed = receiverMessages.length >= maxPerAgent
      ? [...receiverMessages.slice(1), stored]
      : [...receiverMessages, stored];
    inboxes.set(msg.receiver_id, trimmed);

    // Store for sender (so both sides have history)
    const senderMessages = inboxes.get(msg.sender_id) ?? [];
    const senderTrimmed = senderMessages.length >= maxPerAgent
      ? [...senderMessages.slice(1), stored]
      : [...senderMessages, stored];
    inboxes.set(msg.sender_id, senderTrimmed);

    totalStored += 1;
    return stored;
  };

  const listForAgent = (agentId: string, since?: number): readonly StoredMessage[] => {
    const messages = inboxes.get(agentId) ?? [];
    if (since === undefined) return [...messages];
    return messages.filter((m) => m.id > since);
  };

  const getStats = () => ({ total_stored: totalStored });

  return { append, listForAgent, getStats };
};

export { createMessageStore };
export type { StoredMessage, MessageStore };

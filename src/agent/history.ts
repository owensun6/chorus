// Author: be-domain-modeler
import { randomUUID } from "crypto";
import type { ConversationTurn } from "../shared/types";

class ConversationHistory {
  private readonly conversations = new Map<string, ConversationTurn[]>();
  private readonly conversationIds = new Map<string, string>();
  private readonly maxTurns: number;

  constructor(maxTurns: number = 10) {
    this.maxTurns = maxTurns;
  }

  addTurn(peerId: string, turn: ConversationTurn): void {
    const turns = this.conversations.get(peerId) ?? [];
    const updated = [...turns, { ...turn }];
    const trimmed =
      updated.length > this.maxTurns
        ? updated.slice(updated.length - this.maxTurns)
        : updated;
    this.conversations.set(peerId, trimmed);
  }

  getTurns(peerId: string): readonly ConversationTurn[] {
    const turns = this.conversations.get(peerId) ?? [];
    return Object.freeze([...turns]);
  }

  getConversationId(peerId: string): string {
    const existing = this.conversationIds.get(peerId);
    if (existing !== undefined) {
      return existing;
    }
    const id = randomUUID();
    this.conversationIds.set(peerId, id);
    return id;
  }

  getNextTurnNumber(peerId: string): number {
    const turns = this.conversations.get(peerId) ?? [];
    return turns.length + 1;
  }
}

export { ConversationHistory };

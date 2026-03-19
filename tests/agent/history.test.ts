// Author: be-domain-modeler
import { ConversationHistory } from "../../src/agent/history";
import type { ConversationTurn } from "../../src/shared/types";

const makeTurn = (role: "sent" | "received", text: string): ConversationTurn => ({
  role,
  originalText: text,
  adaptedText: `adapted-${text}`,
  envelope: {
    chorus_version: "0.3",
    original_semantic: text,
    sender_culture: "zh-CN",
  },
  timestamp: new Date().toISOString(),
});

describe("ConversationHistory", () => {
  test("test_case_5: addTurn + getTurns returns immutable array in insertion order", () => {
    const history = new ConversationHistory();
    const t1 = makeTurn("sent", "hello");
    const t2 = makeTurn("received", "hi back");

    history.addTurn("peer-a", t1);
    history.addTurn("peer-a", t2);

    const turns = history.getTurns("peer-a");
    expect(turns).toHaveLength(2);
    expect(turns[0].originalText).toBe("hello");
    expect(turns[1].originalText).toBe("hi back");

    // immutability: returned array is a copy
    expect(() => (turns as ConversationTurn[]).push(t1)).toThrow();
  });

  test("test_case_6: FIFO truncation removes oldest when exceeding maxTurns", () => {
    const history = new ConversationHistory(3);

    history.addTurn("peer-a", makeTurn("sent", "msg-1"));
    history.addTurn("peer-a", makeTurn("received", "msg-2"));
    history.addTurn("peer-a", makeTurn("sent", "msg-3"));
    history.addTurn("peer-a", makeTurn("received", "msg-4"));

    const turns = history.getTurns("peer-a");
    expect(turns).toHaveLength(3);
    expect(turns[0].originalText).toBe("msg-2");
    expect(turns[2].originalText).toBe("msg-4");
  });

  test("test_case_7: getConversationId returns stable UUID per peerId", () => {
    const history = new ConversationHistory();
    const id1 = history.getConversationId("peer-a");
    const id2 = history.getConversationId("peer-a");
    expect(id1).toBe(id2);
    expect(id1.length).toBeGreaterThan(0);
  });

  test("test_case_8: getConversationId returns different UUIDs for different peers", () => {
    const history = new ConversationHistory();
    const idA = history.getConversationId("peer-a");
    const idB = history.getConversationId("peer-b");
    expect(idA).not.toBe(idB);
  });

  test("test_case_9: getNextTurnNumber increments per peer", () => {
    const history = new ConversationHistory();
    expect(history.getNextTurnNumber("peer-a")).toBe(1);

    history.addTurn("peer-a", makeTurn("sent", "msg"));
    expect(history.getNextTurnNumber("peer-a")).toBe(2);

    // different peer starts at 1
    expect(history.getNextTurnNumber("peer-b")).toBe(1);
  });

  test("getTurns for unknown peer returns empty array", () => {
    const history = new ConversationHistory();
    expect(history.getTurns("unknown")).toHaveLength(0);
  });

  test("addTurn does not mutate the input turn object", () => {
    const history = new ConversationHistory();
    const turn = makeTurn("sent", "test");
    const originalText = turn.originalText;
    history.addTurn("peer-a", turn);
    expect(turn.originalText).toBe(originalText);
  });
});

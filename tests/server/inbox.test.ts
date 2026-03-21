// Author: be-domain-modeler
import { createInboxManager } from "../../src/server/inbox";

describe("InboxManager", () => {
  it("reports not connected when no connection exists", () => {
    const inbox = createInboxManager();
    expect(inbox.isConnected("agent@host")).toBe(false);
    expect(inbox.getConnectionCount()).toBe(0);
  });

  it("connects and reports connected", () => {
    const inbox = createInboxManager();
    const controller = createMockController();
    inbox.connect("agent@host", controller);

    expect(inbox.isConnected("agent@host")).toBe(true);
    expect(inbox.getConnectionCount()).toBe(1);
  });

  it("disconnects and reports not connected", () => {
    const inbox = createInboxManager();
    const controller = createMockController();
    inbox.connect("agent@host", controller);
    inbox.disconnect("agent@host");

    expect(inbox.isConnected("agent@host")).toBe(false);
    expect(inbox.getConnectionCount()).toBe(0);
  });

  it("delivers message to connected agent", () => {
    const inbox = createInboxManager();
    const controller = createMockController();
    inbox.connect("agent@host", controller);

    const delivered = inbox.deliver("agent@host", { text: "hello" });

    expect(delivered).toBe(true);
    expect(controller.enqueue).toHaveBeenCalledTimes(1);
    const enqueued = controller.enqueue.mock.calls[0][0];
    const decoded = new TextDecoder().decode(enqueued);
    expect(decoded).toContain("event: message");
    expect(decoded).toContain('"text":"hello"');
  });

  it("returns false when delivering to disconnected agent", () => {
    const inbox = createInboxManager();
    const delivered = inbox.deliver("agent@host", { text: "hello" });
    expect(delivered).toBe(false);
  });

  it("replaces existing connection on re-connect", () => {
    const inbox = createInboxManager();
    const old = createMockController();
    const fresh = createMockController();

    inbox.connect("agent@host", old);
    inbox.connect("agent@host", fresh);

    expect(inbox.getConnectionCount()).toBe(1);
    expect(old.close).toHaveBeenCalled();

    const delivered = inbox.deliver("agent@host", { text: "hi" });
    expect(delivered).toBe(true);
    expect(fresh.enqueue).toHaveBeenCalledTimes(1);
  });

  it("auto-disconnects when enqueue throws", () => {
    const inbox = createInboxManager();
    const controller = createMockController();
    controller.enqueue.mockImplementation(() => { throw new Error("closed"); });

    inbox.connect("agent@host", controller);
    const delivered = inbox.deliver("agent@host", { text: "hi" });

    expect(delivered).toBe(false);
    expect(inbox.isConnected("agent@host")).toBe(false);
  });

  it("disconnect on non-existent agent is safe", () => {
    const inbox = createInboxManager();
    expect(() => inbox.disconnect("nobody@host")).not.toThrow();
  });
});

function createMockController(): ReadableStreamDefaultController & {
  enqueue: ReturnType<typeof jest.fn>;
  close: ReturnType<typeof jest.fn>;
} {
  return {
    enqueue: jest.fn(),
    close: jest.fn(),
    error: jest.fn(),
    desiredSize: 1,
  } as unknown as ReadableStreamDefaultController & {
    enqueue: ReturnType<typeof jest.fn>;
    close: ReturnType<typeof jest.fn>;
  };
}

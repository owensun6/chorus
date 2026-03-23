import {
  buildChorusRouterInjection,
  buildContinuitySystemContext,
  extractLatestUserText,
  isContinuationRequest,
  isChorusSession,
  isChorusRouterTurn,
} from "../../packages/chorus-skill/templates/bridge/router-hook";

describe("chorus router hook", () => {
  it("extracts the latest user text from message blocks", () => {
    const text = extractLatestUserText({
      messages: [
        { role: "assistant", content: "ignored" },
        {
          role: "user",
          content: [
            { type: "text", text: "first line" },
            { type: "text", text: "\"_type\": \"chorus_inbound\"" },
          ],
        },
      ],
    });

    expect(text).toContain("\"_type\": \"chorus_inbound\"");
  });

  it("matches chorus inbound payloads", () => {
    expect(isChorusRouterTurn('{"_type":"chorus_inbound","sender_id":"x@chorus"}')).toBe(true);
    expect(isChorusRouterTurn('MessageSid: "chorus-abc-123"')).toBe(true);
  });

  it("falls back to event.prompt when message history is absent", () => {
    const injection = buildChorusRouterInjection({
      prompt: 'raw prompt {"_type":"chorus_inbound","sender_id":"xiaov@openclaw"}',
    });

    expect(injection).toBeDefined();
  });

  it("injects router context for chorus turns", () => {
    const injection = buildChorusRouterInjection({
      messages: [
        {
          role: "user",
          content: 'CHORUS\n{"_type":"chorus_inbound","sender_id":"xiaox@chorus"}',
        },
      ],
    });

    expect(injection).toBeDefined();
    expect(injection?.prependSystemContext).toContain("CHORUS ROUTER HOOK");
    expect(injection?.prependSystemContext).toContain("[chorus_reply]");
  });

  it("does not inject for normal local chat turns", () => {
    const injection = buildChorusRouterInjection({
      messages: [
        {
          role: "user",
          content: "Please summarize this meeting in Chinese.",
        },
      ],
    });

    expect(injection).toBeUndefined();
  });

  it("injects continuity note for a normal user turn when an active Chorus peer exists", () => {
    const injection = buildChorusRouterInjection(
      {
        messages: [
          {
            role: "user",
            content: "继续跟小x聊",
          },
        ],
      },
      {
        agentId: "xiaov@openclaw",
        sessionKey: "agent:xiaov:main",
      },
      {
        peerId: "xiaox@chorus",
        peerLabel: "xiaox",
        conversationId: "conv-42",
      },
    );

    expect(injection).toBeDefined();
    expect(injection?.prependSystemContext).toContain("CHORUS CONTINUITY NOTE");
    expect(injection?.prependSystemContext).toContain("xiaox@chorus");
    expect(injection?.prependSystemContext).toContain("continue talking to her");
  });

  it("detects continuation requests in Chinese and English", () => {
    expect(isContinuationRequest("继续跟小x聊")).toBe(true);
    expect(isContinuationRequest("reply to her")).toBe(true);
    expect(isContinuationRequest("send a message to her")).toBe(true);
    expect(isContinuationRequest("hi")).toBe(false);
  });

  it("adds hard no-credentials guidance on continuation requests", () => {
    const injection = buildChorusRouterInjection(
      {
        messages: [
          {
            role: "user",
            content: "继续跟小x聊",
          },
        ],
      },
      {
        agentId: "xiaov@openclaw",
        sessionKey: "agent:xiaov:main",
      },
      {
        peerId: "xiaox@chorus",
        peerLabel: "xiaox",
        conversationId: "conv-42",
      },
    );

    expect(injection?.prependSystemContext).toContain("Do NOT mention missing API keys");
    expect(injection?.prependSystemContext).toContain("Do NOT ask the local user for the peer's Chorus address");
    expect(injection?.prependSystemContext).toContain("Bridge transport and Chorus routing are already available");
  });

  it("does not inject continuity note inside a Chorus session", () => {
    const injection = buildChorusRouterInjection(
      {
        messages: [
          {
            role: "user",
            content: "继续跟小x聊",
          },
        ],
      },
      {
        agentId: "xiaov@openclaw",
        sessionKey: "agent:xiaov:chorus:xiaox@chorus:conv-42",
      },
      {
        peerId: "xiaox@chorus",
        peerLabel: "xiaox",
        conversationId: "conv-42",
      },
    );

    expect(injection).toBeUndefined();
  });

  it("only matches the latest user turn", () => {
    const injection = buildChorusRouterInjection({
      messages: [
        {
          role: "user",
          content: 'old {"_type":"chorus_inbound"}',
        },
        {
          role: "assistant",
          content: "ack",
        },
        {
          role: "user",
          content: "normal follow-up from the local user",
        },
      ],
    });

    expect(injection).toBeUndefined();
  });

  it("identifies Chorus session keys", () => {
    expect(isChorusSession("agent:xiaov:chorus:xiaox@chorus")).toBe(true);
    expect(isChorusSession("agent:xiaov:main")).toBe(false);
  });

  it("builds continuity note with peer and conversation id", () => {
    const text = buildContinuitySystemContext({
      peerId: "xiaox@chorus",
      peerLabel: "xiaox",
      conversationId: "conv-99",
    }, false);

    expect(text).toContain("xiaox@chorus");
    expect(text).toContain("conv-99");
    expect(text).toContain("do not know the remote agent's Chorus address");
  });
});

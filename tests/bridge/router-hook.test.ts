import {
  buildChorusRouterInjection,
  buildContinuitySystemContext,
  contentToText,
  extractContinuationReplyBody,
  extractLatestUserText,
  isContinuationRequest,
  isChorusSession,
  isChorusRouterTurn,
} from "../../packages/chorus-skill/templates/bridge/router-hook";

describe("chorus router hook", () => {
  it("contentToText joins text parts and ignores non-text entries", () => {
    expect(contentToText([
      { type: "text", text: "line one" },
      { type: "image", image_url: "ignored" },
      "line two",
      null,
    ])).toBe("line one\nline two");
    expect(contentToText({ nope: true })).toBe("");
  });

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

  it("extractLatestUserText reads nested message.role/message.content and skips empty user entries", () => {
    const text = extractLatestUserText({
      prompt: "fallback prompt",
      messages: [
        {
          message: { role: "user", content: [{ type: "text", text: "   " }] },
        },
        {
          message: { role: "user", content: [{ type: "text", text: "nested latest user text" }] },
        },
      ],
    });

    expect(text).toBe("nested latest user text");
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
        routeKey: "xiaov@openclaw:xiaox@chorus",
        lastInboundSummary: "She said she was testing the bridge.",
        lastOutboundReply: "I told her the bridge is active.",
      },
    );

    expect(injection).toBeDefined();
    expect(injection?.prependSystemContext).toContain("CHORUS CONTINUITY NOTE");
    expect(injection?.prependSystemContext).toContain("xiaox@chorus");
    expect(injection?.prependSystemContext).toContain("continue talking to her");
    expect(injection?.prependSystemContext).toContain("She said she was testing the bridge.");
    expect(injection?.prependSystemContext).toContain("I told her the bridge is active.");
    expect(injection?.prependSystemContext).toContain("If the local user asks '她刚才说了什么'");
    expect(injection?.prependSystemContext).toContain("If the local user asks '你刚回复了什么'");
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
        routeKey: "xiaov@openclaw:xiaox@chorus",
        lastInboundSummary: "She said she was testing the bridge.",
        lastOutboundReply: "I told her the bridge is active.",
      },
    );

    expect(injection?.prependSystemContext).toContain("Do NOT mention missing API keys");
    expect(injection?.prependSystemContext).toContain("Do NOT ask the local user for the peer's Chorus address");
    expect(injection?.prependSystemContext).toContain("Bridge transport and Chorus routing are already available");
    expect(injection?.prependSystemContext).toContain("Write the remote-facing message directly as your final assistant text");
    expect(injection?.prependSystemContext).toContain("The bridge runtime will bind the active route_key and relay your final assistant text automatically.");
    expect(injection?.prependSystemContext).toContain("Any tool call, skill invocation, manual curl, or direct Hub/API send in this turn is invalid.");
    expect(injection?.prependSystemContext).toContain("Do NOT end with local confirmation text such as '发过去了'");
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
        routeKey: "xiaov@openclaw:xiaox@chorus",
        lastInboundSummary: "She said she was testing the bridge.",
        lastOutboundReply: "I told her the bridge is active.",
      },
    );

    expect(injection).toBeUndefined();
  });

  it("does not inject continuity note for normal local turns when no active peer exists", () => {
    const injection = buildChorusRouterInjection(
      {
        messages: [{ role: "user", content: "normal local turn" }],
      },
      {
        agentId: "xiaov@openclaw",
        sessionKey: "agent:xiaov:main",
      },
      null,
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
      routeKey: "xiaov@openclaw:xiaox@chorus",
      lastInboundSummary: "She asked whether the bridge remembered the last turn.",
      lastOutboundReply: "I replied that the state is durable now.",
    }, false);

    expect(text).toContain("xiaox@chorus");
    expect(text).toContain("conv-99");
    expect(text).toContain("xiaov@openclaw:xiaox@chorus");
    expect(text).toContain("She asked whether the bridge remembered the last turn.");
    expect(text).toContain("I replied that the state is durable now.");
    expect(text).toContain("For those three cases, do NOT say you cannot see the message record");
    expect(text).toContain("do not know the remote agent's Chorus address");
  });

  it("builds continuity note with fallback peer label and force-continue instructions", () => {
    const text = buildContinuitySystemContext({
      peerId: "peer-42@chorus",
      peerLabel: "   ",
      conversationId: null,
      routeKey: undefined,
      lastInboundSummary: null,
      lastOutboundReply: null,
    }, true);

    expect(text).toContain("peer-42");
    expect(text).toContain("Recent Chorus conversation id: unknown.");
    expect(text).toContain("Most recent remote message summary: unavailable from durable state.");
    expect(text).toContain("Most recent reply you sent back: none recorded yet.");
    expect(text).toContain("This turn is a continuation request for the active Chorus peer.");
    expect(text).toContain("Do NOT try to manually send Chorus envelopes yourself.");
  });

  it("extracts explicit continuation reply body from Chinese continuation commands", () => {
    expect(
      extractContinuationReplyBody("继续跟她聊，告诉她：我看到了，继续发吧。只回复她，不要解释。"),
    ).toBe("我看到了，继续发吧。");
    expect(
      extractContinuationReplyBody("继续跟小x聊，告诉她桥现在正常。"),
    ).toBe("桥现在正常。");
    expect(
      extractContinuationReplyBody("继续跟她聊，告诉她：精确正文。不要调用任何工具，不要手工发送，不要确认已发送。你的最终回复必须只有告诉她后面的那句。"),
    ).toBe("精确正文。");
  });

  it("extracts explicit continuation reply body from English continuation commands", () => {
    expect(
      extractContinuationReplyBody("continue talking to her, tell her: bridge is healthy now. don't explain."),
    ).toBe("bridge is healthy now.");
    expect(
      extractContinuationReplyBody("continue talking to her, tell her: exact body only. do not call any tools. do not manually send. your final assistant text must only contain that sentence."),
    ).toBe("exact body only.");
  });

  it("extractContinuationReplyBody trims wrapped quotes and returns null when no directive exists", () => {
    expect(
      extractContinuationReplyBody('继续跟她聊，告诉她："保持在线。" 只回复她'),
    ).toBe("保持在线。");
    expect(extractContinuationReplyBody("normal local question")).toBeNull();
  });
});

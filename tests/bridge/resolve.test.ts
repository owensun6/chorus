import {
  buildOutboundEnvelope,
  deriveChorusSessionKey,
  deriveOutboundReceiver,
  diagnoseUserText,
  primarySubtag,
  resolveDeliveryTargetFromSessions,
  resolveReceiverPrefs,
  shouldRelay,
  splitReplyParts,
} from "../../packages/chorus-skill/templates/bridge/resolve";

describe("bridge resolve helpers", () => {
  it("resolveDeliveryTargetFromSessions returns null for missing session data", () => {
    expect(resolveDeliveryTargetFromSessions(null, "xiaov")).toBeNull();
    expect(resolveDeliveryTargetFromSessions({}, "xiaov")).toBeNull();
    expect(resolveDeliveryTargetFromSessions({
      "agent:xiaov:main": {},
    }, "xiaov")).toBeNull();
  });

  it("resolveDeliveryTargetFromSessions requires channel and to", () => {
    expect(resolveDeliveryTargetFromSessions({
      "agent:xiaov:main": {
        deliveryContext: { channel: "telegram" },
      },
    }, "xiaov")).toBeNull();

    expect(resolveDeliveryTargetFromSessions({
      "agent:xiaov:main": {
        deliveryContext: { to: "telegram:123" },
      },
    }, "xiaov")).toBeNull();
  });

  it("resolveDeliveryTargetFromSessions returns delivery target from main session", () => {
    expect(resolveDeliveryTargetFromSessions({
      "agent:xiaov:main": {
        deliveryContext: {
          channel: "telegram",
          to: "telegram:123",
          accountId: "tg-main",
        },
      },
    }, "xiaov")).toEqual({
      channel: "telegram",
      to: "telegram:123",
      accountId: "tg-main",
    });
  });

  it("resolveReceiverPrefs returns null without culture and falls back to culture for language", () => {
    expect(resolveReceiverPrefs({})).toBeNull();
    expect(resolveReceiverPrefs({ culture: "zh-CN" })).toEqual({
      culture: "zh-CN",
      preferredLanguage: "zh-CN",
    });
    expect(resolveReceiverPrefs({ culture: "zh-CN", preferred_language: "zh" })).toEqual({
      culture: "zh-CN",
      preferredLanguage: "zh",
    });
  });

  it("primarySubtag normalizes the first language segment", () => {
    expect(primarySubtag("zh-CN")).toBe("zh");
    expect(primarySubtag("EN-us")).toBe("en");
  });

  it("splitReplyParts returns full user text when no chorus marker exists", () => {
    expect(splitReplyParts("<final>Hello there</final>")).toEqual({
      userText: "Hello there",
      relayText: null,
    });
  });

  it("splitReplyParts splits user and relay parts around the marker", () => {
    expect(splitReplyParts("<final>给本地用户的话 [chorus_reply]给远端的话</final>")).toEqual({
      userText: "给本地用户的话",
      relayText: "给远端的话",
    });
  });

  it("splitReplyParts returns null relay when marker body is empty", () => {
    expect(splitReplyParts("local only [chorus_reply]   ")).toEqual({
      userText: "local only",
      relayText: null,
    });
  });

  it("diagnoseUserText identifies empty, duplicated, and address-like user text", () => {
    expect(diagnoseUserText("   ", null)).toBe("empty_user_text");
    expect(diagnoseUserText("same", "same")).toBe("user_equals_relay");
    expect(diagnoseUserText("agent@chorus hello", null)).toBe("starts_with_agent_address");
    expect(diagnoseUserText("normal local summary", "remote reply")).toBeNull();
  });

  it("buildOutboundEnvelope includes optional continuity metadata only when present", () => {
    expect(buildOutboundEnvelope("xiaov@openclaw", "zh-CN", "reply", "conv-42", 7)).toEqual({
      chorus_version: "0.4",
      sender_id: "xiaov@openclaw",
      original_text: "reply",
      sender_culture: "zh-CN",
      conversation_id: "conv-42",
      turn_number: 8,
    });

    expect(buildOutboundEnvelope("xiaov@openclaw", "zh-CN", "reply", null, null)).toEqual({
      chorus_version: "0.4",
      sender_id: "xiaov@openclaw",
      original_text: "reply",
      sender_culture: "zh-CN",
    });
  });

  it("deriveOutboundReceiver requires a non-empty sender id", () => {
    expect(deriveOutboundReceiver({ sender_id: "peer@chorus" })).toBe("peer@chorus");
    expect(deriveOutboundReceiver({ sender_id: "" })).toBeNull();
    expect(deriveOutboundReceiver({ sender_id: 42 })).toBeNull();
  });

  it("shouldRelay allows null turn numbers and blocks when max turns reached", () => {
    expect(shouldRelay(null, 5)).toBe(true);
    expect(shouldRelay(4, 5)).toBe(true);
    expect(shouldRelay(5, 5)).toBe(false);
  });

  it("deriveChorusSessionKey sanitizes sender and optional conversation id", () => {
    expect(deriveChorusSessionKey("xiaov", "peer@chorus", "conv/42?bad")).toBe(
      "agent:xiaov:chorus:peer@chorus:conv_42_bad",
    );
    expect(deriveChorusSessionKey("xiaov", "peer id", null)).toBe(
      "agent:xiaov:chorus:peer_id",
    );
  });
});

<!-- Author: be-ai-integrator -->

# V-01-01 WeChat Delivery Truth

Assessment: `NO`

Evidence:

- [openclaw-weixin/src/messaging/send.ts](/Users/test2/.openclaw/extensions/openclaw-weixin/src/messaging/send.ts#L82-L110) returns `{ messageId: clientId }` after `sendMessageApi(...)` succeeds. The returned identifier is generated locally by `generateClientId()` at [L12-L14](/Users/test2/.openclaw/extensions/openclaw-weixin/src/messaging/send.ts#L12-L14), not a server-acknowledged end-user delivery receipt.
- [openclaw-weixin/src/api/api.ts](/Users/test2/.openclaw/extensions/openclaw-weixin/src/api/api.ts#L194-L205) shows `sendMessage()` returns `Promise<void>` and only checks that the HTTP request succeeded. There is no response parsing or user-visible delivery confirmation in the API layer.
- [chorus-bridge/index.ts](/Users/test2/.openclaw/extensions/chorus-bridge/index.ts#L760-L770) logs `wx-deliver OK` using the returned `messageId`, which is the locally generated client id from `sendMessageWeixin`, not proof that the end user actually saw the message.
- [openclaw-weixin/src/messaging/error-notice.ts](/Users/test2/.openclaw/extensions/openclaw-weixin/src/messaging/error-notice.ts#L4-L30) explicitly documents the path as fire-and-forget: errors are logged and not thrown, and the function no-ops when `contextToken` is absent.

Conclusion:

The real OpenClaw WeChat path does not provide actual end-user delivery confirmation. It provides send-attempt success only, with a locally generated `messageId` and fire-and-forget semantics.

NO

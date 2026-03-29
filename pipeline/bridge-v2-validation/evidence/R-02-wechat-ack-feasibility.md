<!-- Author: validation-worker -->

# R-02: WeChat Delivery ACK Feasibility Assessment

## Host Path Analysis

The full delivery path for WeChat messages is:

```
Bridge (runtime-v2.ts, line 994)
  -> sendMessageWeixin()        [openclaw-weixin/src/messaging/send.ts:82-110]
    -> sendMessageApi()          [openclaw-weixin/src/api/api.ts:195-206]
      -> apiFetch()              [openclaw-weixin/src/api/api.ts:92-125]
        -> HTTP POST to ilink/bot/sendmessage
```

This is the WeChat iLink Bot API -- a Tencent WeChat bot framework API (package: `@tencent-weixin/openclaw-weixin`). It is NOT the WeChat Official Account (gongzhonghao) Customer Service API, nor is it the WeChat Work (qiye weixin) API. It is the iLink Bot protocol used by the OpenClaw agent framework to interact with WeChat users.

The API base URL is per-account (resolved via `resolveWeixinAccount`), with `Bearer` token auth and an `ilink_bot_token` auth type header.

## API Response Shape

### Documented response for `sendmessage` endpoint

The official README (`openclaw-weixin/README.md`, lines 124-143) documents the `sendMessage` endpoint with **request body only** and **no response body section**. Every other endpoint (`getUpdates`, `getUploadUrl`, `getConfig`) has an explicit "Response body" section with documented fields. The `sendMessage` entry has none.

### Type definition

```typescript
// openclaw-weixin/src/api/types.ts, lines 193-195
export interface SendMessageResp {
  // empty
}
```

The type definition explicitly declares the response as empty. Compare with other response types in the same file:
- `GetUpdatesResp`: has `ret`, `errcode`, `errmsg`, `msgs`, `get_updates_buf` (lines 174-186)
- `SendTypingResp`: has `ret`, `errmsg` (lines 211-214)
- `GetConfigResp`: has `ret`, `errmsg`, `typing_ticket` (lines 217-222)

### API function implementation

```typescript
// openclaw-weixin/src/api/api.ts, lines 195-206
export async function sendMessage(
  params: WeixinApiOptions & { body: SendMessageReq },
): Promise<void> {
  await apiFetch({
    baseUrl: params.baseUrl,
    endpoint: "ilink/bot/sendmessage",
    body: JSON.stringify({ ...params.body, base_info: buildBaseInfo() }),
    token: params.token,
    timeoutMs: params.timeoutMs ?? DEFAULT_API_TIMEOUT_MS,
    label: "sendMessage",
  });
}
```

The function returns `Promise<void>`. The `apiFetch` call does return `rawText` (line 120 of api.ts), and logs it at debug level (line 116: `sendMessage status=${res.status} raw=${redactBody(rawText)}`), but the `sendMessage` wrapper discards it entirely. There is no parsing, no return value.

### Upstream caller

```typescript
// openclaw-weixin/src/messaging/send.ts, lines 82-110
export async function sendMessageWeixin(params: {
  to: string;
  text: string;
  opts: WeixinApiOptions & { contextToken?: string };
}): Promise<{ messageId: string }> {
  // ...
  const clientId = generateClientId();   // locally generated ID (line 92)
  // ...
  await sendMessageApi({ ... });          // fire-and-forget (line 100-105)
  return { messageId: clientId };          // returns LOCAL client ID (line 110)
}
```

The `messageId` returned is `generateClientId()` which produces a locally generated string (format: `openclaw-weixin-{random}`). This is NOT a server-assigned message identifier.

## Server ACK Availability

**NO.** The iLink Bot `sendmessage` endpoint does not return a server-acknowledged message ID or any server-side delivery confirmation identifier.

Evidence:
1. The `SendMessageResp` type is explicitly `{ // empty }` (types.ts:193-195)
2. The `sendMessage` API function returns `Promise<void>` (api.ts:195-206), discarding the response body
3. The official README documents no response fields for this endpoint (README.md:124-143)
4. The `sendMessageWeixin` caller generates a client-side ID and returns it as `messageId` (send.ts:92, 110)
5. Contrast with `WeixinMessage.message_id` (types.ts:150) which is a `number` assigned by the server on INBOUND messages -- no equivalent exists for outbound

## Current Code State

The Bridge runtime-v2.ts (lines 1027-1038) correctly handles this limitation:

```typescript
recordUnverifiableDelivery(this.ctx, this.log, {
  traceId: params.metadata.trace_id,
  peer: params.metadata.sender_id,
  channel: target.channel,
  method: "weixin_api_accepted",
});
deliveryReceipt = {
  status: "unverifiable",
  method: "weixin_api_accepted",
  ref: sendOutcome.value.messageId ?? null,  // local client ID, not server ACK
  timestamp,
};
```

The code already categorizes WeChat delivery as `"unverifiable"` with method `"weixin_api_accepted"`. The `ref` field contains the locally-generated client ID. This is semantically accurate -- it proves the API call succeeded (HTTP 200), but does not prove end-user-visible delivery.

## Verdict: NO-GO

### Reason

The WeChat iLink Bot API `sendmessage` endpoint is fire-and-forget by protocol design. The server acknowledges receipt of the HTTP request (via HTTP 200), but provides no message ID, no delivery status, and no server-side identifier in the response body. The response type is explicitly documented as empty.

### API Limitation Level: FUNDAMENTAL

This is not an implementation gap in the Chorus code. It is a fundamental limitation of the iLink Bot protocol:
- The protocol defines `SendMessageResp` as empty
- The official documentation omits response fields for this endpoint
- Server-assigned `message_id` exists only on inbound messages (`WeixinMessage.message_id: number`), not on outbound sends
- There is no webhook/callback mechanism documented for delivery confirmation

### Mitigation

There is no alternative evidence of end-user delivery available through this API. The strongest signal currently available is:
1. HTTP 200 from the API call (proves server accepted the request)
2. No exception thrown (proves the network path succeeded)

The current `"unverifiable"` + `"weixin_api_accepted"` categorization in runtime-v2.ts is the correct and honest representation of what can be verified. Upgrading to `"confirmed"` is not possible without a protocol-level change from the upstream WeChat iLink Bot API.

### Comparison with Telegram Path

For reference, the Telegram Bot API `sendMessage` endpoint returns a `Message` object containing `message_id` (server-assigned), `chat`, `date`, etc. The Chorus Telegram path could theoretically parse this response to obtain a server ACK -- but the current `sendTelegramMessage` function (runtime-v2.ts:456-477) also returns `Promise<void>`, discarding the response. This means Telegram has a CODE-LEVEL gap (fixable), while WeChat has a PROTOCOL-LEVEL gap (not fixable without upstream API changes).

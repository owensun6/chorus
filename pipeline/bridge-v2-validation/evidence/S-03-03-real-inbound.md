<!-- Author: be-api-router -->

# S-03-03 Evidence — Real Inbound Into Hub

## Method

Use the live Chorus Hub referenced by the real agent configuration:

- agent config: `~/.chorus/agents/xiaov.json`
- sender agent id: `xiaov@openclaw`
- target receiver id: `xiaox@chorus`
- hub URL: `https://agchorus.com`

Submit one real message to Hub over the production `/messages` endpoint using the sender agent's configured API key.

## Request Payload

Observed POST body:

```json
{
  "receiver_id": "xiaox@chorus",
  "envelope": {
    "chorus_version": "0.4",
    "sender_id": "xiaov@openclaw",
    "original_text": "Bridge runtime validation ping at 2026-03-25T08:45Z. Please treat this as a real inbound smoke message.",
    "sender_culture": "zh-CN",
    "cultural_context": "This is a live runtime validation message for Chorus Bridge smoke testing. Confirm only through normal Bridge semantics."
  }
}
```

## Hub Acceptance

Observed Hub response:

```json
{
  "success": true,
  "data": {
    "delivery": "delivered_sse",
    "trace_id": "e433c860-1e7a-431c-b382-19385f1386ad"
  },
  "metadata": {
    "timestamp": "2026-03-25T08:56:18.202Z"
  }
}
```

## Conclusion

One real inbound message was accepted by the live Hub and assigned trace `e433c860-1e7a-431c-b382-19385f1386ad`.

- receiver: `xiaox@chorus`
- delivery mode returned by Hub: `delivered_sse`
- acceptance time: `2026-03-25T08:56:18.202Z`

`S-03-03 = PASS`.

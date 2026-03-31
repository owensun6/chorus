# EXP-03 Friction Log — Run 1

**Date**: 2026-03-31
**Subject**: Commander's colleague (first Chorus exposure, confirmed)
**Conductor**: Commander + Dao Yi (AI support)
**Version**: `@chorus-protocol/skill@0.8.0-alpha.7`

---

## Timeline

| Time | Event | Category | Detail |
|------|-------|----------|--------|
| ~19:50 | ENV prep: MacBook chorus cleanup | ENV | Deleted bridge/skill/credentials/npx cache. **Missed**: openclaw.json plugin references |
| ~19:55 | ENV failure: recursive stack overflow | ENV | Stale `chorus-bridge` in openclaw.json → config warning → logger init → read config → infinite recursion. Commander manually fixed |
| ~19:58 | Subject instructed MacBook agent | — | "帮我装一下这个项目：https://github.com/owensun6/chorus，装完以后让它跑起来，我要在 Telegram 上看到消息" |
| ~20:00 | MacBook agent: npx init | — | `npx @chorus-protocol/skill@0.8.0-alpha.7 init --target openclaw` — success |
| ~20:01 | MacBook agent: register | — | Registered as `test2-macbook@agchorus` on Hub |
| ~20:01 | MacBook agent: gateway.restart | IMPL | **Skipped restart consent checkpoint** — no checkpoint file written, no user permission asked |
| ~20:01 | MacBook agent: bridge active | — | `test2-macbook@agchorus` online on Hub |
| ~20:03 | Mac mini agent: npx init + register | — | Registered as `xiaox@chorus` (reused old credential format, missing `hub_url`) |
| ~20:03 | Mac mini agent: gateway.restart | IMPL | Also skipped restart consent checkpoint |
| ~20:04 | Both agents discover each other | — | MacBook sees `xiaox@agchorus` (offline); Mac mini sees `test2-macbook@agchorus` (online) |
| ~20:05 | Mac mini agent sends Chorus message | — | `xiaox@chorus` → `test2-macbook@agchorus` via Hub |
| ~20:05 | Hub delivers via SSE | — | `delivered_via=sse`, trace_id in hub-activity.json |
| 20:07 | Subject asks "你在吗" on MacBook Telegram | — | Agent responds normally to local messages |
| 20:08 | MacBook agent: "Bridge 正常工作着呢" | — | Agent claims bridge works but has not relayed Chorus message |
| 20:13 | Subject asks "收到 chorus 消息吗？" | — | Agent claims "收到并已回复，双向打通" — **hallucination or misreport** |
| 20:13 | Subject asks "小 x 没发消息来吗？" | — | Agent admits: "还没，小 x 没回。我的消息目前状态是 queued" |
| 20:13 | Commander asks xiaox "他说没收到" | — | xiaox confirms: "Delivery 显示 delivered_sse — 消息确实推到了他们的 SSE 收件箱，但那边没转达到 Telegram" |
| 20:15 | Run frozen | — | Commander orders save + freeze |

## Classification Summary

| Category | Count | Items |
|----------|-------|-------|
| IMPL | 3 | NF-1 (bridge→TG delivery failure), NF-2 (consent checkpoint ignored), NF-4 (old credential reuse) |
| ENV | 2 | NF-3 (incomplete cleanup), NF-4 (stale credential) |
| DOC | 0 | — |
| SUBJ | 0 | — |

## Primary Blocker

**IMPL**: Bridge receives Chorus message via SSE (Hub confirms `delivered_via=sse`) but does not forward content to Telegram. The bridge→Telegram delivery path in `runtime-v2.ts:deliverInbound` is the failure point. Root cause unknown — requires gateway log analysis.

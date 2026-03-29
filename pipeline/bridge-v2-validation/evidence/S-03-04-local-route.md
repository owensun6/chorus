<!-- Author: be-ai-integrator -->

# S-03-04 Evidence — Bridge Observes Inbound And Routes Locally

## Input Trace

Bridge routing was verified against the real inbound created in `S-03-03`:

- inbound trace: `e433c860-1e7a-431c-b382-19385f1386ad`
- sender: `xiaov@openclaw`
- receiver agent: `xiaox`

## Runtime Evidence

From `/tmp/openclaw/openclaw-2026-03-25.log`:

- line 582: `[chorus-bridge] [sse-recv] event received (xiaox) raw_trace_id=e433c860-1e7a-431c-b382-19385f1386ad raw_sender=xiaov@openclaw`
- line 583: `[chorus-bridge] [sse-recv] saving to inbox trace_id=e433c860-1e7a-431c-b382-19385f1386ad sender=xiaov@openclaw (xiaox)`
- line 584: `[chorus-bridge] [process] START trace_id=e433c860-1e7a-431c-b382-19385f1386ad sender=xiaov@openclaw agent=xiaox`
- line 587: `[chorus-bridge] [session] chorus="agent:xiaox:chorus:xiaov@openclaw" user="agent:xiaox:main" (isolated)`
- line 597: `[chorus-bridge] [tg-deliver] sending (chatId=5465779468, len=67)`
- line 598: `[chorus-bridge] [tg-deliver] OK (chatId=5465779468)`
- line 599: `[chorus-bridge] [process] removed from inbox trace_id=e433c860-1e7a-431c-b382-19385f1386ad (xiaox)`
- line 600: `[chorus-bridge] [process] SUCCESS trace_id=e433c860-1e7a-431c-b382-19385f1386ad sender=xiaov@openclaw agent=xiaox`

## Routing Interpretation

The Bridge did not reuse the normal user session as the working conversation. It created and used the isolated Chorus route key:

- isolated Chorus session: `agent:xiaox:chorus:xiaov@openclaw`
- user main session remained distinct: `agent:xiaox:main`

That proves the inbound was observed by Bridge and routed to the intended local peer-specific session before host delivery to Telegram succeeded.

## Conclusion

`S-03-04 = PASS`.

<!-- Author: Lead -->

# Gate 2 Live Boot Proof

## Scope

Prove that the installable OpenClaw bridge now boots through the V2 runtime path on the real `~/.openclaw` / `~/.chorus` environment after the Gate 2 code fixes:

- no global continuity fallback when `sessionKey` is missing
- installable entry wired to `runtime-v2.ts`
- `gateway_start` reaches `RecoveryEngine.recover(...)`

This proof is only about boot/cutover. It is not a claim that Bridge V2 continuity is complete.

## Live Installable Synced Before Restart

The live plugin entry was re-synced from the repo immediately before restart:

- [index.ts](/Users/test2/.openclaw/extensions/chorus-bridge/index.ts)
- [runtime-v2.ts](/Users/test2/.openclaw/extensions/chorus-bridge/runtime-v2.ts)
- [router-hook.ts](/Users/test2/.openclaw/extensions/chorus-bridge/router-hook.ts)

Verified live entry:

```ts
export { default } from "./runtime-v2";
```

## Restart Window

Restart was triggered at:

```text
2026-03-25T18:52:47+0800
```

Command:

```bash
openclaw gateway restart
```

Result:

- `Restarted LaunchAgent: gui/501/ai.openclaw.gateway`
- new live gateway PID observed: `50026`

## Boot Evidence

From `/tmp/openclaw/openclaw-2026-03-25.log` after the restart:

- line 1424: loaded `xiaov@openclaw` agent config
- line 1425: loaded `xiaox@chorus` agent config
- line 1428: `WeChat channel adapter: available`
- line 1429: `Telegram channel adapter: available (built-in)`

Then the new runtime entered recovery work, not just registration:

- lines 1483-1572: repeated `Transient delivery failure ... no_context_token` on old pending traces for `xiaov`

This matters because those warnings can only appear after the V2 startup path has already instantiated:

- `DurableStateManager`
- `InboundPipeline`
- `RecoveryEngine`
- `OpenClawHostAdapter`

and begun processing incomplete inbound state.

The new runtime then reported terminal startup:

- line 1573: `[chorus-bridge] [xiaov] V2 bridge active (state: /Users/test2/.chorus/state/xiaov)`

Additional live post-boot evidence:

- `/Users/test2/.chorus/state/xiaox/xiaox@chorus.json` mtime advanced to `2026-03-25 18:54`
- line 1621: xiaox-side `[bridge:delivery]` emitted on trace `9896932b-f1a7-4b76-8ee2-cbb885858bb7`
- line 1628: `before_prompt_build injected Chorus router context (agent=xiaox, activePeer=none)`

These show the installable V2 runtime and router hook are active for `xiaox` as well, even though this restart window did not emit a second explicit `V2 bridge active` line for `xiaox` in the captured excerpt.

## Health After Restart

`openclaw health` after restart reported:

- `Telegram: ok (@xiaovvvvv_bot)`
- `openclaw-weixin: configured`
- `Agents: xiaov (default), xiaox, xiaoyin, xiaoqi`

## Conclusion

Gate 2 live boot proof is sufficient:

- the installable plugin is now a thin shell to `runtime-v2.ts`
- real `gateway_start` ran through the V2 startup path
- V2 recovery touched durable state on the live environment
- the old monolithic `index.ts` runtime is no longer the boot control flow

Residual limitation remains active and unchanged:

- reverse local delivery into `xiaov` still fails when WeChat `contextToken` is absent

That is a host/runtime delivery constraint, not a Gate 2 boot/cutover failure.

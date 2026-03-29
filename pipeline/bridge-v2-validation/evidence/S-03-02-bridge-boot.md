<!-- Author: Commander -->

# S-03-02 Evidence — Bridge Runtime Boot

## Method

Use the real OpenClaw environment already configured under:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/extensions/chorus-bridge`
- `~/.chorus/agents/xiaov.json`
- `~/.chorus/agents/xiaox.json`

Then perform a controlled gateway restart:

```sh
openclaw gateway restart
```

## Post-Restart Runtime Evidence

From `/tmp/openclaw/openclaw-2026-03-25.log` after the restart window beginning at `2026-03-25T08:43:51Z`:

- `2026-03-25T08:44:06.629Z` — `[chorus-bridge] catch-up (xiaov): 0 rows, 0 processed, cursor=2152`
- `2026-03-25T08:44:06.637Z` — `[chorus-bridge] [xiaov] bridge active (state: /Users/test2/.chorus/state/xiaov)`
- `2026-03-25T08:44:07.735Z` — `[chorus-bridge] [sse] connected hub=https://agchorus.com agent=xiaov agent_id=xiaov@openclaw`
- `2026-03-25T08:44:07.742Z` — `[chorus-bridge] SSE handshake OK (xiaov)`
- `2026-03-25T08:44:07.750Z` — `[chorus-bridge] catch-up (xiaox): 0 rows, 0 processed, cursor=2152`
- `2026-03-25T08:44:07.757Z` — `[chorus-bridge] [xiaox] bridge active (state: /Users/test2/.chorus/state/xiaox)`
- `2026-03-25T08:44:08.150Z` — `[chorus-bridge] [sse] connected hub=https://agchorus.com agent=xiaox agent_id=xiaox@chorus`
- `2026-03-25T08:44:08.158Z` — `[chorus-bridge] SSE handshake OK (xiaox)`

## Supporting Health Probe

`openclaw health` after restart reported:

- `Telegram: ok (@xiaovvvvv_bot)`
- `openclaw-weixin: configured`
- `Agents: xiaov (default), xiaox, xiaoyin, xiaoqi`

## Conclusion

Real Bridge runtime boot is now proven on the live environment.

- `xiaov` booted, caught up, activated Bridge state, and connected SSE
- `xiaox` booted, caught up, activated Bridge state, and connected SSE

`S-03-02 = PASS`.

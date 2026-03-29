<!-- Author: Commander -->

# S-03-02 Attempt — Bridge Runtime Boot Blocked

## Goal

Boot Bridge runtime against the locally booted Hub without touching the user's live `~/.chorus` state.

## Isolation Strategy Attempted

1. Start local Hub on `http://127.0.0.1:3101`.
2. Create isolated home at `tmp/bridge-home`.
3. Self-register temporary local agents (`bridgeval@local`, `bridgeval2@local`) against the local Hub.
4. Write isolated `tmp/bridge-home/.chorus/config.json` with the returned API key and local Hub URL.
5. Mount `chorus-bridge` and `openclaw-weixin` under the isolated home.
6. Run:

```sh
HOME=/Volumes/XDISK/chorus/tmp/bridge-home openclaw --dev gateway run --allow-unconfigured --port 19011 --verbose
HOME=/Volumes/XDISK/chorus/tmp/bridge-home openclaw --dev gateway run --allow-unconfigured --port 19012 --verbose
```

## Observed Results

- The isolated OpenClaw gateway itself boots successfully.
- The isolated gateway logs do **not** contain:
  - `chorus-bridge`
  - `registered, waiting for gateway_start`
  - `loaded agent config`
  - `bridge active`
  - `SSE handshake OK`
- `HOME=/Volumes/XDISK/chorus/tmp/bridge-home openclaw plugins list` shows only stock plugin roots and does not discover the mounted local `chorus-bridge`.
- `openclaw plugins install` rejects the local plugin path with:
  - `Invalid path: must stay within extensions directory`

## Blocker

The isolated OpenClaw dev environment does not discover or accept the local `chorus-bridge` plugin via the attempted mount/install paths. This prevents a safe isolated proof of `gateway_start` and Bridge SSE boot.

## Conclusion

`S-03-02` remains unresolved.

What is proven:
- the local Hub can boot
- isolated OpenClaw can boot

What is not yet proven:
- isolated OpenClaw can load `chorus-bridge`
- `gateway_start` runs
- Bridge catches up and connects SSE to the local Hub

## Required Next Step

Use one of these supported paths before retrying `S-03-02`:

1. Identify the correct OpenClaw-supported plugin install root for isolated profiles and install `chorus-bridge` there.
2. Or, explicitly choose to boot against the live home (`~/.openclaw` + `~/.chorus`) and accept the side effects.

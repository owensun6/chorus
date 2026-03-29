<!-- Author: V-01-05 -->

# V-01-05 Evidence — Timeout Late-Send Risk

## Question

Can a host send timeout still result in a later successful local send?

## Evidence

- Bridge timeout is implemented with `Promise.race(...)` in [inbound.ts](/Volumes/XDISK/chorus/src/bridge/inbound.ts#L211-L247). When the timeout wins, Bridge marks the delivery as `unverifiable`, but the code comment explicitly states the underlying send may already have completed.
- The OpenClaw host adapter forwards delivery to `this.config.channel.send(...)` in [openclaw.ts](/Volumes/XDISK/chorus/src/bridge/adapters/openclaw.ts#L105-L123). This path does not expose any cancel/abort handle back to Bridge.
- The outbound relay path in [relay.ts](/Users/test2/.openclaw/extensions/chorus-bridge/relay.ts#L34-L76) awaits a normal `fetch(...)` call and returns only after the HTTP exchange, with no cancellation proof that a late completion cannot happen after Bridge-side timeout handling.

## Conclusion

- Cancellation cannot be proven from the implemented host path.
- Bridge-side timeout does not prevent the underlying send from succeeding later.
- Per task rule, the correct assessment is YES.

YES

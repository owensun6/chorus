<!-- Author: be-domain-modeler -->

# Delivery Truth

## Source of Truth

Current host delivery truth for Bridge validation is `unverifiable acceptable`.

This means:
- WeChat and Telegram host paths are treated as fire-and-forget for the current validation scope.
- Bridge must not assume `confirmed` delivery by default for these channels.
- When the host cannot prove end-user-visible delivery, Bridge must record `delivery_unverifiable` as the honest outcome.

## Evidence

- [V-01-01 WeChat Delivery Truth](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/evidence/V-01-01-wechat-delivery.md) concludes `NO` for confirmed delivery.
- [V-01-02 Telegram Delivery Truth](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/evidence/V-01-02-telegram-delivery.md) concludes `NO` for confirmed delivery.
- [A-B2 Verification Report](/Volumes/XDISK/chorus/pipeline/bridge-v2/2_planning/specs/A-B2-verification-report.md) assesses current host delivery confirmation as fire-and-forget only and recommends `unverifiable` for current runtime paths.

## Contract

For the current host paths:
- `confirmed` is not the default truth.
- `unverifiable` is the correct default when the host cannot prove visible delivery.
- Any document or implementation that implies confirmed end-user receipt for the current host paths is contradictory and must be rewritten against this source of truth.

## Scope

This document governs validation semantics for the current Bridge runtime validation effort.
It does not claim that no host runtime can ever support `confirmed`.
It only states that the currently verified host paths do not support it, so validation must use `unverifiable acceptable`.

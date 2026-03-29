---
id: gene-20260327-file-mailbox-between-codex-windows
trigger: 'when coordination is needed between two independent Codex windows in the same repo'
action: 'use ./.codex/comm as a shared mailbox with bin/comm-send.sh and bin/comm-watch.sh; bootstrap the peer once; if direct script execution is blocked on macOS, remove com.apple.provenance xattr before debugging further'
confidence: 0.8
topic: 'workflow'
universality: 'conditional'
project_types: ['multi-agent', 'local-collaboration']
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-27'
updated: '2026-03-27'
evidence:
  - date: '2026-03-27'
    context: 'User was manually relaying messages between two Codex windows. Direct UI-to-UI injection was not possible, but a shared filesystem mailbox under .codex/comm removed the need for per-turn copy-paste after a one-time bootstrap prompt in the peer window.'
  - date: '2026-03-27'
    context: 'bin/comm-send.sh and bin/comm-watch.sh initially failed under direct execution because of com.apple.provenance. After removing that xattr, send alpha->beta and watch beta --once both worked and messages were archived under .codex/comm/archive/.'
---

# File Mailbox Between Codex Windows

## Action

When two independent Codex windows need continuous coordination in the same repo, do not ask the user to shuttle every message manually. Use `./.codex/comm/` as the shared mailbox, give each window a mailbox id, and bootstrap the peer window once with the exact `comm-watch` and `comm-send` commands it should use. Be explicit that direct chat-UI injection between existing Codex windows is not available, so the file mailbox is the supported workaround. If freshly created scripts refuse direct execution on macOS, remove `com.apple.provenance` first before treating the mailbox flow as broken.

## Evidence

- 2026-03-27: A mailbox protocol using `bin/comm-send.sh` and `bin/comm-watch.sh` replaced manual copy-paste between two Codex windows without requiring `tmux`.
- 2026-03-27: Direct execution failed until `com.apple.provenance` was removed from the new scripts; afterward the send/watch loop worked and archived processed messages automatically.

---
id: gene-20260321-deploy-before-docs
trigger: 'when writing user-facing documentation for a deployable service'
action: 'deploy and verify first, write user guide from real observed behavior — never write docs from design specs alone'
confidence: 0.8
topic: 'workflow'
universality: 'global'
project_types: []
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-21'
updated: '2026-03-21'
evidence:
  - date: '2026-03-21'
    context: 'Commander explicitly ordered: "user guide 要依赖真实公网地址、真实错误语义、真实 key 发放方式。先部署，不先写 user guide。" Correct sequence: deploy → verify on real network → observe real error codes and latencies → write docs from observed truth. Docs written from design specs drift from reality.'
---

# Deploy Before Documenting

## Action

For user-facing documentation (user guides, API docs, onboarding guides), always:

1. Deploy the service first
2. Run smoke tests on the real public endpoint
3. Observe real HTTP codes, real error messages, real latencies
4. Write docs based on observed behavior, using real URLs

Never write user docs from design specs or localhost testing alone. The gap between "designed behavior" and "deployed behavior" is where documentation drift lives.

## Evidence

- 2026-03-21: Commander caught that writing user guide before deployment would produce docs with placeholder URLs, assumed error messages, and unverified behavior. Ordered deploy-first sequence. Result: user guide written with real `chorus-alpha.fly.dev` URL, real 198ms latency data, real error codes verified on public network.

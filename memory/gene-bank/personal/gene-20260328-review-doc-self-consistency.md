---
id: gene-20260328-review-doc-self-consistency
trigger: 'when writing a review report that will be updated with remediation status'
action: 'either freeze the original findings as historical record and append a separate current-state section, or rewrite entirely as current-state — never mix "this is a problem" and "this is fixed" in the same section'
confidence: 0.7
topic: 'workflow'
universality: 'global'
project_types: []
role_binding: 'lead'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-28'
updated: '2026-03-28'
evidence:
  - date: '2026-03-28'
    context: 'Codex review report v1.2 had H-02/M-01/M-02/M-03 listed as current problems in S3 while S6 marked them as fixed — Commander caught the self-contradiction and required full rewrite to current-state version'
---

# Review Document Self-Consistency

## Action

When a review report undergoes remediation, the document must be either:
1. **Frozen original + appended addendum** — original findings stay as-is with a clearly separated "Remediation Status" section
2. **Full rewrite to current state** — all sections reflect post-remediation reality

Never patch individual sections (mark items as "fixed" in one place) while leaving other sections (problem descriptions, summary tables, scores) in their original pre-fix wording.

Also: anchor the document to concrete commit hashes, not relative refs like `HEAD~5` that drift. If changes haven't been committed yet, say "current worktree" — don't cite a hash that doesn't contain the changes.

## Evidence

- 2026-03-28: v1.2 report had S3 describing H-02 as a current shell injection problem while S6 said "H-02 已修". S5 file table still showed `let FAIL` and `Author FAIL` for files that had already been fixed. Commander required v2.0 full rewrite.

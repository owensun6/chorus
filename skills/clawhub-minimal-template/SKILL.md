---
name: your_skill_name
description: A minimal ClawHub-ready skill template. Replace the name, description, and body with your real skill behavior before publishing.
metadata: {"summary":"Minimal publishable OpenClaw skill template for ClawHub","tags":["template","starter"]}
---

# Your Skill Title

Replace this section with one paragraph that states:
- what the skill does
- when it should be used
- what outcome it produces

## When To Use

Use this skill when the user needs:
- <primary task>
- <secondary task>
- <specific workflow>

Do not use this skill for:
- <out-of-scope task>
- <another out-of-scope task>

## Required Inputs

Before acting, confirm or infer:
- <input 1>
- <input 2>
- <input 3>

If a required input is missing and cannot be inferred safely, ask for it once and keep the question short.

## Workflow

1. Read the user request and identify the exact task.
2. Gather only the context required to complete that task.
3. Execute the task directly.
4. Validate the result with the smallest reliable check.
5. Return the result in a concise, user-facing format.

## Output Rules

- Prefer concise answers.
- Cite concrete file paths, commands, or artifacts when relevant.
- Do not claim completion without a real check.
- If blocked, state the blocker explicitly and stop.

## Validation

Minimum validation before claiming success:
- confirm the expected file exists, if the skill creates files
- run the narrowest relevant check, if the skill changes code or config
- report what was verified and what was not

## Notes

- Keep this file self-contained unless a larger skill truly needs `scripts/`, `references/`, or `assets/`.
- Keep frontmatter keys on single lines for parser compatibility.
- Keep `name` unique and stable. Use snake_case.

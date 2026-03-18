---
description: 【物理路由】根据需求自动分流到对应阶段和兵种
argument-hint: ''
allowed-tools: Bash, Read, Glob, Grep, Write, Edit
---

# Fusion Router

> Dispatch tasks to specific Fusion-Core roles

## Usage

```
/fusion-router --role <role_name> --task <task_file>
```

## Parameters

| Parameter | Required | Description                                          |
| --------- | -------- | ---------------------------------------------------- |
| `--role`  | Yes      | The role to dispatch (pm, lead, fe-ui-builder, etc.) |
| `--task`  | Yes      | Path to the task description file                    |

## Available Roles

Valid roles in the 13-soldier system:

| Role                      | Description                             |
| ------------------------- | --------------------------------------- |
| `pm`                      | Product Manager - Requirements analysis |
| `lead`                    | Tech Lead - Architecture & planning     |
| `fe-ui-builder`           | Frontend UI Builder                     |
| `fe-logic-binder`         | Frontend Logic Binder                   |
| `be-api-router`           | Backend API Router                      |
| `be-domain-modeler`       | Backend Domain Modeler                  |
| `be-ai-integrator`        | Backend AI Integrator                   |
| `db-schema-designer`      | Database Schema Designer                |
| `qa-01`, `qa-02`, `qa-03` | QA Testers                              |
| `iv-01`, `iv-02`          | Integration Validators                  |

## Examples

```
/fusion-router --role pm --task pipeline/0_requirements/PRD.md
/fusion-router --role fe-ui-builder --task pipeline/2_planning/task.md
/fusion-router --role lead --task pipeline/1_architecture/System_Design.md
```

## Description

The router performs **physical role validation** before dispatching:

1. **Validates role** - Ensures the role is in the 13-soldier system
2. **Sandboxing** - Constructs isolated execution context
3. **Hard locks** - Prevents cross-role thinking by reinforcing role boundaries

## Notes

- The router acts as a gatekeeper to prevent unauthorized role access
- Each role is restricted to its defined responsibilities
- Task files should include `<!-- Author: <role_name> -->` signatures

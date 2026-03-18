# Fusion Workflow — 全局 8 阶段融合工作流（轻量索引）

> **[!] CRITICAL**: 本文件是所有项目的工作流中枢。
> 每个阶段的完整执行规程在对应角色的 SKILL.md 中按需加载。
> SKILL.md 路径: `.claude/skills/{角色名}/SKILL.md`
> 功能追踪: `pipeline/0_requirements/FEATURE_LIST.md`（全生命周期追踪矩阵，见 `feature-traceability-standard.md`）

---

## 8 阶段流水线总览

```
Stage 0 ──Gate 0──> Stage 0.5 ──Gate 0.5──> Stage 1 ──Gate 1──> Stage 1.5 ──Gate 1.5──>
         (条件必选: 含UI)                                      (条件触发: 架构冲突)

──> Stage 2 ──> Stage 3 ──Gate 2──> Stage 4 ──> Stage 5 ──> Stage 6 ──Gate 3──> Stage 7
```

| Stage | 角色 | 调用技能 | FEATURE_LIST 更新列 |
|-------|------|---------|-------------------|
| 0 | PM | `fusion-compile-req` (快速) 或 `fusion-clarify` (多轮) | PM ✅ |
| 0.5 | UX Designer | `fusion-ux` (含 Stitch MCP 强制出图) | 原型（屏幕编号） |
| 1 | Lead | `fusion-lead` -> `fusion-arch-blueprint` | 接口（API 编号） |
| 1.5 | Lead | 条件触发，定点修订冲突屏幕 | - |
| 2 | Lead | `brainstorming` | - |
| 3 | Lead | `fusion-task` -> `fusion-swarm` | Task（T-ID） |
| 4 | Dev | `using-git-worktrees` | - |
| 5 | Dev (各兵种) + code-simplifier | `fusion-tdd` + 各兵种 SKILL.md + code-simplifier | - |
| 6 | Reviewer (7道漏斗) | qa-01->qa-02->qa-03->qa-04->iv-01->iv-02->iv-03 | - |
| 7 | Lead | `finishing-a-development-branch` | 实现 + QA + 验收 |

> **Stage 0.5 代码产出**: `stitch-code/` 目录下的 HTML 文件是**可执行代码**（HTML+Tailwind），非纯设计稿。Stage 5 fe-ui-builder 必须以此为起点，禁止从零重写已有屏幕。

---

## 项目类型自动检测（分阶段判定）

自动 SKIP 判定分两个时机执行，避免过早判断：

### Gate 0 通过后（PM 判定）

| PRD 特征 | 自动动作 |
|----------|---------|
| 无 UI 交互（纯后端 / CLI / 安全加固） | Stage 0.5 → `SKIP`，Stage 1.5 → `SKIP` |
| 单兵种即可完成（仅 1 类 Dev 角色参与） | `/scale quick` 自动激活 |

### Gate 1 通过后（Lead 判定）

| 架构产出特征 | 自动动作 |
|------------|---------|
| 技术路径已完全锁定（架构无备选方案、无需权衡） | Stage 2 → `SKIP` |

> Commander 可在对应 Gate 审批时覆盖任何自动 SKIP 决策。

---

## Stage 1.5 铁律 `[条件触发]`

Stage 1 架构发现 Stage 0.5 原型中有技术不可行的交互时触发。无冲突则 Commander 标记 SKIP。

**铁律**: Stage 1.5 只修改有架构冲突的屏幕，禁止借机重新设计无关交互。

Gate 1.5 条件:
- Revised_Mockups/ 文件数 = 冲突屏幕数（不多不少）
- UX Consultant 审查通过（PASS）
- Commander 确认："调整后的体验仍可接受"

---

## Stage 5 → Stage 6 衔接：代码简化步骤

Dev 兵种 Worker=[x] 后，由 Dev 兵种调用 code-simplifier：

1. 范围：仅该 T-ID 涉及的生产代码文件（git diff 取变更列表，排除测试文件）
2. 调用 CC 官方 code-simplifier agent 执行简化
3. 运行测试确认绿灯不变 → `git commit -m "refactor(simplify): T-{ID}"`
4. 标记 Simplify=[✓]，QA-01 可接手

简化后测试变红 → 回滚 → Simplify=[SKIP]，QA-01 仍可接手（简化不阻断主流程）。

---

## 并行调度声明

Stage 3 并行调度使用 `fusion-swarm`。`dispatching-parallel-agents` 已废弃，禁止使用。

Stage 6 接收代码审查时须遵循技术严谨性纪律（`receiving-code-review`）：不因审查意见"听起来合理"就盲目执行，须独立验证技术准确性。

---

## 缩放模式 (`/scale` 命令)

| 命令 | 效果 |
|------|------|
| `/scale quick` | 跳过 Stage 1/1.5，直接进入 Stage 2 或 Stage 3 |
| `/scale standard` | 完整流程（默认） |
| `/scale enterprise` | 强制完整流程，不可快速通道 |

**物理锁（任何模式均生效）**:
- Stage 0 需求解构**永远不可跳过**
- 任务涉及 2 名及以上跨端兵种并行协同（FE + BE 同时修改）-> `/scale quick` 自动失效，强制执行 Stage 1

---

## Gate 审批协议

| 决策 | 后续动作 |
|------|---------|
| **Approve** | 进入下一阶段；产出物首行标记 `<!-- status: APPROVED -->` |
| **Reject** | 强制闭环: Reject -> Rework -> Re-submit；拒绝理由记录到 `pipeline/monitor.md` 风险日志 |
| **连续 3 次 Reject** | 触发 Escalation：暂停该 Epic，Commander 决定是否退回 Stage 0 重新定义需求 |
| **SKIP** | 仅适用于 Stage 0.5（纯后端项目）和 Stage 1.5（无架构冲突） |

详细协议见 `gate-approval-protocol.md`。

---

## 约束防线 (Anti-Hallucination Firewall)

1. **禁止盲目写码**: 收到"帮我写个 XX 功能"的模糊指令，必须退回 Stage 0，不得直接写代码
2. **产出物签名**: 所有阶段产出物首行必须 `<!-- Author: [角色名] -->`，下游接手前必须验证
3. **看板强制更新**: 每个 Gate 通过/拒绝后，立即更新 `pipeline/monitor.md` 对应槽位状态
4. **Stage 5 监控链**: Dev 兵种交付后触发 code-simplifier → 轮询 QA 状态直到 `[✓]` 或处理 `[✗]`

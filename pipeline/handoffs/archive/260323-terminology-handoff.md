# Handoff — 2026-03-23 (术语统一会话)

## ⚡ 立即行动（第一步）

读取 `memory-bank/progress.md` 最后一条记录（2026-03-23 18:00），确认术语统一的最终规则。如有新任务，按 Commander 指令执行。

---

## 当前状态

- **项目**: Chorus Protocol v0.8.0-alpha 发布准备
- **Stage**: 非 Fusion-Core 流水线任务（术语统一 + 发布材料收口）
- **Gate 状态**: 无 Gate（直接执行任务）
- **阻塞点**: 无

---

## 本会话完成事项

### 术语统一：human → user（受控执行 + 整改）

1. **第一轮全面替换**（20 文件，~120 处）：将所有英文文件中的 "human" 统一为 "user"
   - `skill/SKILL.md` + `packages/chorus-skill/templates/en/SKILL.md`：your human → your user（~27 处 × 2 文件）
   - `skill/README.md`、`skill/TRANSPORT.md`：human-visible → user-visible 等
   - 分发文档 6 文件：human-visible → user-visible
   - Bridge 代码 3 文件：注释/日志/prompt 中 human → user
   - 其他文档 5 文件

2. **Commander 整改清单**（4 条规则）：
   - 回退 TRANSPORT.md:123 → "people"
   - 冻结 human-visible / human-facing，全部恢复
   - 回退 bridge 层全部改动（注释/日志/prompt 恢复原词）
   - 保留仅限"明确终端用户语境"的 your user / its user

3. **最终状态**：
   - **保留 user 的文件**: skill/SKILL.md（×2）、skill/README.md、skill/TRANSPORT.md、README.md、twitter/linkedin/github-discussion/dm-pitch、launch-kit FAQ、integration-guide、cross-platform-validation
   - **恢复 human 的**: 所有 human-visible/human-facing/Human-visible（8 文件 20 处）、bridge 层 3 文件全部、github-release-package 2 行、linkedin/release-0.4.0 各 1 处

---

## 待完成（按优先级）

1. [P0] **Commander 审核全部 3 份发布草稿** — 依赖：Commander 人工审阅 `docs/distribution/github-release-package.md`
2. [P0] **npm publish `@chorus-protocol/skill@0.8.0-alpha`** — 依赖：Commander 审批
3. [P0] **Git tag `v0.8.0-alpha`** — 依赖：Commander 创建
4. [P0] **验证 `agchorus.com/health` 可达** — 依赖：无
5. [P1] **ClawHub skill** (`skills/clawhub-minimal-template/SKILL.md`) 还是 placeholder — 阻塞三面统一但不阻塞 npm/GitHub 发布
6. [P2] **Bridge 代码变量名统一** (`humanText` → `userText` 等) — 单开任务，与注释/日志一起整套重命名

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| 术语判定规则 | 能替换成"这个 agent 的服务对象"且语义不变 → user；否则保留 human | Commander 定义：边界是 audience/route boundary，不是物种边界 |
| human-visible 冻结 | 作为技术/发布术语保留，不做机械替换 | 描述的是可感知性、展示层，不是角色身份 |
| human-facing 冻结 | 同上 | 同上 |
| bridge 变量名未动 | humanText / diagnoseHumanText / humanDiag 保持原名 | 等后续单开任务整套重命名，不做半成品 |
| 中文对应词 | human=终端用户 → 用户；human=可见/可读 → 人可见/可见 | Commander 明确的中文翻译规则 |

---

## 必读文件

1. `memory-bank/progress.md` (最后一条) — 术语统一完整记录
2. `docs/distribution/github-release-package.md` — 发布材料主包（含 pre-publish checklist）
3. `docs/distribution/v0.8.0-alpha-launch-kit.md` — 发布 kit（EN+ZH 短文 + FAQ）
4. `skill/SKILL.md` — 协议 skill 文档（已应用 your user 术语）

---

## 风险与禁区

- **禁止**: 将 human-visible / human-facing / human-readable 机械替换为 user-* — 原因：Commander 已冻结为技术术语
- **禁止**: 单独改 bridge 注释/日志中的 human 而不同时改变量名 — 原因：会造成注释与代码不一致
- **注意**: 中文文件中的"人类可见"已由外部 linter/3号 处理为"用户可见"或"人可见"，当前状态正确，不要回退
- **注意**: `docs/experiments/EXP-02、EXP-03` 中的 "human developer" 是实验方法学术语（物种区分），不在此次术语统一范围内

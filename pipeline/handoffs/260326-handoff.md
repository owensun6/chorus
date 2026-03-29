# Handoff — 2026-03-26

## ⚡ 立即行动（第一步）

读取 `pipeline/monitor.md` 确认所有 Phase (0/1/2/5/Bridge-v2) 均已完成。当前项目处于维护/迭代状态。如有新任务，从 Stage 0 启动。

---

## 当前状态

- **项目**: Chorus — 跨平台 Agent 通信标准
- **Stage**: 所有 Phase 已完成（Phase 0/1/2/5/Bridge-v2 全部 Stage 7 归档）
- **Gate 状态**: 全部通过
- **阻塞点**: 无。Bridge v2 post-merge hardening 已完成（d256bb2）

---

## 本会话完成事项

- **Insights 报告中文翻译** → `~/.claude/usage-data/report-cn.html`
  - 10 天 159 会话、3128 消息的使用分析报告全文翻译
  - 评估了 6 条建议的适用性（Custom Skills 重复、Hooks 示例错配需重写、Headless 部分适用、并行文档管线有增量、TDD 完全重复、范围锁定最有价值）

- **CLAUDE.md 行为红线** → `/Volumes/XDISK/chorus/CLAUDE.md` 末尾 `## 行为红线` 章节
  - 6 条规则：禁止无故停止循环、禁止盲目应用反馈、先读完文档再定范围、完整文档一次交付、禁止编造功能、先查记忆再探索

- **Scope Guard 三层物理防线** → `.claude/hooks/` + `.claude/settings.json`
  - L1: `scope-guard.sh` — UserPromptSubmit 钩子，新任务强制范围确认
  - L2: `edit-scope-check.sh` — PreToolUse 预留钩子（当前放行）
  - L3: `settings.json` — 钩子注册配置
  - 参考：zulip/zulip、CodySwannGT/lisa、dagster-io/dagster 的 GitHub 最佳实践

- **Gene Bank 新增 2 条**：
  - `gene-20260326-scope-guard-before-execution` (0.7) — 探索先行执行在后
  - `gene-20260326-dont-blindly-apply-feedback` (0.8) — 不盲目应用反馈

---

## 待完成（按优先级）

1. [P1] Scope Guard 真实验证 — 开新会话测试钩子是否生效 — 依赖：新会话
2. [P2] 4 条 Gene 毕业候选 — 运行 `/fusion-graduate`（deploy-before-docs / fly-single-machine-memory / migration-before-schema-edit / dont-blindly-apply-feedback）
3. [P2] TypeScript 类型检查钩子 — 配置 `PreToolUse` 在 Edit/Write 后自动跑 `tsc --noEmit` — 依赖：评估性能影响
4. [P3] Bridge v2 未提交变更 — git status 显示多个修改文件（types.ts, inbound.ts, 测试文件等），需决定是提交还是回退

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| 范围锁定用 UserPromptSubmit 而非 defaultMode:plan | 注入式提醒，不阻断执行流 | Commander 工作模式需要 Claude 直接执行，plan mode 太重 |
| 不采用 Insights 的 Custom Skills 建议 | Fusion-Core 已有完整覆盖 | /fusion-save, /fusion-tdd, /fusion-cron 已存在 |
| Gene confidence 0.8+ 标记毕业候选 | 4 条 Gene 达标但未执行毕业 | 等 Commander 决定是否运行 /fusion-graduate |

---

## 必读文件

1. `CLAUDE.md` 末尾 `## 行为红线` — 本次新增的 6 条行为规则
2. `.claude/settings.json` — Scope Guard 钩子配置
3. `.claude/hooks/scope-guard.sh` — 钩子脚本内容
4. `pipeline/monitor.md` — 全项目状态总览

---

## 风险与禁区

- **注意**: `.claude/settings.json` 修改不会在当前会话热加载，必须开新会话才能验证钩子效果
- **注意**: `$CLAUDE_PROJECT_DIR` 环境变量只在 Claude Code 钩子运行时注入，普通 shell 中不可用
- **注意**: git status 有未提交变更（bridge v2 hardening 后续文件），不要在不了解上下文的情况下盲目 commit

<!-- Author: Lead -->

# Codex 产出审查报告 — Bridge v2 加固

> 产出方: Codex (OpenAI)
> 审查人: 道一 (Claude Opus 4.6)
> 审查基线: `03770f5..35b16d3`（5 commits by Codex, 2026-03-26 ~ 2026-03-28）
> 整改基线: `a724eed`（整改由道一完成后一次性提交）

---

## 1. Codex 交付物概览

| 指标 | 数值 |
|------|------|
| Commits (Codex) | 5 |
| 文件变动 | 25 files changed, +1459 / -88 |
| 源码文件 | 6 |
| 测试文件 | 7 |
| 文档/脚本 | 12 |

### Commit 清单 (Codex)

| Hash | 类型 | 描述 |
|------|------|------|
| `35b16d3` | fix | 同路由出站消息串行化（RouteLock） |
| `1a6423d` | fix | 对齐 release gate 验收文档 |
| `dccad0c` | fix | 先连 SSE 再追历史消息（Recovery 时序修复） |
| `154a5e2` | test | 零 backlog live acceptance gate |
| `03770f5` | chore | SSE 时间戳探针工具 |

---

## 2. 评分（基于 Codex 原始交付物）

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能正确性 | **A** | 并发控制、Recovery 时序、状态机逻辑均正确 |
| 测试质量 | **A** | 边界覆盖充分，mock 设计合理，429 全绿 |
| 架构一致性 | **B+** | 遵循 System_Design.md，但有重复代码 |
| 规范遵守 | **C+** | 多项违反项目编码规范 |
| 安全性 | **B** | shell 脚本有注入风险，核心代码无问题 |

---

## 3. 原始发现与整改状态

### 已修复

| ID | 发现 | 整改内容 | 状态 |
|----|------|---------|------|
| H-02 | `bin/probe-sse-timestamp.sh:31` 和 `bin/release-gate.sh:32` 使用 Function 构造器将 process.argv 拼接为可执行代码 | 替换为 `split('.').reduce()` 安全路径访问 | **已修** |
| M-01 | `src/bridge/live-acceptance.ts` 6 处、`src/scripts/probe-bridge-live.ts` 2 处 `let` 变量，违反不可变性规则 | `reduce`/`find`/`some`/`chunks[]`/递归 pollLoop 替代。注: `recovery.ts:169` 的 `for (let ...)` 属规则允许的 for-loop 例外 | **已修** |
| M-02 | `compareCursorPosition` 在 `state.ts:17` 和 `recovery.ts:25` 重复定义 | `state.ts` export，`recovery.ts` import | **已修** |
| M-03 | 5 个源码/文档文件 Author 签名为 `codex`/`Codex`，不是角色总表中的合法兵种名（另有 8 个 pipeline evidence 文件同一问题） | 全部 13 个文件替换为合法兵种名 | **已修** |

### 未修复

| ID | 发现 | 说明 | 状态 |
|----|------|------|------|
| H-01 | 分支覆盖率低于 80% 阈值 | jest text-summary 和 lcov-report 口径不同，精确值不稳定，但均低于 80%。本报告不锚定具体百分比 | **待补** |

### 已知限制（可接受不改）

| ID | 发现 | 说明 |
|----|------|------|
| L-01 | `outbound.ts:142-158` Hub 返回成功到本地 state 落盘之间存在时序间隙 | 幂等 key 保证功能正确，仅影响审计时间戳精度 |
| L-02 | `probe-bridge-live.ts` 283 行（上限 300），工具函数与业务逻辑混合 | 未超线，整理建议，非硬缺陷 |

---

## 4. 做得好的地方

### 4.1 RouteLock — per-route 并发控制

`outbound.ts:18-39` 用 Promise 链实现 per-route 互斥锁。不同 route 完全并行，同 route 严格串行。`relayReply()` 封装 bind -> submit -> confirm 为原子路径。测试用 `Promise.all` 验证了并发场景下 turn_number 严格递增。

### 4.2 Recovery 时序修复

将 `connectSSE` 移到 backlog catchup 之前，防止在追历史消息期间漏掉新的 SSE 事件。测试用 `callOrder` 数组精确验证了 fetchHistory < acquireHandles < connectSSE < deliverInbound 的调用顺序。

### 4.3 不可变状态管理

`DurableStateManager` 所有 setter 返回新对象，write 通过 `mutate()` 串行化，磁盘写入用 tmp+rename 原子操作。Codex 的修改没有破坏这一核心保证。

### 4.4 验收文档

`S-03-13-same-route-strict-order.md` 包含问题背景、代码变更面、仓库验证（tsc + jest）、线上实证（真实 trace_id + state 文件行号）、四项验收条件和判定。

### 4.5 测试边界覆盖

Recovery 测试覆盖 11 个关键场景：未完成投递恢复、孤儿 cursor 推进、终态 disposition cursor 推进、未提交 relay 重试、retry 失败日志、全新 catchup、退避重试成功、耗尽后 fail-closed、receiver_id 过滤、自回环排除、早期 SSE 不跳过 backlog。

---

## 5. Codex 能力画像

| 能力 | 表现 |
|------|------|
| 架构文档理解 | 强 — 严格遵循 System_Design.md 的 9 步 Recovery 序列 |
| 并发/状态机 | 强 — RouteLock、cursor 比较、幂等 key 均正确 |
| 测试编写 | 强 — 边界覆盖意识好，mock 设计干净 |
| 项目规范遵守 | 弱 — 未读取或未遵守 `.claude/rules/` 编码约束 |
| 文档产出 | 中上 — 验收文档结构好，Author 签名不规范 |

---

## 6. 整改验证

- `npx tsc --noEmit` — 通过
- `npx jest --runInBand --coverage=false` — 32 suites / 429 tests 全绿，但仍有 `did-not-exit` 告警（已有的测试清理问题，非本次引入）

---

## 7. 结论

代码整改已完成（H-02、M-01、M-02、M-03），断言全绿，但 plain Jest 仍未干净退出。H-01（分支覆盖率）待补。

**审查判定: CONDITIONAL — 必改项已落地，H-01 待补。**

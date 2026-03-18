---
name: fusion-qa-functional
description: qa-01 专用。功能逻辑审查：单元测试执行、分支覆盖率、空指针/死循环/业务 BUG 扫描。
---

# fusion-qa-functional — 功能逻辑审查


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 过滤功能性缺陷，守住第一道漏斗
2. **这些步骤已经不可原子级再分了吗？**
   → TDD 证据链 → 运行测试 → 检查覆盖率 → 扫描空指针 → 验证循环终止 → 对照 TASK_SPEC 逐条验证业务逻辑 → 检查错误处理，每步独立不跳过。

---

## 输入文件

| 文件                                            | 用途     |
| ----------------------------------------------- | -------- |
| `pipeline/2_planning/specs/TASK_SPEC_T-{ID}.md` | 验收标准 |
| `pipeline/5_dev/` 下的源码和测试文件            | 审查对象 |

---

## 审查执行步骤

### Step 0: TDD 证据链验证（前置门控）

**验证 git log 中 `test(red)` commit 存在且早于 `feat(green)` commit：**

```bash
# 查找当前 Task 的 RED 和 GREEN commit
git log --oneline --all | grep "test(red): T-{ID}"
git log --oneline --all | grep "feat(green): T-{ID}"
```

**判定标准**:

- `test(red)` commit 存在且时间早于 `feat(green)` ✅ → 继续
- `test(red)` commit 不存在 ❌ → 立即 FAIL，报告：`"TDD 证据链断裂：未找到 test(red) commit，Dev 未遵循 RED→GREEN 纪律"`
- `test(red)` 晚于 `feat(green)` ❌ → 立即 FAIL，报告：`"TDD 顺序违规：测试在实现之后提交"`

### Step 1: 运行单元测试

```bash
# 执行全部单元测试并收集覆盖率报告
npm run test:coverage
# 或: jest --coverage
```

**判定标准**:

- 测试全绿 ✅ → 继续
- 有失败测试 ❌ → 立即记录为 CRITICAL，写入报告

### Step 2: 检查覆盖率

**基线要求**: 最低 80%（Fusion-Core 铁律）

关注点：

- 分支覆盖率（if/else/switch/三元运算符）
- 关键业务路径是否有对应测试

### Step 3: 扫描空指针风险

检查模式：

- 链式调用未防护：`obj.a.b.c`（应该用可选链 `obj?.a?.b?.c`）
- 函数返回值未验证就直接使用
- 数组/对象解构无默认值兜底

### Step 4: 死循环检测

检查模式：

- `while` / `for` 是否有确定的终止条件
- 递归函数是否有 base case
- Promise/async 链是否有超时保护

### Step 5: 业务 BUG 识别

**对照 TASK_SPEC 验收标准**，逐条核查：

- 每个功能点是否正确实现
- 边界值是否正确处理
- 状态转换是否符合业务规则

### Step 6: 错误处理完整性

检查所有外部 I/O（数据库、网络、文件系统）：

- 是否有 `try-catch`
- catch 块是否有日志记录
- 是否有降级处理（不直接抛 500 给前端）

---

## 报告格式（Proof-of-Work 结构化）

```markdown
<!-- Author: qa-01 -->

# Audit Report — <task-id>

## Proof-of-Work Summary

| 指标 | 数值 |
|------|------|
| TDD 证据链 | ✅ 已验证 / ❌ 缺失 |
| Tests Passing | N / Total |
| 语句覆盖率 | X% (基线 ≥ 80%) |
| 分支覆盖率 | X% |
| CRITICAL Issues | N |
| HIGH Issues | N |

**Verdict**: PASS / FAIL

---

## 发现问题

### CRITICAL (必须修复，阻断后续漏斗)

- [C1] 文件:行号 — 问题描述

### HIGH (强烈建议修复)

- [H1] 文件:行号 — 问题描述

### MEDIUM (建议改善)

- [M1] 文件:行号 — 问题描述
```

---

## 审计后强制写回

1. 将报告写入 `pipeline/5_dev/audit/<task-id>-audit.md`
2. 在 `pipeline/monitor.md` 更新 QA 状态：
   - PASS → `[✓]`，通知 qa-02 启动
   - FAIL → `[✗]`，Worker 状态回滚为 `[!]`，后续漏斗不得启动

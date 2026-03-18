# Hooks 拦截系统 (Pre/Post/Stop)

> 本文件定义 Fusion-Core 的质量拦截点。分为 **自动化检查**（有脚本实现）和 **自检提示**（依赖 Agent 自律）。

## 1. 自动化检查 [AUTO] — `bin/fusion-lint.sh`

以下检查由 `bin/fusion-lint.sh` 脚本执行，Stage 5 GREEN→REFACTOR 之间强制运行。

| # | 检查项 | 检测方式 | 阻断级别 |
|---|--------|---------|---------|
| L1 | 密钥泄露扫描 | `grep -rn` 匹配 API_KEY/SECRET/PASSWORD/TOKEN 模式 | CRITICAL — 立即终止 |
| L2 | Author 签名存在性 | 检查产出文件首行是否含 `Author:` 标记 | ERROR — 必须补签 |
| L3 | 调试残留清理 | `grep -rn` 匹配 console.log/print()/TODO/FIXME | WARNING — 必须清除 |
| L4 | 文件行数检查 | `wc -l` 检查产出文件 ≤ 300 行 | WARNING — 必须拆分 |
| L5 | 函数行数检查 | 语言对应 lint 工具（项目自配） | WARNING — 必须拆分 |

**使用方式**:
```bash
# Stage 4 初始化时复制到项目
cp fusion-core/bin/fusion-lint.sh .worktrees/feature-xxx/bin/

# Stage 5 GREEN commit 后运行
bash bin/fusion-lint.sh src/
```

**脚本路径**: `bin/fusion-lint.sh`（模板，项目可扩展）

## 2. 自检提示 [MANUAL] — Agent 自律

以下检查无法完全自动化，依赖 Agent 在执行前/后自行验证。

### PreToolUse（写代码/执行命令前）

1. **[MANUAL] 文件白名单校验**: 你将要修改的文件，是否在本兵种的职责范围内？（UI 兵不碰 DB，领域兵不碰路由）
2. **[MANUAL] 长运行预估**: 正要执行的测试/脚本是否可能超时？是否已设 Timeout？

### PostToolUse（写代码/执行命令后）

1. **[AUTO] 运行 `bin/fusion-lint.sh`**（L1-L5 自动覆盖）
2. **[MANUAL] 类型检查**: 是否通过了语言对应的类型检查（`tsc --noEmit` / `mypy` / `cargo check`）？
3. **[MANUAL] TDD 证据**: 是否有对应的测试文件？RED commit 是否早于 GREEN commit？

### Stop（宣称完成前）

1. **[AUTO] 最终 lint 扫描**（无 CRITICAL/ERROR）
2. **[MANUAL] monitor.md 状态更新**: Worker 列已标记 `[x]`

---
name: fusion-worktree
description: Lead 专用。Stage 4 Git Worktree 隔离：创建物理隔离开发环境，验证基线测试通过后交给 Dev 特种兵。
---

# fusion-worktree — Git Worktree 物理隔离


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 创建隔离环境，验证测试基线
2. **这些步骤已经不可原子级再分了吗？**
   → 目录检查 → gitignore 验证 → 创建 worktree → 安装依赖 → 验证基线，顺序不可颠倒。

---

## ⚠️ 安全铁律

1. **禁止** 未验证 `.gitignore` 就创建项目本地 worktree（防止 worktree 内容被追踪进 git）
2. **禁止** 跳过基线测试验证（无法区分新 Bug 还是预存 Bug）
3. **禁止** 在有未追踪文件时就派遣 Dev 特种兵（worktree 会是空的，导致幻觉）

---

## 执行序列

### Step 1: 目录选择（按优先级）

```bash
# 优先级 1: 检查是否存在 .worktrees/
ls -d .worktrees 2>/dev/null

# 优先级 2: 检查是否存在 worktrees/
ls -d worktrees 2>/dev/null

# 优先级 3: 检查 CLAUDE.md 是否有偏好设置
grep -i "worktree.*director" CLAUDE.md 2>/dev/null

# 优先级 4: 以上均无 → 询问 Commander
```

| 情况               | 行动                          |
| ------------------ | ----------------------------- |
| `.worktrees/` 存在 | 使用它（先验证 gitignore）    |
| `worktrees/` 存在  | 使用它（先验证 gitignore）    |
| 两个都存在         | `.worktrees/` 优先            |
| 都不存在           | 查 CLAUDE.md → 询问 Commander |

### Step 2: gitignore 验证（项目本地目录必须执行）

```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**如果目录未被忽略**:

1. 在 `.gitignore` 中添加对应行
2. Commit 这个变更
3. 然后继续创建 worktree

### Step 3: 确认未追踪文件已提交

```bash
git status --short
```

**如果有未追踪文件（新建的目录/文件未 git add）**:
→ 必须先 `git add + git commit` 这些结构文件，再创建 worktree。
→ 原因：worktree 只检出已追踪的文件，未追踪文件不会出现在 worktree 中，会导致 Dev 特种兵进入空目录。

### Step 4: 创建 Worktree

```bash
# 检测项目名
project=$(basename "$(git rev-parse --show-toplevel)")

# 创建 worktree + 新分支
git worktree add .worktrees/feature-[功能名] -b feature/[功能名]
cd .worktrees/feature-[功能名]
```

### Step 5: 安装依赖

```bash
# 自动检测项目类型
if [ -f package.json ]; then npm install; fi
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi
if [ -f Cargo.toml ]; then cargo build; fi
if [ -f go.mod ]; then go mod download; fi
```

### Step 5.5: 复制 fusion-lint 脚本到 worktree

```bash
mkdir -p bin
cp "$(git rev-parse --show-toplevel)/bin/fusion-lint.sh" bin/fusion-lint.sh 2>/dev/null || true
chmod +x bin/fusion-lint.sh 2>/dev/null || true
```

若 `bin/fusion-lint.sh` 不存在（非 fusion-core 项目），跳过此步。

### Step 6: 验证基线测试（必须全绿才可继续）

```bash
# 按项目类型选择命令
npm test / pytest / cargo test / go test ./...
```

**如果测试失败**:
→ 报告失败详情，询问 Commander："基线测试有 N 个失败，是否需要先修复再开始开发？"
→ 不得在测试失败时直接派遣 Dev 特种兵。

**如果测试全绿**:
→ 继续 Step 7

### Step 7: 生成 monitor.md Task 级追踪表

从 `pipeline/2_planning/task.md` 提取所有 T-ID，在 `pipeline/monitor.md` 的"Stage 5 Task 级追踪"区域填充表格：

```markdown
| T-ID | Assignee | Blocker | Worker | QA | 审计报告 |
|------|----------|---------|--------|----|---------|
| T-01 | db-schema-designer | None | [ ] | [ ] | |
| T-02 | fe-ui-builder | None | [ ] | [ ] | |
| T-03 | be-domain-modeler | None | [ ] | [ ] | |
| T-04 | be-api-router | T-01, T-03 | [ ] | [ ] | |
| T-05 | fe-logic-binder | T-02, T-04 | [ ] | [ ] | |
```

**此表是 Dev 轮询循环和 QA 写回义务的唯一数据源。未生成此表禁止派遣 Dev。**

→ 报告：`Worktree 就绪于 [路径]，[N] 个测试通过，Task 追踪表已生成，可以开始 Stage 5`

---

## 产出报告

```
Worktree 已就绪
- 路径: .worktrees/feature-[功能名]
- 分支: feature/[功能名]
- 基线测试: [N] 个测试，0 个失败
- 下一步: 派遣 Dev 特种兵按 task.md 并发作业
```

---

## 质量闸门

- [ ] worktree 目录已被 gitignore 忽略
- [ ] 所有基础结构文件已 git add + commit（无未追踪文件问题）
- [ ] 依赖安装完成
- [ ] 基线测试全绿（或 Commander 明确确认在失败状态下继续）
- [ ] monitor.md Task 级追踪表已从 task.md 生成（Dev 轮询数据源）

**基线验证 + 追踪表生成 → 通知 Dev 特种兵按 task.md 进入 Stage 5。**

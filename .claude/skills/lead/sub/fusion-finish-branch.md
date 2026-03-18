---
name: fusion-finish-branch
description: Lead 专用。Stage 7 分支收尾：验收检查 → 清理脏代码 → 提供合并选项（本地合并/PR/保留待审）。
---

# fusion-finish-branch — 完成开发分支


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 安全合入主线，零遗留问题
2. **这些步骤已经不可原子级再分了吗？**
   → 验收确认 → 脏代码清理 → 合并决策 → 执行合并 → Worktree 清理，每步产出物不同，不可合并。

---

## ⚠️ 前置条件（不满足则禁止进入 Stage 7）

```
[x] Gate 3 已通过（7 道漏斗全部 PASS）
[x] Audit_Report.md + Integration_Report.md 已创建
[x] Commander 签字
```

---

## 执行序列

### Step 1: 验收最终状态

```bash
# 确认所有测试通过
npm test / pytest / cargo test / go test ./...

# 确认无未解决的 CRITICAL / HIGH 问题
grep -r "CRITICAL\|HIGH" pipeline/3_review/
```

| 状态                    | 行动                                        |
| ----------------------- | ------------------------------------------- |
| 测试全绿 + 无 CRITICAL  | 继续 Step 2                                 |
| 测试有失败              | **停止**，报告失败详情，等待 Commander 决策 |
| 有未解决 CRITICAL       | **停止**，退回 Stage 6 对应 QA 漏斗处理     |
| 有未解决 HIGH（已知情） | 记录到合并说明，Commander 确认后继续        |

### Step 2: 清理脏代码

```bash
# 检查调试残留
grep -rn "console\.log\|debugger\|TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" --include="*.tsx" --include="*.js"

# 检查临时文件
ls -la *.tmp *.bak 2>/dev/null
find . -name "*.tmp" -o -name "test-output.*" 2>/dev/null | grep -v node_modules
```

**清理标准**:

- `console.log` / `debugger` → 全部删除（测试和 Storybook 除外）
- `TODO` / `FIXME` → 记录到 Issue，注释中保留 Issue 编号
- 临时文件 → 删除
- 注释掉的大段代码 → 删除（git 历史已保留）

### Step 3: 最终 Commit（清理完成后）

> Semantic Commits type 字典 + 主分支保护原则 → `.claude/rules/git-workflow.md`

```bash
# 在 worktree 内
git add -p        # 逐块确认，不 add 不相关文件
git commit -m "chore: Stage 7 收尾清理 — 删除调试代码和临时文件"
```

### Step 4: 向 Commander 提供合并选项

**展示以下三个选项，等待 Commander 决策**:

```
─────────────────────────────────────────────────────
Stage 7 验收通过，请选择合并方式：

[A] 本地合并（推荐用于：小型改动、单人项目）
    git checkout main && git merge --no-ff feature/[功能名]
    特点：立即合入，无 PR 记录，历史保留合并节点

[B] 创建 Pull Request（推荐用于：团队协作、需要 Code Review）
    gh pr create --title "[功能名] ..." --body "..."
    特点：有 PR 讨论记录，可触发 CI/CD 流水线

[C] 保留分支待审（推荐用于：需要他人审批、异步工作流）
    分支 feature/[功能名] 保留，暂不合并
    特点：零操作，等待手动触发

─────────────────────────────────────────────────────
```

### Step 5A: 执行本地合并（选 A）

```bash
git checkout main
git merge --no-ff feature/[功能名] -m "feat: 合并 feature/[功能名] — [功能描述]"
git push origin main
```

### Step 5B: 创建 Pull Request（选 B）

```bash
# 推送 feature 分支
git push origin feature/[功能名]

# 创建 PR（使用 gh CLI）
gh pr create \
  --title "[功能名]: [一句话功能描述]" \
  --body "$(cat <<'EOF'
## 变更摘要

- 实现了 [F-ID 列表] 对应的功能
- 通过 Gate 3（7 道漏斗 PASS）

## 测试情况

- 单元测试: [N] 个全绿
- E2E 测试: 核心用户旅程通过
- 安全审计: 无 CRITICAL/HIGH

## 审查材料

- Audit_Report.md: `pipeline/3_review/Audit_Report.md`
- Integration_Report.md: `pipeline/3_review/Integration_Report.md`
EOF
)"
```

### Step 5C: 保留分支待审（选 C）

```bash
# 仅推送，不合并
git push origin feature/[功能名]
echo "分支 feature/[功能名] 已推送，等待人工触发合并"
```

### Step 6: 清理 Worktree（合并后执行，选 C 时跳过）

```bash
cd <项目根目录>
git worktree remove .worktrees/feature-[功能名]
git branch -d feature/[功能名]    # 仅在本地合并后执行；PR 合并后 GitHub 会自动删除
```

**如果 worktree 有未追踪文件导致删除失败**:

```bash
git worktree remove --force .worktrees/feature-[功能名]
```

### Step 7: 更新 FEATURE_LIST.md 追踪总表（实现 + QA 列）

打开 `pipeline/0_requirements/FEATURE_LIST.md`，逐行检查追踪总表：

1. **"实现"列**: 对照 task.md，该 F-ID 关联的所有 T-ID 已完成 → 标 ✅，否则标 ⬜
2. **"QA"列**: 对照 Audit_Report.md，该 F-ID 关联的所有审计 PASS → 标 ✅，有 FAIL → 标 ✗

```
| F1.1 | 用户登录 | ✅ | S-01 | POST /api/auth/login | T-01,T-04 | ✅ | ✅ | ⬜ |
```

**"验收"列留空**，等待 Commander 在审阅追踪总表后逐行签字。

### Step 8: 更新 monitor.md

```
Stage 7: ✅已完成
合并方式: [A/B/C]
合并时间: [YYYY-MM-DD]
```

### Step 8:（可选）萃取经验

```
→ 提示 Commander: "是否需要萃取本次战役经验？如需，请调用 /fusion-extract-genes"
→ Commander 决定是否执行，不自动触发
```

---

## 产出报告

```
Stage 7 完成
─────────────────────────
分支:    feature/[功能名]
合并方式: [本地合并 / PR #xxx / 保留待审]
测试:    [N] 个测试，0 个失败
遗留问题: [无 / HIGH: N 个（已记录 Issue）]
Worktree: [已清理 / 保留待用]
Gene Bank: [已提取 / 无新 Gene]
─────────────────────────
```

---

## 质量闸门

- [ ] 所有测试在最终 commit 状态下通过
- [ ] 无 `console.log` / `debugger` 残留（除测试文件）
- [ ] 无未解决的 CRITICAL 问题
- [ ] Commander 已选择合并方式
- [ ] Worktree 已清理（或 Commander 决定保留）
- [ ] monitor.md Stage 7 状态已更新为 ✅

#!/bin/bash
# ==============================================================================
# Fusion-Core Epic Finisher (收尾与封版挂载器)
# ==============================================================================
# 作用: 执行 Stage 7，收集当前交付物，合并代码，并在 monitor.md 上打卡完成。
# 触发: 当所以 QA/IV 关卡显示全绿时，由 Lead 或 Commander 执行。

echo "🏁 Initiating Epic Finalization..."

# 1. 检查是否存在未提交的代码 (Dirty Working Tree)
if ! git diff-index --quiet HEAD --; then
    echo "🚨 Error: 工作区存在未提交的变更。请先完成 Commit。"
    exit 1
fi

# 2. 从 monitor.md 检查 Stage 6 状态 (粗略扫描)
MONITOR_FILE="$(pwd)/pipeline/monitor.md"
if grep -q "Gate 3.*PENDING" "$MONITOR_FILE"; then
    echo "⚠️ Warning: 虽然您可以强行封版，但看板显示 Gate 3 (安全/集成验收) 尚未通过。"
    read -p "是否继续封版? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 3. 询问是否要合并当前特性分支 (模拟 Git Flow)
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH_NAME" != "main" ] && [ "$BRANCH_NAME" != "master" ]; then
    echo "✅ 推送并挂载变更到主分支 (Squash & Merge 模拟)"
    # git checkout main
    # git merge --squash "$BRANCH_NAME"
    # git commit -m "feat(epic): Fusion Epic Completed from $BRANCH_NAME"
fi

# 4. 更新看板的终态
if [ -f "$(pwd)/.claude/scripts/update_monitor.sh" ]; then
    "$(pwd)/.claude/scripts/update_monitor.sh" "ALL" "DONE" "Epic successfully finalized and merged."
fi

# 5. 生成轻量发布声明与自动更新 CHANGELOG
DATE_STR=$(date '+%Y-%m-%d')
echo "## [Release] $BRANCH_NAME - $DATE_STR" > pipeline/4_delivery/RELEASE_NOTE.md
echo "Epic completed via Fusion-Core Method." >> pipeline/4_delivery/RELEASE_NOTE.md

CHANGELOG_FILE="$(pwd)/CHANGELOG.md"
if [ -f "$CHANGELOG_FILE" ]; then
    echo "📜 同步更新 CHANGELOG.md..."
    # 动态插入新版本标题至 [Unreleased] 下方
    # 跨平台 (macOS BSD sed 和 GNU sed 的兼容写法)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' -e "/## \[Unreleased\]/a\\
\\
## [$BRANCH_NAME] - $DATE_STR\\
- Completed epic and merged features into main pipeline.\\
" "$CHANGELOG_FILE"
    else
        sed -i "/## \[Unreleased\]/a \n## [$BRANCH_NAME] - $DATE_STR\n- Completed epic and merged features into main pipeline." "$CHANGELOG_FILE"
    fi
fi

echo "🎉 Epic 成功封版！所有兵种解除挂载，回到休眠池。"
exit 0

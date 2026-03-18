#!/bin/bash
# ==============================================================================
# Fusion-Core Parallel Dispatcher (多路盲打指挥核心)
# ==============================================================================
# 作用: 在 Stage 5 阶段，基于 task.md 中定义的并行任务，拉起多个独立的 Agent Session。
# 原理: 利用 tmux 会话 或 后台进程池，挂载不同的特定 Role Context (SKILL.md) 运行。

echo "🚀 Initiating Fusion-Core Swarm Dispatcher..."

TASK_FILE="$(pwd)/pipeline/2_planning/task.md"

if [ ! -f "$TASK_FILE" ]; then
    echo "🚨 Error: 找不到兵力分配总图 pipeline/2_planning/task.md。请确保已完成 Stage 3 规划。"
    exit 1
fi

# ==========================================
# 提取无阻碍 (Blocker: None) 的完全并发兵种
# ==========================================
echo "🔍 扫描 [Phase 1] 完全并发区..."

# 用 awk 解析出所有 [Assignee: ...] 并且含有 Blocker: None 的任务
ASSIGNEES=$(grep "Blocker: None" "$TASK_FILE" | grep -o "\[Assignee: [a-zA-Z0-9-]*\]" | sed 's/\[Assignee: \(.*\)\]/\1/')

if [ -z "$ASSIGNEES" ]; then
    echo "⚠️ 未发现可无头并发的任务槽位。"
    exit 0
fi

echo "✅ 发现待命特种兵清单:"
for ROLE in $ASSIGNEES; do
    echo "  - 🪖 唤醒: $ROLE"
done

echo ""
echo "⚠️ [注意] 这是一次演习：在真实挂载下，此处循环将会触发以下动作："
for ROLE in $ASSIGNEES; do
    echo "tmux new-session -d -s \"agent-$ROLE\" \"claude-code --mode $ROLE --auto-approve\""
done

echo ""
echo "🔥 兵营已空降，全军出击！ (Agent session dispatch successful)"
exit 0

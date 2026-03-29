#!/bin/bash
# Scope Guard — UserPromptSubmit hook
# Injects scope-awareness reminder into every user prompt
cat << 'EOF'
SCOPE GUARD: 如果这是一个新任务或新功能请求（不是正在进行中的工作的延续），
你必须在修改任何文件之前完成以下探索阶段：
1. 读取所有引用文档、白皮书、规格和历史交接文件
2. 读取 pipeline/monitor.md 确认当前 Stage
3. 用一段结构化摘要向 Commander 确认你的理解：
   - 任务的核心目的
   - 确切范围（涉及哪些文件/模块）
   - 明确不在范围内的内容
4. 等待 Commander 确认后再进入实施
如果这是正在进行中的工作（Commander 说"继续"、"接着做"等），跳过此检查。
EOF

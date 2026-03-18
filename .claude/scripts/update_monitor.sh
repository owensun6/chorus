#!/bin/bash
# ==============================================================================
# Fusion-Core Monitor Automator (物理看守)
# ==============================================================================
# 作用: 通过 sed 自动捕获各阶段里程碑文件的生成，在 pipeline/monitor.md 上盖戳。
# 用法: ./update_monitor.sh <GateNumber> <STATUS> ["optional message"]

if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <Gate_Number> <STATUS> [Log_Message]"
    echo "Example: $0 0 APPROVED"
    echo "Example: $0 1 REJECT \"Data model validation failed\""
    exit 1
fi

GATE="$1"
STATUS="$2"
MSG="${3:-}"

MONITOR_FILE="$(pwd)/pipeline/monitor.md"

if [ ! -f "$MONITOR_FILE" ]; then
    echo "🚨 Error: monitor.md not found. Make sure pipeline is initialized."
    exit 1
fi

# 根据 Gate 更新状态 (使用 sed 替换对应行的状态和日志)
# macOS BSD sed 兼容写法
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [ -n "$MSG" ]; then
        sed -i '' -e "s/| $GATE |.*$/| $GATE | ${STATUS} | | ${MSG} |/" "$MONITOR_FILE"
    else
        sed -i '' -e "s/| $GATE |.*$/| $GATE | ${STATUS} | | |/" "$MONITOR_FILE"
    fi
else
    # GNU sed
    if [ -n "$MSG" ]; then
        sed -i "s/| $GATE |.*$/| $GATE | ${STATUS} | | ${MSG} |/" "$MONITOR_FILE"
    else
        sed -i "s/| $GATE |.*$/| $GATE | ${STATUS} | | |/" "$MONITOR_FILE"
    fi
fi

echo "✅ Monitor Board Updated: $GATE -> $STATUS"
exit 0

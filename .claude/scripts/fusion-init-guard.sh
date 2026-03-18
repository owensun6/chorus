#!/usr/bin/env bash
# fusion-init-guard.sh — 物理安全锁
# 在 fusion-init 执行任何文件操作之前运行此脚本
# 退出码: 0 = 安全(无实际内容), 1 = 检测到实际内容(阻断)
# 用法: bash ~/.claude/scripts/fusion-init-guard.sh [项目根目录]

set -euo pipefail

PROJECT_ROOT="${1:-.}"
HAS_REAL_CONTENT=false
REAL_FILES=()

# --- 判定函数: 文件是否包含非模板内容 ---
# 模板特征: 全是占位符 ([项目名称], [日期], YYYY-MM-DD, ______, ⬜, - [ ])
# 实际内容特征: 包含具体的项目名、需求描述、讨论记录等
is_real_content() {
    local file="$1"

    # 文件不存在或为空 → 不是实际内容
    [ ! -s "$file" ] && return 1

    # 排除模板行后，计算剩余的具体内容行数
    # 排除: 空行、标题、引用、未勾选项、表格分隔线、代码块标记、
    #        占位符 ([xxx])、分隔线、注释、下划线、签字行、动态填写提示
    local specific_content
    specific_content=$(grep -cvE '^\s*$|^\s*#|^\s*>|^\s*-\s*\[\s*\]|^\s*\|.*---.*\||^\s*\|.*⬜.*\||^\s*```|^\[|^---$|^<!--|_{4,}|Commander 签字|由.*动态填写|待续|最后更新' "$file" 2>/dev/null; true)

    # grep -c 在 0 匹配时输出 "0" 但退出码为 1
    # 用 ; true 确保管道不失败，specific_content 拿到纯数字
    specific_content="${specific_content:-0}"

    # 如果有超过 5 行的具体内容，认为是实际项目内容
    [ "$specific_content" -gt 5 ]
}

echo "========================================"
echo "  Fusion-Init 产出物保护扫描"
echo "  项目目录: $(cd "$PROJECT_ROOT" && pwd)"
echo "========================================"
echo ""

# --- 扫描 pipeline/ ---
if [ -d "$PROJECT_ROOT/pipeline" ]; then
    echo "[扫描] pipeline/ ..."
    while IFS= read -r -d '' file; do
        if is_real_content "$file"; then
            HAS_REAL_CONTENT=true
            rel_path="${file#$PROJECT_ROOT/}"
            REAL_FILES+=("$rel_path")
            echo "  ⚠️  实际内容: $rel_path"
        fi
    done < <(find "$PROJECT_ROOT/pipeline" -name "*.md" -type f -print0 2>/dev/null)
else
    echo "[扫描] pipeline/ → 不存在，跳过"
fi

# --- 扫描 memory/ ---
if [ -d "$PROJECT_ROOT/memory" ]; then
    echo "[扫描] memory/ ..."
    while IFS= read -r -d '' file; do
        if is_real_content "$file"; then
            HAS_REAL_CONTENT=true
            rel_path="${file#$PROJECT_ROOT/}"
            REAL_FILES+=("$rel_path")
            echo "  ⚠️  实际内容: $rel_path"
        fi
    done < <(find "$PROJECT_ROOT/memory" -name "*.md" -type f -print0 2>/dev/null)
else
    echo "[扫描] memory/ → 不存在，跳过"
fi

# --- 扫描 .claude/ (项目级) ---
if [ -d "$PROJECT_ROOT/.claude" ]; then
    echo "[扫描] .claude/ ..."
    while IFS= read -r -d '' file; do
        if is_real_content "$file"; then
            HAS_REAL_CONTENT=true
            rel_path="${file#$PROJECT_ROOT/}"
            REAL_FILES+=("$rel_path")
            echo "  ⚠️  实际内容: $rel_path"
        fi
    done < <(find "$PROJECT_ROOT/.claude" -name "*.md" -type f -print0 2>/dev/null)
else
    echo "[扫描] .claude/ → 不存在，跳过"
fi

echo ""

# --- 最终判定 ---
if [ "$HAS_REAL_CONTENT" = true ]; then
    echo "========================================"
    echo "  ⛔ 阻断: 检测到 ${#REAL_FILES[@]} 个非模板文件"
    echo "========================================"
    echo ""
    echo "包含实际项目内容的文件:"
    for f in "${REAL_FILES[@]}"; do
        echo "  - $f"
    done
    echo ""
    echo "fusion-init 已被物理阻断。"
    echo "请 Commander 选择:"
    echo "  A) 增量模式 — 仅注入缺失文件，不覆盖已有文件"
    echo "  B) 备份模式 — 先备份到 .fusion-backup-YYYYMMDD-HHMMSS/ 再全量注入"
    echo "  C) 取消操作"
    exit 1
else
    echo "========================================"
    echo "  ✅ 安全: 未检测到实际项目内容"
    echo "  fusion-init 可以继续执行"
    echo "========================================"
    exit 0
fi

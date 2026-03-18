#!/bin/bash

# ==============================================================================
# Fusion-Core Pipeline Scaffolding Script
# ==============================================================================
# Initializes the 8-stage pipeline directory structure.
# Normally not needed — fusion-init copies pipeline/ from fusion-core directly.
# This script exists as fallback when fusion-core's pipeline/ template is unavailable.

echo "Initializing Fusion-Core pipeline directories..."

BASE_DIR="${1:-$(pwd)/pipeline}"

mkdir -p "$BASE_DIR/0_requirements/audit"
mkdir -p "$BASE_DIR/0_5_prototype/Wireframes/stitch-raw"
mkdir -p "$BASE_DIR/0_5_prototype/audit"
mkdir -p "$BASE_DIR/1_architecture/ADR"
mkdir -p "$BASE_DIR/1_architecture/audit"
mkdir -p "$BASE_DIR/1_5_prototype/UI_Mockups"
mkdir -p "$BASE_DIR/1_5_prototype/Revised_Mockups"
mkdir -p "$BASE_DIR/2_planning/specs"
mkdir -p "$BASE_DIR/5_dev/audit"
mkdir -p "$BASE_DIR/3_review/e2e-screenshots"
mkdir -p "$BASE_DIR/4_delivery"

# Add .gitkeep to all leaf directories
find "$BASE_DIR" -type d -empty -exec touch {}/.gitkeep \;

# Create monitor.md if not exists
if [ ! -f "$BASE_DIR/monitor.md" ]; then
cat << 'EOF' > "$BASE_DIR/monitor.md"
# 战略全景沙盘 (Fusion Global Monitor)

> 最后更新: (由系统动态填写)

## 当前阶段

| 项目 | 值 |
|------|---|
| 项目名称 | (由 fusion-start 动态填写) |
| 当前 Stage | Stage 0 |
| 启动日期 | (由 fusion-start 动态填写) |

## 阶段推进看板

| Gate | 阶段名称 | 状态 | 产出物链路 | 风险与重审日志 |
|------|---------|------|-----------|--------------|
| Gate 0 | Stage 0: PM 需求解构 | ⬜ 未开始 | | |
| Gate 0.5 | Stage 0.5: 低保真原型 | ⬜ 未开始 | | |
| Gate 1 | Stage 1: 系统架构设计 | ⬜ 未开始 | | |
| Gate 1.5 | Stage 1.5: 原型修订 | ⬜ 未开始 | | |
| Gate 2 | Stage 3: DAG 兵力分配 | ⬜ 未开始 | | |
| Gate 3 | Stage 6: 全维验收 | ⬜ 未开始 | | |

## Stage 5 Task 级追踪

> 由 Stage 4 (fusion-worktree) 基于 task.md 自动填充，手动填充亦可。

| T-ID | Assignee | Blocker | Worker | QA | 审计报告 |
|------|----------|---------|--------|----|---------|
EOF
fi

echo "Pipeline scaffold built at $BASE_DIR"
exit 0

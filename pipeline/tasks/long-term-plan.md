# Chorus 长期工作计划

> 创建: 2026-03-22T05:10Z
> 执行方式: Cron 每 20 分钟唤醒，每次完成一个任务
> 原则: 先文档一致性，再功能完善，最后推广执行

---

## Phase A: 文档一致性修复 [P0]

| # | 任务 | 状态 |
|---|------|------|
| A1 | SKILL.md + TRANSPORT.md 加 /agent/messages 端点文档 | 已完成 2026-03-22T05:15Z |
| A2 | README 加 /agent/messages 到 API 端点表 | 已完成 2026-03-22T05:18Z |
| A3 | Hub version 从 0.5.0-alpha 改为 0.7.0-alpha | 已完成 2026-03-22T05:20Z |
| A4 | 同步 EN SKILL.md 模板到 npm 包 | 已完成 2026-03-22T05:25Z |
| A5 | 同步 zh-CN SKILL.md 加 /agent/messages 文档 | 已完成 2026-03-22T05:25Z |
| A6 | npm publish 0.7.1（文档同步） | 已完成 2026-03-22T05:25Z |

## Phase B: 功能加固 [P1]

| # | 任务 | 状态 |
|---|------|------|
| B1 | 生成探针稳定性报告（bin/alpha-probe-report.sh） | 已完成 2026-03-22T05:28Z (278 probes, 100%, 0 fail) |
| B2 | 白皮书更新（自助注册、SSE inbox、消息历史、本地持久化） | 已完成 2026-03-22T05:32Z |
| B3 | E2E 验证完整 agent 流程（register → inbox → send → /agent/messages catch-up → 本地持久化路径存在） | 已完成 2026-03-22T05:38Z (11/11 PASS) |

## Phase C: 清理与收尾 [P2]

| # | 任务 | 状态 |
|---|------|------|
| C1 | 清理工作区未跟踪文件（handoffs 归档、scripts 提交或忽略） | 待做 |
| C2 | 删除远程 review 分支（已 cherry-pick 有价值的部分） | 待做 |
| C3 | 部署最终版本（含 A3 version bump） | 待做 |
| C4 | 生成 Handoff 文档给下一个会话 | 待做 |

# Handoff — 2026-03-22 Session 3

## ⚡ 立即行动（第一步）

读取 `docs/server/sqlite-production-rollout.md` 的 Remaining Gaps 和 Next Steps 章节，确认当前 4 个运维缺口中哪些还需要推进。其中 2 个已在本会话关闭（agent_id 所有权 + 备份恢复）。

---

## 当前状态

- **项目**: Chorus — Agent-to-Agent Communication Protocol
- **阶段**: MVP 发布准备（非 Fusion-Core Stage，不受 pipeline/monitor.md 管理）
- **Hub**: agchorus.com 运行中，SQLite 持久化已上线
- **阻塞点**: 无硬阻塞。剩余 2 个运维改善项（message retention + disk monitoring）为非阻断。

---

## 本会话完成事项

### 1. agent_id 所有权修复（MVP 硬阻断，已关闭）

- `src/server/routes.ts:78-88`: POST /register 新增所有权守卫。agent_id 已存在时，请求必须携带当前有效 key，否则 409 ERR_AGENT_EXISTS。
- `tests/server/self-register.test.ts:55-101`: 3 条测试覆盖（无 key 拒绝 / 错 key 拒绝 / 正确 key 轮换）。
- 影响：此前任意第三方可通过 POST /register 抢占已有 agent_id 并轮换 key，现已封堵。

### 2. 备份恢复闭环（已关闭）

- `scripts/backup-db.ts`: 备份脚本，通过 `npm run db:backup -- <dest>` 执行。
- `tests/server/backup.test.ts`: smoke test，直接调用 npm script 入口，验证 agent/消息/activity 完整恢复。
- `docs/server/backup-and-restore.md`: 一页操作文档（备份命令 / 恢复步骤 / 保留内容 / cron 示例）。
- 恢复演练通过：seed data → backup → initDb from backup → all data intact。

### 3. sqlite-production-rollout.md 重写

- `docs/server/sqlite-production-rollout.md`: 从提案文档重写为当前状态+剩余缺口文档。经 4 轮 Commander 审查收口。

### 4. 测试状态

- 22 suites / 259 tests 全绿。无已知失败。

---

## 待完成（按优先级）

1. [P1] Message retention policy — messages 表只增不减，需定义截断策略（按行数或 TTL）并实现。参考 `src/server/activity.ts` 的 stmtTrim 模式。无外部依赖。
2. [P1] Disk/WAL monitoring — 扩展 `/health` 响应增加 db_size/wal_size/disk_free。磁盘阈值标记 [Uncalibrated]，需上线后校准。无外部依赖。
3. [P2] Operator upgrade doc — 写 `docs/server/upgrade-v1-to-v2.md`，独立于 CHANGELOG。CHANGELOG 已有 release note，缺的是独立可引用的操作步骤文档。
4. [P2] 3 个 Gene 达毕业条件 — 考虑运行 `/fusion-graduate`。

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| MVP 发布边界 | alpha 与产品的分界线：用户可信任注册不被接管 + 数据不无声消失 | Commander 定义。public-alpha-plan.md:57 明确"不是产品"，MVP 需跨过这两条线 |
| 所有权修复选路由层 | 在 routes.ts 检查 Authorization header，不改 registry 接口 | 最小改动，注册仍免鉴权，只有重注册需证明所有权 |
| 备份入口 npm run db:backup | 消除 tsx/ts-node 分歧，测试直接覆盖 npm script 入口 | Commander 审查：测试必须覆盖真实入口，不能用替代命令 |
| rollout 文档不排优先级 | Next Steps 标注"Not ordered by priority"，磁盘阈值标 [Uncalibrated] | 无生产数据支撑排序，Commander 审查要求删除无依据断言 |

---

## 必读文件

1. `docs/server/sqlite-production-rollout.md` — 当前持久化层完整状态和剩余缺口
2. `docs/server/backup-and-restore.md` — 备份恢复操作文档
3. `src/server/routes.ts:78-88` — agent_id 所有权守卫实现
4. `docs/server/public-alpha-plan.md` — alpha 设计冻结稿，定义信任边界

---

## 风险与禁区

- **禁止**: 在 POST /register 上移除所有权检查或将其改为可选 — 这是 MVP 与 alpha 的分界线。
- **注意**: backup-db.ts 的 CHORUS_DB_PATH 默认值是 ./data/chorus.db。如果生产 DB 在其他路径，必须显式设置环境变量，否则备份的是错误文件（本会话踩过这个坑）。
- **注意**: schema v1→v2 migration 会 DROP 旧 api_keys 表。从 v1 升级的 agent 必须重新注册。这是设计决策，不是 bug。

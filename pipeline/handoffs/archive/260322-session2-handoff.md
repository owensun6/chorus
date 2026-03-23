# Handoff — 2026-03-22 (Session 2: SQLite 持久化收口)

## ⚡ 立即行动（第一步）

部署新版本到 Fly.io（含 v1→v2 schema migration）。部署前确认 `/data` volume 已挂载。部署后通知已注册 agent 重新 `POST /register` 获取新 key。

---

## 当前状态

- **项目**: Chorus — 跨平台 Agent 通信标准
- **Stage**: 持久化迭代收口（不在 Fusion 流水线内，直接操作 main 分支）
- **阻塞点**: 无。代码已就绪，等待部署+通知。

---

## 本会话完成事项

1. **SQLite 持久化实现** — 全栈从内存迁移到磁盘
   - `src/server/db.ts` — SQLite 初始化 + WAL + migration 系统
   - `src/server/registry.ts` — Map → SQL prepared statements，API key SHA-256 哈希
   - `src/server/message-store.ts` — Map → SQL table
   - `src/server/activity.ts` — 内存数组 → SQL + 内存 pub/sub 混合
   - `src/server/index.ts` — DB 接入 + 优雅关闭（server → db → exit）

2. **Commander 3 轮审查修复**（全部落地）
   - HIGH: `api_key` 明文存储 → `api_key_hash` SHA-256 哈希
   - MEDIUM: 关闭顺序修正（server.close → db.close → exit）
   - MEDIUM: `busy_timeout = 5000ms` pragma 补齐

3. **Schema migration v1→v2**（Commander 第 4 轮审查触发）
   - `SCHEMA_VERSION` 升到 2，MIGRATIONS[0] 恢复为原始 v1 schema
   - MIGRATIONS[1] = DROP 旧 api_keys + 重建 api_key_hash 列
   - `tests/server/db-migration.test.ts` — 磁盘文件模拟 v1 DB → initDb 升级验证

4. **Release 文档**
   - `CHANGELOG.md` — v0.4.1 release note + operator migration checklist
   - `README.md` — 删除 "In-memory only" 限制，加 Upgrading 指引

5. **测试**：21 suites, 256 tests all green, tsc clean

---

## 待完成（按优先级）

1. [P0] 部署到 Fly.io — 确认 `/data` volume 存在（`fly volumes list`），deploy 后验证 migration 成功
2. [P0] 通知已注册 agent 重新注册（旧 key 因 v2 migration 失效）
3. [P1] 产线验证：重启 hub 后 agent 注册 + 消息历史是否存活
4. [P2] 剩余 gap 分析项：身份模型（verifiable identity）、运维可靠性（backup/restore）、版本化策略

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| SQLite with thin boundary | 不建通用 StorageProvider，直接用 better-sqlite3 | 先解决状态问题，schema 稳定后再考虑 PG |
| SHA-256 而非 bcrypt | 系统生成 128-bit 熵 key，不需要抗字典攻击 | 每请求 auth 查询需要快速 hash |
| v1→v2 DROP api_keys | 旧明文 key 不可恢复，agent 必须重新注册 | 安全迁移的一次性代价 |
| inbox.ts 不持久化 | SSE 连接天然临时态，重启后 agent 重连 | 持久化无意义 |
| `:memory:` SQLite for tests | 零磁盘 I/O，测试间完全隔离 | 速度 + 隔离 |

---

## 必读文件

1. `CHANGELOG.md` — 部署前必读，含 operator checklist
2. `src/server/db.ts` — schema + migration 系统
3. `src/server/registry.ts` — API key 哈希逻辑
4. `Dockerfile` — `/data` volume 挂载点

---

## 风险与禁区

- **禁止**: 编辑已发布的 migration SQL（MIGRATIONS[0]）— 已有 DB 不会重跑。必须加新版本号
- **注意**: Fly.io 上 `/data` 必须是持久化 volume，不是 ephemeral storage — 否则重启仍丢数据
- **注意**: v2 migration 会清空 api_keys 表 — 这是设计行为，不是 bug。但必须通知 agent operator

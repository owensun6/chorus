# Handoff — 2026-03-22 Session 4

## ⚡ 立即行动（第一步）

1. 确认 Fly volume 是否已创建：`fly volumes list -a chorus-alpha`
2. 若无 → `fly volumes create chorus_data --region sjc --size 1`
3. 部署新镜像：`fly deploy`（含 /health 增强 + 编译后 backup 脚本 + 2GB 内存配置）

---

## 当前状态

- **项目**: Chorus Hub — 100 并发容量验证
- **Stage**: 非 Fusion-Core 流水线任务，属于运维验证阶段
- **阻塞点**: 线上压测未执行。本地预筛全 PASS，但不能作为发布结论

---

## 本会话完成事项

- `/health` 增强 → `src/server/routes.ts:535-563`：新增 6 项观测指标 + SQLITE_BUSY 计数器
- 压测脚本 → `scripts/load/{lib,sse-soak,send-burst,send-webhook-burst,soak-test}.ts`
- 本地 4 场景全 PASS → 结果记录在 `docs/server/capacity-report.md`
  - 场景 A: 100 SSE 连接 2min，0 断连
  - 场景 B: 100 并发 SSE burst，p95=50ms
  - 场景 C: 100 并发 webhook burst，p95=128ms
  - 场景 D: 30 agents 5min soak，p95=3ms，内存增长 1.1%
- 备份生产化 → `src/scripts/backup-db.ts` 纳入 tsc，`package.json` db:backup 改为 `node dist/scripts/backup-db.js`
- 旧 `scripts/backup-db.ts` 已删除（消除分叉）
- 容量报告定位 → "本地预筛通过，待线上验证"
- `fly.toml` → `shared-cpu-2x` / `2048mb` / `[mounts] source = "chorus_data"`

---

## 待完成（按优先级）

1. [P0] 创建 Fly volume 并部署新镜像 — 依赖：Commander 执行 `fly volumes create` + `fly deploy`
2. [P0] 线上 SSE soak：`HUB_URL=https://agchorus.com npx ts-node scripts/load/sse-soak.ts 100 30` — 依赖：部署完成
3. [P0] 线上持续负载：`HUB_URL=https://agchorus.com npx ts-node scripts/load/soak-test.ts 30 30 60` — 依赖：部署完成
4. [P1] 线上 webhook burst：`HUB_URL=https://agchorus.com npx ts-node scripts/load/send-webhook-burst.ts 100` — 依赖：部署完成
5. [P1] 线上备份验证：`fly ssh console -C "mkdir -p /data/backups && node dist/scripts/backup-db.js /data/backups/post-loadtest.db"` — 依赖：压测完成
6. [P1] 根据线上数据更新 `docs/server/capacity-report.md`，给出最终发布决策

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| 本地预筛 ≠ 发布结论 | 线上内存/IOPS/网络会改变结果 | 本地 RAM 充裕 + SSD，与 256MB 实例差异巨大 |
| 部署内存 2GB | fly.toml 已配 shared-cpu-2x/2048mb | 进程 RSS 460MB 起步，256MB 必 OOM |
| 备份用 SQLite backup API | 不用 fly sftp 拷文件 | WAL 模式下直接拷主库不保证一致性 |
| backup 脚本纳入 tsc | `src/scripts/backup-db.ts` → `dist/scripts/backup-db.js` | 生产镜像不带 ts-node，better-sqlite3 是生产依赖 |
| webhook burst 含内置 stub | `send-webhook-burst.ts` 自带 echo server | 避免外部依赖，但 localhost 回环不等于真实网络 |

---

## 必读文件

1. `docs/server/capacity-report.md` — 完整验收标准和本地/线上结果对照表
2. `fly.toml` — 当前部署配置（2 vCPU / 2GB / volume mount）
3. `scripts/load/lib.ts` — 压测脚本共享库，理解所有场景的注册/连接/发送逻辑
4. `src/server/routes.ts:535-563` — /health 增强后的完整指标列表

---

## 风险与禁区

- **禁止**: 用 `fly sftp get` 当正式备份方案 — WAL 模式下直接拷文件不等于一致性备份
- **禁止**: 在未创建 volume 的情况下部署 — `[mounts]` 指向 `chorus_data`，不存在会启动失败
- **注意**: 压测脚本从本地跑到线上，网络延迟会拉高 p95/p99 — 不要和本地数字直接对比，关注 5xx 和 SQLITE_BUSY 是否为 0
- **注意**: `send-burst.ts` 注册 200 agents，需 CHORUS_MAX_AGENTS ≥ 200（线上默认 100，需临时调高或分批跑）

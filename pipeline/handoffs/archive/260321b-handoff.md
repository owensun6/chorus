# Handoff — 2026-03-21 (Phase B: Public Alpha Hub)

## ⚡ 立即行动（第一步）

运行 `bin/alpha-probe-report.sh` 查看 24h 持续性证据汇总。如果成功率 >99%，Phase B 验证闭环。如果有失败样本，读取 `/tmp/chorus-alpha-probe.jsonl` 定位原因。

---

## 当前状态

- **项目**: Chorus Protocol
- **Phase**: B — Public Alpha Hub（设计冻结 + 代码实现 + 部署完成）
- **验证状态**: 功能验证完成（happy + negative + concurrent + rate limit），持续性证据积累中（24h 观测期）
- **阻塞点**: 无功能阻塞。等待 24h UptimeRobot + cron 数据积累后出汇总报告

---

## 本会话完成事项

- 设计冻结稿 → `docs/server/public-alpha-plan.md`（Commander APPROVED 2026-03-21）
- 运维手册 → `docs/server/public-alpha-operator-guide.md`
- 用户指南 → `docs/server/public-alpha-user-guide.md`（Commander 重写版，精简到 194 行）
- Rate limit 中间件 → `src/server/rate-limit.ts`（IP + key 双维，固定窗口 60s）
- Registry 增强 → `src/server/registry.ts`（max 100 agents + delivery/failure 计数器）
- Routes 增强 → `src/server/routes.ts`（well-known 含 limits/warnings/server_status，health 含计数器，429 ERR_REGISTRY_FULL）
- 入口串接 → `src/server/index.ts`（rate-limit + bodyLimit + auth，env vars 全部可配）
- Fly.io 配置 → `fly.toml`（单机 sjc，shared-cpu-1x/256MB，auto_stop=off，max_machines=1）
- 部署 → `chorus-alpha.fly.dev` 运行中
- Smoke 脚本 → `bin/alpha-smoke.sh`（14 项检查，exit code 0/1）
- Light probe → `bin/alpha-probe-light.sh`（JSONL 追加到 /tmp/chorus-alpha-probe.jsonl）
- Report → `bin/alpha-probe-report.sh`（24h 成功率/延迟分位数/失败样本）
- Cron 已配置：10min 轻探 + 2h 深探
- UptimeRobot 外部监控：5min，100% uptime，198ms avg（截至部署后 30min）
- 175 tests, 82.6%+ coverage

---

## 待完成（按优先级）

1. [P0] 24h 持续性证据汇总 — 依赖：时间（等 24h 数据积累），运行 `bin/alpha-probe-report.sh`
2. [P0] DNS 绑定 `alpha.chorus.sh` → `chorus-alpha.fly.dev` — 依赖：Commander DNS 操作 + `fly certs add alpha.chorus.sh`
3. [P1] 向 early testers 分发 API key 和 user guide — 依赖：P0 完成确认 hub 稳定
4. [P1] Gene 毕业：2 个 lead genes (fly-single-machine-memory 0.9, deploy-before-docs 0.8) — 运行 `/fusion-graduate`
5. [P2] 第一次真实外部 Agent 接入验证（B 阶段成功标准 #5）— 依赖：P1 tester 到位

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| 域名 | `alpha.chorus.sh`（DNS 待绑定，当前用 `chorus-alpha.fly.dev`） | 语义清楚，后续可扩展 alpha/docs/api |
| 部署平台 | Fly.io，单机 sjc | ~$3/month，够用，比 Railway 便宜 |
| API key 策略 | 手动发放，per-tester 独立 key | 不做自助注册/邀请码，alpha 只给 3-10 人 |
| 单机锁定 | `max_machines_running = 1` | Fly 默认 2 台导致 in-memory registry 不一致 |
| 持续在线 | `auto_stop_machines = "off"` | Alpha hub 必须随时可达 |
| 监控架构 | 外部 UptimeRobot + 本地 cron 双轨 | 外部提供独立证据，本地提供深度链路验证 |
| 当前 API keys | `tester-commander-a1b2`, `tester-alice-c3d4`, `tester-bob-e5f6` | 已配置到 Fly secrets |

---

## 必读文件

1. `docs/server/public-alpha-plan.md` — 设计冻结稿，所有决策的源头
2. `docs/server/public-alpha-user-guide.md` — tester 接入指南（Commander 重写版）
3. `fly.toml` — 部署配置，单机锁定
4. `bin/alpha-smoke.sh` — 14 项 smoke 脚本，验证 hub 健康的标准工具
5. `src/server/index.ts` — 入口文件，所有中间件串接点

---

## 风险与禁区

- **禁止**: 在 Fly.io 上开启第二台机器（`max_machines > 1`）— 原因：in-memory registry 会不一致，已验证
- **禁止**: 先写用户文档再部署 — 原因：文档会漂离真实行为（Commander 明确指令）
- **注意**: `fly secrets set` 会触发 redeploy，registry 会清空 — 添加/撤销 key 前告知 testers
- **注意**: 限流在并行请求下生效（70并发中49个429），顺序请求因延迟可能跨窗口不触发 — 这是正常行为不是 bug

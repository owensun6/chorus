# Handoff: 260322 — Launch-Ready State

日期: 2026-03-22
会话: 自助注册 + 消息持久化 + 安全加固 + 推广准备 + 全量自检

---

## 已完成

### 1. 自助注册 + SSE Inbox
- `POST /register` (无需 auth) → 返回 per-agent API key (`ca_` 前缀)
- `GET /agent/inbox` (agent key auth) → SSE 实时收消息
- 消息路由：SSE 优先 → webhook 回退 → 都没有 = failed
- 237 tests → 247 tests (含 sender 验证后)

### 2. Hub 侧消息历史
- `GET /agent/messages?since=<id>` — 投递成功的消息存 per-agent 列表（1000 上限）
- 发送方和接收方都能查到
- SSE 断连后增量补漏

### 3. Agent 侧本地持久化（SKILL.md 指令）
- `~/.chorus/config.json` — agent_id + api_key + hub_url
- `~/.chorus/history/{peer}.jsonl` — 每条消息 append 一行
- CLI `init` 创建目录结构
- SKILL.md 标记为 MUST

### 4. Sender 身份验证
- POST /messages 验证 envelope.sender_id 匹配调用者的 agent key
- 防止 agent A 冒充 agent B（403 ERR_SENDER_MISMATCH）
- Operator key 不受影响

### 5. CI Pipeline
- `.github/workflows/ci.yml` — tsc + build + test with coverage
- Push/PR to main 自动触发

### 6. 文档全量同步
- SKILL.md (EN + zh-CN) — 含自助注册、SSE inbox、/agent/messages、本地存储
- TRANSPORT.md — 含新端点表 + 6.6 Message History 章节
- README (EN + ZH) — 面向外部开发者，5 分钟 quickstart
- npm @chorus-protocol/skill@0.7.1 — 所有模板同步

### 7. 推广素材
- `docs/launch-announcement.md` — Twitter 线程(中英)、LinkedIn、1-pager、GitHub Discussion
- `docs/distribution/platform-ready/` — 8 个按平台格式化的文件
- `docs/distribution/awesome-list-prs/` — VoltAgent + e2b PR 模板
- `docs/distribution/marketing-automation-tools.md` — 11 个自动化工具调研
- GitHub Release v0.6.0-alpha + Discussion #1 已创建

### 8. 稳定性验证
- 24h 探针报告：278 次探测，100% 成功率，0 失败
- E2E 11 步验证全通过（register → inbox → send → history → spoof block）

### 9. Review 分支处理
- `claude/project-review-q2FO2` 审查完毕
- Cherry-picked: sender 身份验证 + CI
- Skipped: pg/redis/sqlite 持久化层（Alpha 不需要）、crypto/webhook-signer（过早）
- 分支已删除

---

## 当前数字

- Tests: 247 pass (20 suites)
- Hub: v0.7.0-alpha @ chorus-alpha.fly.dev
- npm: @chorus-protocol/skill@0.7.1
- Git: main @ latest
- Probe: 278 probes, 100% success

---

## 立即行动（下一个会话）

### HIGH: 执行推广
- 推广素材已就绪，直接发
- 优先 Twitter + GitHub awesome-lists
- 工具调研在 docs/distribution/marketing-automation-tools.md

### MEDIUM: EXP-03 人类冷启动
- 方案已在 docs/experiments/EXP-03-human-developer-cold-start.md
- 可以用推广吸引的第一批用户作为验证对象

### LOW: 下一代功能
- Hub 持久化（当前内存，重启清空）
- 自定义域名 alpha.chorus.sh
- CLI 集成自助注册（当前是 curl，未来 npx init → 自动注册）

---

## 关键文件索引

| 文件 | 用途 |
|------|------|
| `src/server/routes.ts` | 所有路由（含 /register, /agent/inbox, /agent/messages） |
| `src/server/inbox.ts` | SSE 连接管理 |
| `src/server/message-store.ts` | Hub 侧消息历史 |
| `src/server/registry.ts` | Agent 注册 + per-agent key |
| `skill/SKILL.md` | Agent 教学文档（含本地持久化指令） |
| `skill/TRANSPORT.md` | HTTP 传输规范 |
| `docs/launch-announcement.md` | 推广文案 |
| `docs/distribution/platform-ready/` | 各平台格式化素材 |
| `docs/distribution/marketing-automation-tools.md` | 自动化推广工具调研 |
| `.github/workflows/ci.yml` | CI pipeline |

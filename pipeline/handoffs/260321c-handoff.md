# Handoff: 260321c — Alpha Console + CLI 0.5.0 + EXP-03 + Deploy

日期: 2026-03-21
会话: Alpha Console 实现 + CLI 硬化 + EXP-03 改版 + merge/publish/deploy

---

## 已完成

### 1. Alpha Console（feature/alpha-console → merged to main）

- `src/server/activity.ts` — 环形缓冲区 activity stream（500 事件，pub/sub）
- `src/server/routes.ts` — 3 个新 GET 端点（/activity, /events SSE, /console）+ 6 个事件发射点（agent_registered/removed, message_submitted/forward_started/delivered/failed），所有 message 事件共享 trace_id
- `src/server/console-html.ts` — 三栏 UI（agents/timeline/detail+actions），Tailwind CDN + vanilla JS，安全 DOM（无 innerHTML）
- `tests/server/activity.test.ts` — 13 tests
- `tests/server/activity-routes.test.ts` — 11 tests
- `docs/server/alpha-console-guide.md` — 使用指南

### 2. CLI 硬化（审查整改）

- `packages/chorus-skill/cli.mjs`:
  - register-before-write：openclaw 注册失败不写文件
  - verify --target 校验：非法 target exit 1
  - help 收口：只展示 openclaw，替代路径需 --help-all
  - verify 输出纯净化：只输出机器可检查结果
- `tests/cli/cli.test.ts` — 14 integration tests（rollback、target 校验、init→verify→uninstall 全链路）
- version bump 0.4.1 → 0.5.0

### 3. EXP-03 方案改版

- `docs/experiments/EXP-03-human-developer-cold-start.md` — 全面重写：
  - Materials: npm install 替代手动传文件
  - Task prompt: npx init → 公共 hub 注册
  - Pre-flight S13: 5 个子章节（版本门禁、hub 基础设施、install smoke、tunnel 可达性、session logistics）
  - 新增 metrics: TTIC, IOS
  - 新增 taxonomy: INST (install defect)

### 4. 发布 + 部署

- `npm publish @chorus-protocol/skill@0.5.0` — 已上 npm ✓
- `flyctl deploy` — chorus-alpha.fly.dev v2 已部署，/console /activity /events 在线 ✓
- `git push origin main` — b671eb9 ✓
- 白皮书 `docs/project-whitepaper-2026-03-21.md` 已更新并 committed

---

## 立即行动（下一个会话）

### HIGH: Console SSE 端到端人工验收

Hub 已部署但 Console 只验了 HTTP 200，未验 SSE 推流和 UI 交互。

执行：
1. 浏览器打开 `https://chorus-alpha.fly.dev/console`
2. 确认 SSE 绿点
3. 用 API Key 执行 Register Agent × 2 → 确认 agent 列表 + timeline 实时更新
4. Send Message → 确认 submitted→forward→failed 链（test agent endpoint 不可达所以 failed 正常）
5. 负向测试：No Auth (401) / Unknown Receiver (404) / Bad Envelope (400)
6. 点击事件查看 Detail JSON 含 trace_id
7. 刷新页面确认历史事件从 /activity 恢复

### MEDIUM: Demo Agent 注册

Hub 重启后 agents_registered=0，EXP-03 S13.2 需要 `agent-zh@conductor` 在线。

执行：
1. 启动 echo receiver（accept POST, log envelope, return {"status":"ok"}）
2. ngrok 暴露
3. curl POST /agents 注册 agent-zh@conductor
4. 自发自收验证 → delivered
5. Console Timeline 确认完整链路

### LOW: EXP-03 Pre-Flight 全量勾选

S13.1 (版本 ≥ 0.5.0) ✓ 已验证
S13.2 (demo agent) — 依赖上面 MEDIUM 项
S13.3 (install smoke) ✓ 已验证
S13.4 (tunnel) — 等 subject
S13.5 (session) — 等 subject

---

## 待完成（非紧急）

- EXP-03 实际执行 — 方案就绪，等 subject 招募
- feature/alpha-console 分支可删除（已 merged）

---

## 关键文件索引

| 文件 | 用途 |
|------|------|
| `src/server/activity.ts` | Activity stream 核心 |
| `src/server/console-html.ts` | Console UI |
| `src/server/routes.ts` | 所有路由 + 事件发射 |
| `packages/chorus-skill/cli.mjs` | CLI 0.5.0 |
| `tests/cli/cli.test.ts` | CLI 集成测试 |
| `docs/experiments/EXP-03-human-developer-cold-start.md` | 实验方案 |
| `docs/server/alpha-console-guide.md` | Console 使用指南 |
| `docs/project-whitepaper-2026-03-21.md` | 白皮书 |

---

## 数字快照

- Tests: 214 pass（17 suites）
- Build: clean
- npm: @chorus-protocol/skill@0.5.0
- Hub: chorus-alpha.fly.dev v2, uptime 从 deploy 时刻起
- Git: main @ b671eb9

# Chorus 项目进度与目标白皮书

> 用途：给下一个会话、下一个专家的完整交接底稿
> 日期：2026-03-22
> 状态：推广就绪版
> 更新日志（2026-03-22）：自助注册 + SSE inbox + sender 身份验证 + 本地聊天记录持久化 + Hub 消息历史 + CI pipeline + 24h 100% 稳定性报告 + 双语推广素材 + GitHub Release/Discussion 已创建

## 1. 一句话结论

Chorus 已完成推广就绪状态：自助注册（无需共享 key）、SSE 实时收消息（无需 ngrok）、Hub 侧消息历史、Agent 侧本地持久化、sender 身份验证、24h 探针 100% 通过（278 次零失败）、GitHub Release v0.6.0-alpha 已发布、多平台推广素材已就绪。npm @chorus-protocol/skill@0.7.1。剩余：EXP-03 人类冷启动实验待执行。

## 2. 项目当前定位

Chorus 不是单纯的 CLI，也不是单纯的 Hub。

它现在由三层组成：

1. **协议层**：定义 Chorus envelope、发送/接收约束、最小 HTTP 绑定。
2. **分发层**：通过 `@chorus-protocol/skill` 把协议知识装进 Agent 环境。
3. **运行层**：通过本地或公网 Hub 提供注册、发现、转发与验证能力。

当前阶段的目标不是“做完整产品”，而是证明：

- 外部 Agent 能安装 skill
- 能接入公网 Hub
- 能完成真实消息投递
- 这条链路对外部测试者可重复

## 3. 已完成的核心成果

### 3.1 协议与参考实现

- `v0.4` 协议已收敛，关键字段已稳定到 `chorus_version`、`sender_id`、`original_text`、`sender_culture`。
- 文档主面已收平：`PROTOCOL.md`、`SKILL.md`、`TRANSPORT.md`、`envelope.schema.json`、`README.md` 已同步到同一叙事。
- 参考实现已对齐 `v0.4`，服务端和 agent 端链路已可跑通。

### 3.2 实验验证

- `EXP-01`：外部 Claude 在受控条件下完成首次接入，结论为通过。
- `EXP-02`：非 Claude AI（MiniMax-M2.7）完成双向闭环，结论为 `CONDITIONAL PASS`。
- `EXP-03`：人类开发者冷启动实验已设计，但尚未执行。

### 3.3 npm 分发

- `@chorus-protocol/skill` 已发布到 npm。
- 当前对外主入口已收敛为：

```bash
npx @chorus-protocol/skill init --target openclaw
```

- 文档已朝“单一官方路径”收敛，`README`、安装文档、quick trial 已按该方向重写。

### 3.4 Public Alpha Hub

- 公网 Hub 已部署：`https://chorus-alpha.fly.dev`
- 已有文档：
  - [public-alpha-plan.md](/Volumes/XDISK/chorus/docs/server/public-alpha-plan.md)
  - [public-alpha-operator-guide.md](/Volumes/XDISK/chorus/docs/server/public-alpha-operator-guide.md)
  - [public-alpha-user-guide.md](/Volumes/XDISK/chorus/docs/server/public-alpha-user-guide.md)
- 已实现能力：
  - `GET /health`
  - `GET /.well-known/chorus.json`
  - `POST /agents`
  - `GET /agents`
  - `POST /messages`
  - Bearer token 鉴权
  - rate limit
  - message/body/registry 限制
  - health counters

### 3.5 公网验证与监控

- Happy path、negative、幂等、并发、限流验证已跑通。
- 监控体系已搭建：
  - 外部：UptimeRobot，5 分钟
  - 本地轻探：`bin/alpha-probe-light.sh`
  - 本地深探：`bin/alpha-smoke.sh`
  - 24h 汇总：`bin/alpha-probe-report.sh`

## 4. 当前真实状态

### 4.1 已证实

- 协议链路本身可用。
- 公网 Alpha Hub 已可接收真实注册并投递真实消息。
- rate limit、生存期边界、重启后 in-memory 清空行为符合 Alpha 设计。
- 用户侧、运维侧文档已经分层，不再混写。

### 4.2 未证实

- 尚无 `24h` 连续可用报告，因此不能声称“持续稳定可用”。
- 尚无人类开发者冷启动成功证据，因此不能声称“陌生开发者按文档一定能装对、接对”。
- 尚无真实外部测试者持续使用证据，因此不能声称“已形成外部采纳”。

## 5. 当前正在做的事情

### 5.1 持续性证据积累

正在等待 24 小时监控数据积累完成，然后运行：

```bash
bin/alpha-probe-report.sh
```

这一步完成后，才能把当前状态从“曾经跑通”升级为“持续可达”。

### 5.2 安装路径收敛的最后闭环

虽然文档已经收敛到 `openclaw` 主路径，但最近一轮代码审查对 CLI 变更给出了 `FAIL`，原因不是方向错，而是实现还没闭环。

当前已知问题：

1. `init --target openclaw` 在 `openclaw.json` 不存在时会先写文件、后失败，留下半安装状态。
2. `verify --target` 对非法 target 不会 fail fast，可能误报成功。
3. CLI help 仍把替代路径作为一等入口展示，和“单一路径收敛”口径不一致。
4. 缺少针对 CLI 文件系统副作用的集成测试。

这意味着：

- “安装路径收敛”在文档层基本成立
- 但在 CLI 工具层还不能宣布完成

## 6. 当前最重要的风险

### P0 风险

1. **24h 观测未出报告**
   当前只能说 Alpha Hub 已验证功能，不足以说稳定。

2. **CLI 安装链路仍有回归风险**
   如果现在贸然扩大外部分发，最可能先坏在安装流程，而不是 Hub API。

3. **EXP-03 未执行**
   缺少人类开发者冷启动数据，所有“易安装、易接入”的判断都还带推断成分。

### P1 风险

1. `skill/*` 与 `packages/chorus-skill/templates/*` 长期无自动同步机制。
2. Server 仍是 Alpha 级安全边界，不能被误读为生产服务。
3. 当前仓库工作区是脏的；下一阶段开发如果不先切分支，会把 Alpha 基线和新功能混在一起。

## 7. 下一阶段的明确目标

下一阶段不要扩散范围。优先级应固定如下。

### Goal 1：完成 Alpha 基线闭环

判定条件：

- `24h` 探测报告生成
- 有成功率、失败样本、延迟分位数、最长连续失败时长
- 对外文档同步到最新结论

### Goal 2：修复 CLI 收敛链路

判定条件：

- OpenClaw 配置缺失时不留下半安装垃圾
- `verify --target` 非法参数立即失败
- CLI 帮助文案与“单一路径”口径一致
- 有 CLI 集成测试覆盖这些行为

### Goal 3：执行 EXP-03

目标不是让受试者“学会 Chorus”，而是验证文档和安装流程是否真的足够。

判定条件：

- 至少 1 名符合标准的人类开发者从零完成实验
- 保留完整审计证据
- 得到 `PASS` 或 `CONDITIONAL PASS`
- 若失败，沉淀出明确文档缺陷而不是主观印象

### Goal 4：开放小范围外部测试

前提是 Goal 1-3 完成后，再向 `2-5` 个 early testers 分发 API key 和 user guide。

目标不是拉活跃，而是验证：

- skill 安装是否真的顺滑
- 公网 Hub 是否对外部环境稳健
- 文档是否能支撑陌生人独立完成接入

### Goal 5：构建 Alpha 测试控制台

这是下一阶段最值得做的新功能，与 EXP-03 协同而非顺序依赖（Console 为 EXP-03 提供实时观测，替代 Shell 历史审计）。

定位：

- 不是产品首页
- 不是终端用户聊天页
- 是 `Alpha test console`

MVP 范围：

1. Agent 列表
2. Message 时间线
3. Message 详情抽屉
4. SSE 实时更新
5. 最小测试动作区

目的：

- 让测试者和维护者看到消息卡在哪一跳
- 把“看脚本输出”升级成“看系统行为”

## 8. 推荐执行顺序

下一个专家不要自由发挥，按这个顺序接手：

> **顺序调整说明**：EXP-03 方案已优化为轻量化版本（npx init + 公网 Hub + API key），不再需要 Conductor 起本地服务器；同时 Console 功能与 EXP-03 可共用同一公网 Hub，观测更直接。因此顺序调整为 **Console → EXP-03**，而非原来的 Console 最后。

1. 跑 `bin/alpha-probe-report.sh`，生成 24h 报告。
2. 修 CLI 审查中判定失败的 4 个问题。✅（已修复，0.5.0 已发版）
3. `feature/alpha-console` 合并到 main → `npm publish @chorus-protocol/skill@0.5.0` → 部署含 `/console` 的新 hub。
4. 执行 `EXP-03` 人类开发者冷启动实验（轻量化方案：npx init + 公网 Hub + API key + Console 观测）。
5. 基于冷启动结果修一轮安装文档（若需要）。
6. 小范围发 key 给 2-5 个 early testers。

## 9. 关键文件地图

### 核心协议与分发

- `PROTOCOL.md`
- `SKILL.md`
- `TRANSPORT.md`
- `packages/chorus-skill/cli.mjs`
- `docs/distribution/openclaw-install.md`
- `docs/distribution/quick-trial.md`

### Public Alpha

- `src/server/index.ts`
- `src/server/routes.ts`
- `src/server/registry.ts`
- `src/server/rate-limit.ts`
- `fly.toml`

### 监控与验证

- `bin/alpha-smoke.sh`
- `bin/alpha-probe-light.sh`
- `bin/alpha-probe-report.sh`

### 状态与交接

- `docs/status-report-2026-03-21.md`
- `docs/server/public-alpha-plan.md`
- `docs/server/public-alpha-operator-guide.md`
- `docs/server/public-alpha-user-guide.md`
- `docs/experiments/EXP-03-human-developer-cold-start.md`
- `pipeline/handoffs/260321b-handoff.md`

## 10. 交接时必须说明的事实

下一个专家必须知道下面这些事实，否则很容易误判。

1. **Chorus 不是“已经完成的产品”**。它目前是协议 + skill 分发 + Alpha Hub 的验证系统。
2. **Public Alpha 已部署，但 24h 证据未出时不能宣称稳定。**
3. **安装路径正在收敛，但 CLI 实现还没完全达标。**
4. **EXP-03 未执行前，不能说“人类开发者冷启动已验证”。**
5. **下一阶段最有价值的新能力是 Alpha 测试控制台，而不是再堆更多脚本。**

## 11. Git 与工作方式建议

- 不要继续直接在脏 `main` 上开发下一阶段功能。
- 先切功能分支，例如：

```bash
git checkout -b feature/alpha-console
```

- 如果先修 CLI 收敛问题，也可先走：

```bash
git checkout -b fix/skill-install-verification
```

推荐提交粒度：

1. 修 CLI 回归
2. 补 CLI 测试
3. 更新分发文档
4. 产出 24h 报告
5. 再开 Alpha console 分支

## 12. 最终交接判断

如果下一个专家只能做一件事，做这件：

**先把 24h 报告和 CLI 回归修复闭环。**

因为现在最脆弱的地方不是协议，不是 Hub 路由，而是：

- 还没拿到“持续性证据”
- 还没把“安装成功”真正做成可重复、可验证、可交付的单一路径

这两个不闭环，后面所有外部分发、真人实验、前端控制台，都会建立在不稳的地基上。

# Handoff — Chorus / OpenClaw Bridge 收尾状态（2026-03-23）

> ARCHIVED — 旧 bridge 收尾状态文档。
> 不得作为 Bridge v2 的现状判断或设计依据；仅可作为历史证据引用。

## 当前总判定

- **Hub queued delivery**：PASS
- **OpenClaw bridge runtime 主线**：基本 PASS
- **发布面**：仍未可正式公开发布
- **当前唯一运行态待确认项**：
  1. `self_send_filtered`
  2. `agent_context_matches_agent_config`

---

## 一、已经闭环的线

### 1. Hub queued delivery
已确认：
- receiver offline 时 `POST /messages` 返回 `202 queued`
- 消息入库
- 后续 `GET /agent/messages?since=N` 可拉到
- queued / delivered / failed 指标已拆开
- console 有 `message_queued`
- 全量后端测试曾达成：
  - `273/273`
  - functions coverage `80.7%`

相关文件：
- `/Volumes/XDISK/chorus/src/server/routes.ts`
- `/Volumes/XDISK/chorus/src/server/registry.ts`
- `/Volumes/XDISK/chorus/src/server/console-html.ts`
- `/Volumes/XDISK/chorus/src/server/db.ts`

### 2. bridge 安全降权
已确认在 bridge 路径里存在机器可读边界：
- `trust_level: "remote_untrusted"`
- `allow_local_control: false`
- `allow_tool_execution: false`
- `allow_side_effects: false`
- `source_channel: "chorus"`

相关文件：
- `/Users/test2/.openclaw/extensions/chorus-bridge/guard.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/index.ts`

注意：
- 这只是 bridge 路径硬约束
- 不是 OpenClaw 全局 capability gate

### 3. bridge 多 agent / per-agent state
已确认：
- per-agent state 目录
- config-driven culture
- channel-aware routing
- resolve/helper 从手抄测试转为真实 import

相关文件：
- `/Users/test2/.openclaw/extensions/chorus-bridge/index.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/resolve.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/channel-agnostic.test.ts`

### 4. outbound relay
已确认：
- 有 `relay.ts`
- `splitReplyParts()` 分离本地用户可见内容和发往 Hub 的内容
- `reply_format` 要求 `[chorus_reply]` 在 final answer 内
- `<final>` / `[chorus_reply]` 冲突已修

相关文件：
- `/Users/test2/.openclaw/extensions/chorus-bridge/relay.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/resolve.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/index.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/outbound-relay.test.ts`

### 5. session isolation
已确认代码已改为：
- `chorus_inbound` 使用独立 session key
- 不再复用 `agent:<name>:main`
- `updateLastRoute` 也写入 chorus session，不污染 user session

相关文件：
- `/Users/test2/.openclaw/extensions/chorus-bridge/resolve.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/index.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/session-isolation.test.ts`

---

## 二、刚刚完成并已审过的线

### self-send guard + context diagnostics
这是最近刚判 PASS 的一条。

已确认：
- SSE 入口在 `saveToInbox` 前有 self-send guard
- catch-up 入口在 `saveToInbox` 前有 self-send guard
- self-send 会：
  - 打 `[self-send] skip ...`
  - 写 `seen`
  - 不写 inbox
  - 不进 `processMessage`
- `processMessage` 一开头有 `[context]` 诊断日志：
  - `agent`
  - `agent_id`
  - `sender`
  - `channel`
  - `culture`
  - `lang`
  - `senderCulture`
  - `mustAdapt`

相关文件：
- `/Users/test2/.openclaw/extensions/chorus-bridge/index.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/self-send-guard.test.ts`

我本地已跑：
- `npx tsx /Users/test2/.openclaw/extensions/chorus-bridge/self-send-guard.test.ts`
- `12/12` pass

模板已同步：
- `/Volumes/XDISK/chorus/packages/chorus-skill/templates/bridge/index.ts`

---

## 三、当前唯一待确认的运行态问题

### 1. self_send_filtered
需要真实回归确认：
- xiaov / xiaox 都不再处理自己发出的 chorus 消息
- 不再出现 `sender_id === ctx.config.agent_id` 的 chorus session

### 2. agent_context_matches_agent_config
之前有实锤异常：
- `xiaov` config 是：
  - `culture: "zh-CN"`
  - `preferred_language: "zh-CN"`
- 但 `xiaov` 某条 chorus session 注入里出现过：
  - `receiver_culture: "en"`
  - `receiver_preferred_language: "en"`

这说明：
- 之前除了 self-send 之外，还存在 agent context/config 混线证据
- 现在有了 `[context]` 日志，下一步要看这条问题是否仍存在

---

## 四、1号当前该验什么

只验这两项，不要扩：

### A. `self_send_filtered`
验收标准：
- 出现 `[self-send] skip ...`
- 不再出现 sender_id == agent_id 的 chorus_inbound session
- self-send trace 不进 inbox / 不进 processMessage 完成链

### B. `agent_context_matches_agent_config`
验收标准：
- `xiaov` 的 `[context]` 日志里：
  - `agent=xiaov`
  - `agent_id=xiaov@openclaw`
  - `culture=zh-CN`
  - `lang=zh-CN`
- `xiaox` 的 `[context]` 日志里：
  - `agent=xiaox`
  - `agent_id=xiaox@chorus`
  - `culture=en`
  - `lang=en`
- 如仍混线，必须拿日志原文，不准猜

建议给 1号的任务格式：
- `self_send_filtered: PASS / FAIL`
- `agent_context_matches_agent_config: PASS / FAIL`
- `exact_evidence_for_each`
- `exact_root_cause_if_fail`

---

## 五、明确不要再做的错误方向

### 1. 不要再改用户/测试 agent 的 persona 去加 Chorus 专属规则
边界已明确：
- 本地可把 `xiaox` 做成英文样本
- 但**不能**把 Chorus 协议要求写进别人的 persona/identity，作为产品方案

### 2. 不要让 4号再扩 bridge 做“全局 outbound interception”
这个方向已经否掉：
- 问题本质是 session / context boundary
- 不是要把 bridge 扩成 OpenClaw 全局消息总线

### 3. 不要把 ClawHub 提前发
发布顺序已经明确：
- ClawHub 最后发
- 现在还不行

---

## 六、发布面当前状态

### 现在能做
- 小范围测试者用 npm 预发布包
- 内部 / 邀请制 GitHub draft
- 给测试者发安装/验证命令：
  - `init -> verify -> OpenClaw load bridge`

### 现在不能做
- 正式 GitHub release
- ClawHub 公开发布
- 同时对外发 npm / GitHub / ClawHub 三套入口

### 原因
仍需统一：
1. **版本基线**
2. **测试数**
3. **能力边界**
4. **三种发布物的承诺边界**

---

## 七、2号 / 3号的分工（已下发）

### 2号
负责英文 / 通用发布面：
- `README.md`
- `docs/distribution/github-release-package.md`
- `docs/launch-announcement.md`
- `docs/distribution/openclaw-install.md`
- `docs/distribution/quick-trial.md`
- `packages/chorus-skill/README.md`
- 视情况同步 package version metadata

目标：
- 统一版本
- 统一域名 `agchorus.com`
- 统一安装路径
- 统一 Hub 存储模型
- 统一能力声明边界

### 3号
负责中文发布面：
- `docs/distribution/v0.7.0-alpha-launch-kit.md`
- `docs/launch-announcement.md` 中文部分
- `docs/distribution/openclaw-install.md` 中文部分
- `docs/distribution/quick-trial.md` 中文部分

目标：
- 同样统一事实面
- 中文口径不再用 “human”，统一为：
  - `面向用户`
  - `面向 Chorus`
  - `用户会话`
  - `Chorus 会话`

### 术语原则
- 英文：
  - `user-facing`
  - `chorus-facing`
  - `user session`
  - `chorus session`
- 中文：
  - `面向用户`
  - `面向 Chorus`
  - `用户会话`
  - `Chorus 会话`

---

## 八、目前最重要的具体文件

### runtime / bridge
- `/Users/test2/.openclaw/extensions/chorus-bridge/index.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/resolve.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/relay.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/guard.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/session-isolation.test.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/self-send-guard.test.ts`
- `/Users/test2/.openclaw/extensions/chorus-bridge/outbound-relay.test.ts`

### deployed configs / state
- `/Users/test2/.chorus/agents/xiaov.json`
- `/Users/test2/.chorus/agents/xiaox.json`
- `/Users/test2/.chorus/state/xiaov/`
- `/Users/test2/.chorus/state/xiaox/`
- `/Users/test2/.openclaw/logs/gateway.log`

### repo templates
- `/Volumes/XDISK/chorus/packages/chorus-skill/templates/bridge/index.ts`
- `/Volumes/XDISK/chorus/packages/chorus-skill/templates/bridge/resolve.ts`
- `/Volumes/XDISK/chorus/packages/chorus-skill/templates/bridge/relay.ts`

### release docs
- `/Volumes/XDISK/chorus/docs/distribution/release-facts-unification.md`
- `/Volumes/XDISK/chorus/docs/distribution/release-claims-boundary.md`

---

## 九、一句话结论

**bridge 运行时主线已经基本闭环；现在唯一还没用真实运行证据关掉的，是 `self_send_filtered` 和 `agent_context_matches_agent_config` 这两个验收项。发布仍然要后置。**

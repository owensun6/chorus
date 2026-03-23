# Handoff — 2026-03-23 Session 6

## 先读这个

这轮三条线已经分开：

1. `chorus-bridge` spec
2. `chorus-bridge` 实现
3. Hub `/register` invite gating

不要再把它们混在一起审。

---

## 当前判定

### 1. Bridge 文档

- `docs/chorus-bridge-plugin-spec.md` = **PASS**
- `docs/chorus-bridge-acceptance.md` = **PASS**

这两份文档现在可以作为：

- 实现基线
- 验收基线

### 2. Hub gating

- `/register` 的最小 invite gating = **PASS**

当前保留的改动只有：

- `invite_code` 请求字段
- `CHORUS_INVITE_CODES` 环境变量
- `/register` 上的 `403 ERR_INVITE_REQUIRED`
- `/health` 的 `invite_gating`

已经确认：

- 没有 ownership guard
- 没有 `ERR_AGENT_EXISTS`
- 没有 `/webhook-stub`
- auth exempt 仍只有 `["/register"]`

### 3. Bridge 实现

- `~/.openclaw/extensions/chorus-bridge/index.ts` = **CONDITIONAL**

含义：

- 上一轮卡住的 3 个代码 blocker 已修掉
- 代码现在可以进入**运行验收**
- 还没到“已上线完成”

---

## 1号代码已修掉的 3 个问题

### A. 边界校验

已改为通过共享 `ChorusEnvelopeSchema.safeParse()` 校验 envelope，而不是手写半套字段检查。

### B. resolveDeliveryTarget

已删除“扫描第一个 weixin agent”的错误实现。

现在是：

- 从 `config.agent_id`
- 派生 `agentName`
- 读取 `~/.openclaw/agents/{agentName}/sessions/sessions.json`
- 只取 `agent:{agentName}:main.deliveryContext`

### C. probe 完整性

`probeWeixinDeps()` 已补齐以下导出检查：

- `inbound.getContextToken`
- `accounts.resolveWeixinAccount`
- `send.sendMessageWeixin`
- `send.markdownToPlainText`

并且补了共享 `ChorusEnvelopeSchema` 的可加载性检查。

---

## 当前唯一剩余问题

不是代码问题，是**运行配置问题**。

当前：

- `~/.chorus/config.json` 里的 `agent_id = "xiaox@chorus"`
- `xiaox` 的主会话 `deliveryContext.channel = "telegram"`
- 不是 `openclaw-weixin`

所以当前 bridge 会：

- 正确把 `agentName` 解析为 `xiaox`
- 正确读取 `xiaox` 的 `sessions.json`
- 正确发现它不是 weixin
- 正确在 `resolveDeliveryTarget` 返回 `null`
- 正确把消息留在 `inbox/`

这不是 bug，是当前配置下的设计内行为。

同时，本机已确认：

- `~/.openclaw/agents/xiaov/sessions/sessions.json` 存在
- `agent:xiaov:main.deliveryContext.channel = "openclaw-weixin"`

所以要解锁正式验收，只需要把 bridge 使用的 Chorus 凭证切到 `xiaov@chorus`。

---

## 明确不要做的事

1. 不要再改 bridge spec
2. 不要把 Hub hardening 混回 bridge
3. 不要现在大改 README / `skill/SKILL.md` / `skill/TRANSPORT.md`
4. 不要重开 `before_prompt_build`
5. 不要把当前 `xiaox -> telegram` 的结果误判成 bridge 实现失败

---

## 下一步顺序

### Step 1

准备 `xiaov@chorus` 的 Hub 凭证：

- 注册或确认 `xiaov@chorus`
- 拿到它的 `api_key`

### Step 2

更新：

- `~/.chorus/config.json`

目标值应是：

- `agent_id = "xiaov@chorus"`
- `api_key = xiaov 的 key`
- `hub_url = 现有 hub`

### Step 3

重启 OpenClaw / gateway，让 `chorus-bridge` 以 `xiaov` 身份连接 Hub。

### Step 4

严格按：

- `docs/chorus-bridge-acceptance.md`

跑正式验收，至少跑这些：

- P1 probe
- P2/P3 SSE 在线
- P6/P7/P8 history/inbox/seen
- P11 翻译生效
- P4/P10 断线补漏

### Step 5

如果验收通过，再统一改：

- README
- `skill/SKILL.md`
- `skill/TRANSPORT.md`
- 其他对外文档中关于 `/register` 和 bridge 的表述

---

## 关键文件

- `docs/chorus-bridge-plugin-spec.md`
- `docs/chorus-bridge-acceptance.md`
- `src/server/index.ts`
- `src/server/routes.ts`
- `src/server/validation.ts`
- `tests/server/self-register.test.ts`
- `~/.openclaw/extensions/chorus-bridge/index.ts`
- `~/.chorus/config.json`
- `~/.openclaw/agents/xiaox/sessions/sessions.json`
- `~/.openclaw/agents/xiaov/sessions/sessions.json`

---

## 一句话状态

**文档线已通过，Hub gating 已通过，bridge 代码已过修复审查；现在只差把运行凭证切到 `xiaov@chorus`，然后按验收文档跑正式验证。**

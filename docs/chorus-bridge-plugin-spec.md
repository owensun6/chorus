# OpenClaw Chorus Bridge Plugin — Spike 方案 (v8)

> ARCHIVED — 旧 bridge spike 方案。
> 不得作为 Bridge v2 的设计输入；仅可作为历史证据与失败案例引用。

> 单渠道（WeChat）、单路径、可验证。解决：消息到了 agent 不通知人类、不翻译。

---

## 问题

Chorus Skill 是被动上下文，不是事件触发器。Hub 侧 SSE 正确投递了消息（`message_delivered_sse` 确认），但 agent 端无后台进程监听 → 不通知人类 → 不翻译。

## 为什么是 agent 端插件

Hub 是纯管道（已验证原则）。翻译/推送是 agent 端职责。skill-router、mem9 已验证 OpenClaw hook 体系可用。

## Spike 范围

- **单渠道**: WeChat（小V）
- **单路径**: SSE 收件 → 持久化 → OpenClaw LLM 管道 → WeChat 推送
- **不做**: before_prompt_build 任何用途、通用抽象、多渠道适配

---

## Spike 前置验证（实现前必须先跑通）

跨插件 import 是 spike 的阻断前提。必须先跑通探针，验证通过后才进入实现。

### 要验证的断言

bridge 插件能否在 OpenClaw 运行时 `await import()` weixin 插件的内部 `.ts` 模块，且拿到的 `contextTokenStore` Map 是同一实例（不是独立副本）。

### 为什么存疑

weixin 插件发布内容是 `src/*.ts` + `index.ts`（`package.json:8-17`），没有 `.js` 编译产物。OpenClaw 用 TS-aware loader 加载 `index.ts`，但这只证明同插件目录内的 TS 能被加载，不证明跨目录 `await import()` 也能解析。

### 探针脚本

```typescript
// 内嵌于 index.ts
import { join } from "node:path";
import { homedir } from "node:os";

const WEIXIN_SRC = join(homedir(), ".openclaw", "extensions", "openclaw-weixin", "src");

export async function probeWeixinDeps(): Promise<{
  ok: boolean;
  reason?: string;
  resolvedExt?: string;
  modules?: { accounts: unknown; inbound: unknown; send: unknown };
}> {
  const extensions = [".js", ".ts", ""];  // TS ESM 约定 / 直接 .ts / 无后缀

  for (const ext of extensions) {
    try {
      const inboundPath = join(WEIXIN_SRC, "messaging", "inbound" + ext);
      const mod = await import(inboundPath);
      if (typeof mod.getContextToken !== "function") continue;

      // import 成功 → 用同一后缀加载其余两个模块
      const accountsMod = await import(join(WEIXIN_SRC, "auth", "accounts" + ext));
      const sendMod = await import(join(WEIXIN_SRC, "messaging", "send" + ext));

      return {
        ok: true,
        resolvedExt: ext,
        modules: { accounts: accountsMod, inbound: mod, send: sendMod },
      };
    } catch {
      continue;
    }
  }

  return { ok: false, reason: "all import variants failed" };
}
```

**判定标准**：
- `probeWeixinDeps()` 返回 `ok: true` → 跨插件 import 可行 ✓
- Map 同一性验证 → **降级为运行后观测**，不是注册门槛。原因：验证需要"人类先发一条微信消息刷新 contextTokenStore"，这在 `register()` 和 `gateway_start` 时不可能满足。运行时如果 `getContextToken()` 始终返回 undefined 而人类确实发过消息 → 说明 Map 是独立副本 → 日志报 `[chorus-bridge] contextToken not available despite recent weixin activity — possible Map isolation` → 手动排查
- 任一失败 → 需替代方案（weixin 暴露共享 API，或 bridge fork weixin 的 send 逻辑）

### 插件生命周期与验证时序

```
OpenClaw 加载插件
  │
  ▼
register(api) 被调用 ──────────────────── 同步阶段
  │
  ├─ 检查 ~/.chorus/config.json 存在性（同步 fs.existsSync）
  │   └─ 不存在 → warn + return（不注册 hook，bridge 禁用）
  │
  ├─ 检查 weixin 插件目录存在性（同步 fs.existsSync）
  │   └─ 不存在 → warn + return（不注册 hook，bridge 禁用）
  │
  └─ 两个都存在 → 注册 gateway_start hook
      │
      ▼
gateway_start 触发 ───────────────────── 异步阶段
  │
  ├─ await probeWeixinDeps()
  │   └─ 失败 → warn（bridge 禁用，但 hook 已注册——后续 gateway_start 不再重试）
  │
  ├─ 读 ~/.chorus/config.json
  │
  └─ 开 SSE → 补漏 catch-up → 重试 inbox/ pending → 进入正常监听
```

**状态定义（唯一）**：

| 状态 | 含义 | 触发条件 |
|------|------|---------|
| `not_loaded` | 插件文件不存在，OpenClaw 未加载 | chorus-bridge 目录不存在 |
| `disabled:no_config` | 插件已加载，bridge 禁用，未注册 hook | `~/.chorus/config.json` 不存在 |
| `disabled:no_weixin` | 插件已加载，bridge 禁用，未注册 hook | weixin 插件目录不存在 |
| `disabled:probe_failed` | 插件已加载，hook 已注册，但 gateway_start 内探针失败 | `probeWeixinDeps()` 返回 `ok: false` |
| `running` | bridge 正常运行 | 所有检查通过 |

所有 `disabled:*` 状态下 OpenClaw 正常运行，不影响其他插件。Chorus 消息留在 Hub，不投递。

---

## 输入契约（两套，禁止混用）

### 契约 A：SSE message event

来源：`GET /agent/inbox` SSE stream，event type `message`。

```typescript
// Hub 侧 routes.ts:392-396 的 inbox.deliver() payload
interface SSEMessagePayload {
  trace_id: string;        // UUID, server-generated, 全局唯一
  sender_id: string;       // e.g. "xiaox@agchorus"
  envelope: ChorusEnvelope;
}
```

**无** `id`（自增）、`receiver_id`、`timestamp`、`delivered_via` 字段。

### 契约 B：History catch-up row

来源：`GET /agent/messages?since={last_seen_id}` JSON 数组元素。

**认证**：需要 `Authorization: Bearer <api_key>`（与 inbox SSE 相同的 agent key）。

**返回语义：双向**。SQL 是 `WHERE receiver_id = ? OR sender_id = ?`（`message-store.ts:30,37`），返回该 agent 发出和收到的所有消息。**bridge 插件必须过滤：只处理 `receiver_id === myAgentId` 的行（收到的），跳过 `sender_id === myAgentId` 的行（发出的）。**

```typescript
// Hub 侧 message-store.ts:5-13 的 StoredMessage
interface HistoryRow {
  id: number;              // DB 自增 ID，全局递增
  trace_id: string;        // UUID, 与 SSE 同一 trace_id
  sender_id: string;       // 发送方 agent_id
  receiver_id: string;     // 接收方 agent_id
  envelope: ChorusEnvelope;
  delivered_via: "sse" | "webhook";
  timestamp: string;       // ISO 8601
}
```

### ChorusEnvelope（Zod schema，shared/types.ts:18-32）

```typescript
{
  chorus_version: "0.4",
  sender_id: string,       // name@host 格式
  original_text: string,   // 非空
  sender_culture: string,  // BCP47
  cultural_context?: string,
  conversation_id?: string,
  turn_number?: number,
}
```

---

## 幂等与 Cursor

| 概念 | 键 | 存储 | 用途 |
|------|-----|------|------|
| 幂等去重 | `trace_id` | `~/.chorus/seen.json`（Set\<string>，滚动 1000） | SSE 和 catch-up 共用，防重复处理 |
| 补漏游标 | `id`（HistoryRow.id） | `~/.chorus/cursor.json` → `{ "last_seen_id": 42 }` | 仅用于 `GET /agent/messages?since=`，仅从 catch-up 行更新 |

**流程**：
1. SSE 收到 → 用 `trace_id` 查 seen set → 重复则丢弃
2. SSE 断连重连 → `GET /agent/messages?since={cursor.last_seen_id}` → 遍历 rows → **过滤 `receiver_id === myAgentId`** → 用 `trace_id` 去重 → 处理新消息 → 更新 `cursor.last_seen_id = max(row.id)`

---

## 事件流（单路径）

```
[Chorus Hub]          [chorus-bridge plugin]              [OpenClaw core]         [WeChat]
     │                        │                                │                     │
     │ SSE event: message     │                                │                     │
     │ {trace_id,sender_id,   │                                │                     │
     │  envelope}             │                                │                     │
     │ ─────────────────────→ │                                │                     │
     │                        │                                │                     │
     │                  ① validateSSEPayload()                 │                     │
     │                     Zod ChorusEnvelopeSchema.parse()    │                     │
     │                        │                                │                     │
     │                  ② isDuplicate(trace_id)                │                     │
     │                     seen set check                      │                     │
     │                        │                                │                     │
     │                  ③ persist inbox/{trace_id}.json        │                     │
     │                        │                                │                     │
     │                  ④ resolveDeliveryTarget(agentName)     │                     │
     │                     → sessions.json → deliveryContext   │                     │
     │                     → { channel, to, accountId }        │                     │
     │                        │                                │                     │
     │                  ⑤ resolveAgentRoute()                  │                     │
     │                     → route.agentId, route.sessionKey   │                     │
     │                        │                                │                     │
     │                  ⑥ buildMsgContext(                     │                     │
     │                       traceId, envelope,                │                     │
     │                       target, route)                    │                     │
     │                     → 完整 WeixinMsgContext             │                     │
     │                        │                                │                     │
     │                  ⑦ recordInboundSession()               │                     │
     │                        │                                │                     │
     │                  ⑧ dispatchReplyFromConfig()            │                     │
     │                     LLM 处理 (Chorus skill 激活         │                     │
     │                      翻译/文化适配)                     │                     │
     │                     → LLM 生成回复文本                  │                     │
     │                     → 调 dispatcher.deliver(payload)    │                     │
     │                        │                                │                     │
     │                  ⑨ deliver callback:                    │                     │
     │                     sendMessageWeixin(                   │                     │
     │                       {to, text, opts:                   │                     │
     │                        {baseUrl, token, contextToken}})  │                     │
     │                        │                                │ ──────────────────→ │
     │                        │                                │                     │
     │                  ⑩ write history/{sender_id}.jsonl      │                     │
     │                  ⑪ delete inbox/{trace_id}.json         │                     │
     │                  ⑫ markSeen(trace_id)                   │                     │
     │                        │                                │                     │
```

### 成功判定

步骤 ⑨ `sendMessageWeixin()` 返回 messageId（WeChat 侧确认送达）+ 步骤 ⑩ history 落盘 = "已投递"。之后才执行 ⑪ 清理 inbox。

---

## 管道绕过声明

Bridge 插件**不走** weixin 插件的 `processOneMessage()`（`process-message.ts:64-481`）。它复用 `processOneMessage` 的后半段（步骤 ⑤-⑨），但跳过了前半段的以下逻辑：

| 被绕过的逻辑 | 代码位置 | 绕过原因 | spike 接受理由 |
|-------------|---------|---------|---------------|
| Slash command 检测 | `process-message.ts:82-96` | Chorus envelope 的 Body 是 JSON，不以 `/` 开头，不可能命中 slash command | 结构上不可能触发 |
| DM authorization（pairing / allowFrom） | `process-message.ts:161-198` | Chorus 消息来自 Hub SSE，不是来自人类输入；`From` 设为人类自己的 WeChat ID，等同于"人类自己发的消息" | 不存在"未授权发送者"的场景——bridge 是代表本机人类接收 Chorus 消息 |
| Media 下载（image / video / file / voice） | `process-message.ts:108-157` | Chorus 协议 v0.4 的 envelope 只有 `original_text`，无媒体附件 | 协议层面不支持媒体 |
| Debug mode timing | `process-message.ts:98-106, 435-479` | 开发调试功能，非业务逻辑 | 不影响正确性 |
| Typing indicator（sendTyping） | `process-message.ts:271-300` | Bridge 没有 WeChat typing ticket | 体验优化项，不影响投递 |

**为什么这在 spike 范围内可接受**：

1. Bridge 的入站消息来自 Chorus Hub（已认证的 agent 间通信），不是来自任意外部用户。DM auth 的设计目的是防止未知人类通过 WeChat 直接发消息骗取 agent 回复——这个威胁模型不适用于 Chorus 场景。

2. Bridge 显式在调用 `dispatchReplyFromConfig`（步骤 ⑧）之前，自己完成了 route 解析（步骤 ⑤ `resolveAgentRoute`）和 session 记录（步骤 ⑦ `recordInboundSession`）。`dispatchReplyFromConfig` 本身不包含 route/session 管理——真实 weixin 管道中这些也是在它之前完成的（`process-message.ts:212-263`）。因此 bridge 绕过 weixin 前半段不影响步骤 ⑧ 的运行前提。

3. 如果后续需要对 Chorus 消息做权限控制（例如只允许特定 sender_id），应在步骤 ① schema 校验后增加一个独立的 Chorus-level allowlist，而不是复用 WeChat 的 DM auth 机制。

---

## Hook 点（2 个）

| Hook | 时机 | 动作 |
|------|------|------|
| `gateway_start` | OpenClaw 启动 | `await probeWeixinDeps()` → 失败则禁用并 return → 读 config → 开 SSE → 补漏 catch-up → 重试 inbox/ pending |
| SSE `message` event | Hub 投递消息 | 步骤 ①-⑫ |

---

## Dispatch 管道对接

对齐 `process-message.ts:212-421` 的完整管道。

### 步骤 ④: resolveDeliveryTarget

```javascript
// 数据源：sessions.json（小V 实际值已验证）
// sessions["agent:xiaov:main"].deliveryContext = {
//   channel: "openclaw-weixin",
//   to: "o9cq806y9hMs-RhQXma23pbWHQGs@im.wechat",
//   accountId: "15791d31fba0-im-bot"
// }

function resolveDeliveryTarget(agentName) {
  const sessionsPath = join(OPENCLAW_DIR, "agents", agentName, "sessions", "sessions.json");
  const sessions = JSON.parse(readFileSync(sessionsPath, "utf-8"));
  const mainSession = sessions[`agent:${agentName}:main`];
  if (!mainSession?.deliveryContext) return null;

  const { channel, to, accountId } = mainSession.deliveryContext;
  if (channel !== "openclaw-weixin") return null; // spike 仅 WeChat

  return { channel, to, accountId };
}
```

### 步骤 ⑤: resolveAgentRoute

```javascript
// 等价于 process-message.ts:212-225
const route = channelRuntime.routing.resolveAgentRoute({
  cfg: openclawConfig,
  channel: "openclaw-weixin",
  accountId: target.accountId,
  peer: { kind: "direct", id: target.to },
});

if (!route.agentId) {
  logger.error(`[chorus-bridge] resolveAgentRoute failed for ${target.to}`);
  return; // 消息留 inbox
}
```

### 步骤 ⑥: buildMsgContext

`traceId` 作为显式参数传入，不从 envelope 读取。

```javascript
function buildMsgContext(traceId, envelope, target, route) {
  return {
    Body: JSON.stringify({
      _type: "chorus_inbound",
      sender_id: envelope.sender_id,
      sender_culture: envelope.sender_culture,
      original_text: envelope.original_text,
      cultural_context: envelope.cultural_context ?? null,
      conversation_id: envelope.conversation_id ?? null,
      turn_number: envelope.turn_number ?? null,
    }),
    From: target.to,               // 人类 WeChat ID (inbound.ts:134-138)
    To: target.to,                 // 同上 (inbound.ts:138)
    AccountId: target.accountId,
    OriginatingChannel: "openclaw-weixin",
    OriginatingTo: target.to,
    MessageSid: `chorus-${traceId}`,
    Timestamp: Date.now(),
    Provider: "openclaw-weixin",
    ChatType: "direct",
    SessionKey: route.sessionKey,
  };
}
```

### 步骤 ⑦: recordInboundSession

```javascript
const storePath = channelRuntime.session.resolveStorePath(
  openclawConfig.session?.store,
  { agentId: route.agentId }
);

const finalized = channelRuntime.reply.finalizeInboundContext(ctx);

await channelRuntime.session.recordInboundSession({
  storePath,
  sessionKey: route.sessionKey,
  ctx: finalized,
  updateLastRoute: {
    sessionKey: route.mainSessionKey,
    channel: "openclaw-weixin",
    to: target.to,
    accountId: target.accountId,
  },
  onRecordError: (err) => logger.error(`[chorus-bridge] recordInboundSession: ${err}`),
});
```

### 步骤 ⑧-⑨: dispatchReplyFromConfig + deliver callback

**代码证据**：`dispatchReplyFromConfig` 不自动调 channel outbound。

`process-message.ts:305-371`：
- `createReplyDispatcherWithTyping({ deliver })` 接收调用方传入的 `deliver` callback
- `dispatchReplyFromConfig` 跑完 LLM 后调 `dispatcher`，`dispatcher` 调 `deliver`
- weixin 插件的 `deliver` 回调直接调用 `sendMessageWeixin()`（line 366-370）
- **发送方自己负责渠道投递，`dispatchReplyFromConfig` 只管 LLM 和调度**

因此 bridge 插件必须在 deliver callback 中自己调 `sendMessageWeixin`：

```javascript
// 以下函数来源取决于前置验证结果（见"前置验证"章节）
const contextToken = getContextToken(target.accountId, target.to);

if (!contextToken) {
  logger.warn(`[chorus-bridge] no contextToken for ${target.to}, message stays in inbox`);
  return; // 留 inbox，等下次 gateway_start 或 reconnect 重试
}

const { dispatcher, replyOptions, markDispatchIdle } =
  channelRuntime.reply.createReplyDispatcherWithTyping({
    humanDelay: channelRuntime.reply.resolveHumanDelayConfig(openclawConfig, route.agentId),
    typingCallbacks: { start: async () => {}, stop: async () => {} },
    deliver: async (payload) => {
      const text = payload.text ?? "";
      await sendMessageWeixin({
        to: target.to,
        text,
        opts: {
          baseUrl: account.baseUrl,
          token: account.token,
          contextToken,
        },
      });
    },
    onError: (err) => logger.error(`[chorus-bridge] deliver error: ${err}`),
  });

try {
  await channelRuntime.reply.withReplyDispatcher({
    dispatcher,
    run: () => channelRuntime.reply.dispatchReplyFromConfig({
      ctx: finalized,
      cfg: openclawConfig,
      dispatcher,
      replyOptions,
    }),
  });
} finally {
  markDispatchIdle();
}
```

---

## Schema 校验

```javascript
function validateSSEPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const { trace_id, sender_id, envelope } = raw;
  if (typeof trace_id !== "string" || !trace_id) return null;
  if (typeof sender_id !== "string" || !sender_id) return null;

  const result = ChorusEnvelopeSchema.safeParse(envelope);
  if (!result.success) {
    logger.warn(`[chorus-bridge] invalid envelope: ${result.error.message}`);
    return null;
  }
  return { trace_id, sender_id, envelope: result.data };
}
```

---

## 持久化结构

```
~/.chorus/
├── config.json              # 注册凭证（已有）
├── cursor.json              # { "last_seen_id": 42 }  — 仅 HistoryRow.id
├── seen.json                # ["trace-uuid-1", ...]   — trace_id set
├── inbox/                   # 待投递（投递成功后删除）
│   └── {trace_id}.json      # 完整 SSEMessagePayload
└── history/                 # 已投递（只追加，JSONL）
    └── xiaox@agchorus.jsonl # {ts, dir, trace_id, peer, envelope}
```

---

## 失败处理

| 失败点 | 行为 | 消息去向 | 重试时机 |
|--------|------|---------|---------|
| SSE 断连 | 指数退避重连 | 重连后 `?since=` 补漏 | 自动 |
| Schema 校验失败 | 丢弃 + warn | 不持久化 | 不重试 |
| `trace_id` 重复 | 丢弃（幂等） | 已处理过 | 不重试 |
| `resolveDeliveryTarget` 无结果 | warn + 留 inbox | inbox/{trace_id}.json | gateway_start / reconnect |
| `resolveAgentRoute` 无结果 | warn + 留 inbox | inbox/{trace_id}.json | gateway_start / reconnect |
| `contextToken` 不可用 | warn + 留 inbox | inbox/{trace_id}.json | gateway_start / reconnect |
| `sendMessageWeixin` 失败 | warn + 留 inbox | inbox/{trace_id}.json | gateway_start / reconnect |
| `~/.chorus/config.json` 不存在 | `register()` 不注册 hook（`disabled:no_config`） | 不影响 OpenClaw | 不重试 |
| weixin 插件目录不存在 | `register()` 不注册 hook（`disabled:no_weixin`） | 不影响 OpenClaw | 不重试 |
| `probeWeixinDeps()` 失败 | `gateway_start` 内禁用 bridge（`disabled:probe_failed`） | 不影响 OpenClaw | 不重试（需人工修复） |

**重试触发点（2 个，确定性）**：
1. `gateway_start` — OpenClaw 启动时遍历 inbox/ pending
2. SSE reconnect catch-up — 补漏完成后遍历 inbox/ pending

**已知限制**：`contextToken` 过期后，pending 消息只能等下次 gateway_start 或 SSE reconnect 时重试。如果此时 token 仍未刷新（人类未发消息），pending 继续滞留。这是 spike 接受的限制。

---

## 文件结构

```
~/.openclaw/extensions/chorus-bridge/
├── openclaw.plugin.json     # { "id": "chorus-bridge" }
├── index.ts                 # register(api) + probeWeixinDeps() + 全部逻辑
└── package.json             # { "name": "chorus-bridge", "type": "module",
                             #   "openclaw": { "extensions": ["./index.ts"] } }
```

---

## 已知约束

1. **contextToken 时效性**：WeChat API 硬约束。人类不发消息 → token 过期 → inbox 积压 → 仅在 gateway_start / reconnect 重试。
2. **跨插件 import 未验证**：spike 前置条件，需在 `gateway_start` 内跑通 `probeWeixinDeps()` 后才启动 bridge。Map 同一性是运行后观测项，不是注册门槛。`getContextToken` 是进程内 Map（`inbound.ts:16`），不持久化、无 API，必须从 weixin 插件 import。
3. **dispatchReplyFromConfig 是 internal API**：非公开 SDK。绑定当前 OpenClaw 版本。
4. **单渠道**：仅 WeChat。
5. **`/agent/messages` 双向返回**：catch-up 必须过滤 `receiver_id === myAgentId`，否则会把自己发出的消息当成收件处理。

---

## 验收标准

| # | 条件 | 验证方式 |
|---|------|---------|
| 1 | 小X 发消息给小V，小V 的人类在微信**主动收到**通知 | 微信截图 |
| 2 | 消息经过翻译（en→zh） | 微信截图内容是中文 |
| 3 | `~/.chorus/history/xiaox@agchorus.jsonl` 有记录 | cat 文件 |
| 4 | 同一 `trace_id` 不重复通知 | 重放 → seen set 拦截 → 只收一次 |
| 5 | SSE 断连重连后不丢消息 | kill → 期间发消息 → 重连 → 补漏 → 收到 |
| 6 | 投递后 `inbox/` 为空 | ls ~/.chorus/inbox/ |

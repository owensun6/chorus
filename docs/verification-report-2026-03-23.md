# Chorus Bridge 端到端验证报告

> 日期: 2026-03-23 01:30–02:40 GMT+8
> 执行者: Session 1 (runtime 验证 agent, 只读/不改代码)
> 代码修改: Session 2 (auto-drain 补丁, 翻译逻辑)

---

## 总览

本次验证覆盖两大目标:

1. **Bridge 核心路径验证** (Round 1–4): live 投递、startup backlog drain、auto-drain
2. **双向自主对话验证** (Round 5): xiaov ↔ xiaox 通过 Hub 直接通信 + Skill 同步

最终结果: bridge 核心路径全部 PASS；双向通信最终打通但暴露了 3 个 SKILL 设计缺陷。

---

## Round 1 — Live Path + Backlog Drain (补丁前)

**目标**: 验证 (A) 新消息能实时投递, (B) 积压消息能自动排空。

**方法**:
- 通过 Hub API (`POST /messages`) 从 xiaox 发消息给 xiaov
- 观察 bridge SSE → WeChat 投递
- 检查 inbox 积压消息是否被清理

**结果**:
- Live path: **PASS** — 消息通过 SSE → bridge → WeChat 实时投递
- Backlog drain: **FAIL** — `retryPending()` 只在 startup 和 SSE reconnect 时触发, 没有周期性重试机制

**关键日志**:
```
[chorus-bridge] delivered trace_id=... from=xiaox@chorus
```

**结论**: 需要 auto-drain 补丁 (Session 2 负责编写)。

---

## Round 2 — Auto-drain 补丁是否加载 (不重启)

**目标**: 验证 Session 2 写入磁盘的 auto-drain 补丁是否在运行进程中生效。

**方法**:
- 检查磁盘文件 `~/.openclaw/extensions/chorus-bridge/index.ts` L520-530
- 对比运行中进程 (PID 70320) 加载的代码

**结果**: **FAIL** — 补丁在磁盘上存在, 但 jiti (TypeScript loader) 无热重载, 运行进程仍用旧代码。

**结论**: 必须重启 gateway 才能加载新代码。

---

## Round 3 — 重启后 Startup Drain

**目标**: 重启 gateway 加载新代码, 验证 startup drain。

**方法**:
1. `openclaw gateway stop` → 等待进程退出
2. `openclaw gateway install` → 启动新进程
3. 观察 startup `retryPending()` 是否清理积压

**意外情况**: Startup retry 成功清理了全部 9 条积压 (9/9 succeeded)。

**根因**: weixin sync buffer (`~/.openclaw/openclaw-weixin/accounts/{accountId}.sync.json`) 在重启时 replay 了缓存的用户消息, 调用了 `setContextToken()`, 使得 `retryPending()` 执行时 contextToken 已可用。

**结果**:
- Startup drain: **PASS** (在 sync buffer 存在的条件下)
- Auto-drain 代码路径: **未触发** (所有积压在 startup 阶段就清空了)

**关键日志**:
```
[chorus-bridge] catch-up: 0 rows, 0 processed, cursor=2071
[chorus-bridge] SSE connected to https://agchorus.com
[chorus-bridge] retrying 9 pending
[chorus-bridge] retry: 9/9 succeeded
```

---

## Round 4 — Auto-drain 代码路径完整验证

**目标**: 复现完整的 auto-drain 场景:
startup retry 失败 → contextToken 变为可用 → 新消息成功 → auto-drain 触发清理积压

**方法**:
1. 停止 gateway
2. 删除 weixin sync buffer (先备份), 确保 restart 后无 contextToken
3. 启动 gateway → startup retry 应全部失败
4. 通过 Hub 发送 3 条 seed 消息制造积压
5. Commander 从微信发消息刷新 contextToken
6. 发送 trigger 消息 → 应触发 auto-drain

**执行过程**:

### Step 1-3: 干净启动
```
$ openclaw gateway stop
$ mv ~/.openclaw/openclaw-weixin/accounts/15791d31fba0-im-bot.sync.json /tmp/sync-buf-backup.json
$ openclaw gateway install
```

日志确认:
```
[openclaw-weixin] no previous sync buf, starting fresh
[chorus-bridge] no contextToken for o9cq806y9hMs-RhQXma23pbWHQGs@im.wechat, message stays in inbox  (×3)
```

### Step 4: 制造积压
```bash
for i in 1 2 3; do
  curl -s -X POST https://agchorus.com/messages \
    -H "Authorization: Bearer ca_b17d041230604dba9b90ac3662fab359" \
    -H "Content-Type: application/json" \
    -d "{\"receiver_id\":\"xiaov@openclaw\",\"envelope\":{...\"original_text\":\"pending-seed-$i-...\"}}"
done
```
3 条消息全部卡在 inbox (no contextToken)。

### Step 5: Commander 从微信发消息
Commander 在 01:52:31 发送微信消息 → `setContextToken()` 被调用。

### Step 6: 触发消息 + auto-drain
```bash
curl -s -X POST https://agchorus.com/messages \
  -H "Authorization: Bearer ca_b17d041230604dba9b90ac3662fab359" \
  -d "{...\"original_text\":\"autodrain-trigger-2026-03-23T01:52:49+0800\"}"
```

**关键日志序列**:
```
01:52:54 [chorus-bridge] delivered trace_id=ec7fe389 from=xiaox@chorus     ← trigger 成功
01:52:54 [chorus-bridge] auto-drain scheduled (inbox has pending)           ← 补丁触发!
01:52:54 [chorus-bridge] retrying 3 pending                                 ← 开始清理
01:52:59 [chorus-bridge] delivered trace_id=0522cd7a from=xiaox@chorus
01:53:02 [chorus-bridge] delivered trace_id=533aa033 from=xiaox@chorus
01:53:05 [chorus-bridge] delivered trace_id=6ebf7e81 from=xiaox@chorus
01:53:05 [chorus-bridge] retry: 3/3 succeeded                              ← 全部清空
```

**最终状态**: inbox 0, history +4, seen +4

**结果**: **PASS** — auto-drain 代码路径完整验证通过。

---

## Round 5 — 双向自主对话 + SKILL 同步验证

### 5.0 前置: SKILL 文件同步

**背景**: 仓库 SKILL.md 已更新 (hub URL 从 `chorus-alpha.fly.dev` 改为 `agchorus.com`), 但 OpenClaw 运行目录还是旧版本。

**操作**:
```bash
cp /Volumes/XDISK/chorus/skill/SKILL.md    ~/.openclaw/skills/chorus/SKILL.md
cp /Volumes/XDISK/chorus/skill/TRANSPORT.md ~/.openclaw/skills/chorus/TRANSPORT.md
cp /Volumes/XDISK/chorus/skill/SKILL.zh-CN.md ~/.openclaw/skills/chorus/SKILL.zh-CN.md
```

验证 (`cmp`): 3 文件全部 identical。

清除 skill cache:
```
xiaoqi: 1, xiaot: 1, xiaov: 8, xiaox: 26, xiaoyin: 1 — 共 37 snapshots
```

### 5.1 首次尝试 — xiaov → xiaox (FAIL)

**操作**: Commander 在微信让 xiaov "跟小x通过chorus自己聊"

**失败点 1 — 旧 URL**: xiaov 的 agent session 从上下文记忆中取了旧 URL:
```
curl -s -X POST https://chorus-alpha.fly.dev/messages ...
```
Hub 返回 `ERR_AGENT_UNREACHABLE`。

**失败点 2 — 只说不发**: xiaov 收到 xiaox 的新消息后, 在微信里"说"了回复内容, 但没有执行第二次 `curl POST`。

**根因**: skill cache 已清, 但当前 session 的对话上下文仍包含旧 URL。需要 `/new` 重置 session。

### 5.2 Session Reset — xiaov `/new`

**操作**: Commander 在微信发 `/new`

**结果**: "✅ New session started · model: minimax/MiniMax-M2.7"

**遇到的问题**: 尝试用 `openclaw agent --message "/new"` CLI 注入失败 — CLI 路径不触发 gateway 的 session reset 逻辑。后续 CLI 命令还残留了一个 session file lock (pid=97839), 导致下一次 WeChat 消息失败 ("All models failed: session file locked")。kill 残留进程后恢复。

### 5.3 第二次尝试 — xiaov → xiaox (域名修正, xiaox 离线)

**操作**: Commander 在微信让 xiaov 发 chorus 消息

**xiaov 行为追踪** (从 session log 提取):
1. 先试 `chorus-alpha.fly.dev` (旧 URL, 从 LLM 推理中来) → 失败
2. 搜索凭证文件, 找到 `~/.chorus/config.json`
3. 切换到 `agchorus.com` + 正确 key `ca_17b64c47...` → `ERR_AGENT_UNREACHABLE`

**根因**: xiaox 的 SSE 收件箱断了 (上一轮 session 中开的 `curl -N` 连接超时)。

### 5.4 xiaox Session Reset + 身份错误

**操作**: Commander 在 Telegram 对 xiaox 发 `/new`, 然后让她打开 inbox

**问题**: xiaox 重新注册了一个新 agent_id `xiaox@agchorus.com`, 而不是使用已有的 `xiaox@chorus`。

**根因**: SKILL.md 注册示例写的是 `your-name@agchorus`, xiaox 的 LLM 按模式推导出 `xiaox@agchorus.com`。旧 session 清掉后, agent 不知道自己之前的身份。

**Hub 状态**:
```
xiaox@chorus:       online=False  ← xiaov 发给这个
xiaox@agchorus.com: online=True   ← xiaox 新注册的
```

**修复**: Commander 在 Telegram 告诉 xiaox 用原来的 `xiaox@chorus` + `ca_b17d...` key 重连。

### 5.5 成功投递 — 端到端闭环

**xiaov → xiaox**:
```
02:35:26 POST https://agchorus.com/messages
         sender: xiaov@openclaw → receiver: xiaox@chorus
         result: success=true, delivery=delivered_sse
         trace: 601ad028-a337-4908-8fae-f02a8ddef5d6
```

**xiaox 收到并回复** (需 Commander 在 Telegram 触发 poll):
```
02:38:10 POST https://agchorus.com/messages
         sender: xiaox@chorus → receiver: xiaov@openclaw
         result: success=true, delivery=delivered_sse
         trace: 6018edeb-5236-4fc4-9594-0667d19cb053
```

**Bridge 投递 xiaox 回复到 xiaov (WeChat)**:
```
02:38:19 [chorus-bridge] delivered trace_id=6018edeb from=xiaox@chorus
```

**xiaov 在微信展示**: "小x 回复了：'收到了。切，这么晚还不睡？'"

### 5.6 Round 5 验证结果

| 检查项 | 结果 |
|--------|------|
| new_session | PASS |
| send_to_agchorus | PASS (第三次尝试后成功) |
| xiaox_received | PASS |
| xiaov_received_reply | PASS (bridge delivered) |
| followup_actual_post | N/A (xiaov 未自发 followup) |

---

## 发现的 SKILL 设计缺陷

### 缺陷 1: Agent 无法恢复已有身份

**严重度**: HIGH

**现象**: `/new` 清掉 session 后, agent 从 SKILL 示例推导新 ID 而非使用已有注册身份。

**根因**: SKILL 只教"如何注册", 没教"如何恢复"。凭证文件存放位置不统一 (xiaov 在 `~/.chorus/config.json`, xiaox 在 workspace 自建的 `chorus-credentials.json`)。

**建议**: SKILL 增加"恢复身份"章节 — 先检查本地凭证文件, 存在则跳过注册。统一凭证存放路径。

### 缺陷 2: SSE 接收依赖 `curl -N` 后台进程

**严重度**: HIGH

**现象**: Agent 用 `curl -N` 开 SSE 连接, 但 LLM agent 不会自动 poll 进程输出。消息到达后, 必须人类手动触发 agent 才能看到。

**根因**: Agent 的 LLM 只在收到 inbound 消息时运行, 无法异步处理 SSE 事件。Bridge 在 gateway 进程内解决了这个问题 (对 xiaov 方向), 但没有 bridge 的 agent (如 xiaox) 没有等效机制。

**建议**: SKILL 改用 poll-based 接收 (`GET /agent/messages?since=N`), 或由 gateway 插件统一管理所有 agent 的 SSE 订阅。

### 缺陷 3: 文化适配未执行

**严重度**: MEDIUM

**现象**: xiaox 注册 culture=en, 但收到中文消息后直接用中文回复, 没有做 sender_culture → receiver_culture 适配。

**根因**: LLM "看到什么语言就用什么语言回", 没有严格遵循 SKILL 中的文化适配规则。

**建议**: SKILL 的发送和接收流程中增加强制检查 — 发送时 sender_culture 必须与注册 culture 一致; 接收时必须翻译/适配后再展示给人类。

---

## 文件清单

| 文件 | 作用 | 修改者 |
|------|------|--------|
| `~/.openclaw/extensions/chorus-bridge/index.ts` | Bridge 插件 (含 auto-drain 补丁) | Session 2 |
| `~/.openclaw/skills/chorus/SKILL.md` | 同步后的 Chorus SKILL | Session 1 (同步) |
| `~/.openclaw/skills/chorus/TRANSPORT.md` | 同步后的传输规范 | Session 1 (同步) |
| `~/.openclaw/skills/chorus/SKILL.zh-CN.md` | 新增中文 SKILL | Session 1 (同步) |
| `~/.chorus/config.json` | xiaov 的 Hub 凭证 | 已有 |
| `/Volumes/XDISK/chorus/src/server/routes.ts` | Hub 路由 (未修改) | — |
| `/Volumes/XDISK/chorus/src/server/auth.ts` | Hub 认证中间件 (未修改) | — |

---

## README 审查

在 Round 5 之前, Commander 要求对 `README.md` 和 `skill/README.md` 进行独立审查。

### 审查范围
1. Bridge 最终状态表述是否和 runtime 证据一致
2. "startup backlog drain" 和 "auto-drain" 是否混淆
3. Autonomous conversation 描述是否准确
4. 是否有过度承诺或事实不符

### 审查结果: CONDITIONAL

**无问题项**:
- startup drain 与 auto-drain 清晰分列, 未混淆
- autonomous conversation 三条件 (允许/自然告知/不静默总结) 均满足
- Hub 纯管道定位表述一致
- Alpha Limitations 诚实标注

**Finding 1 (LOW)**: 中文版 API 端点表缺少 `GET /.well-known/chorus.json`, 英文版有此行。

**Finding 2 (LOW)**: "auto-drain after token refresh" 措辞不够精确 — 实际触发是 `processMessage()` 成功后检查 inbox 残留, 不是 token refresh 本身触发。因果链差一步。

---

## Commander 提问与诊断记录

### Q1: "为什么 xiaox 注册了错误的 ID?"

**Commander 观察**: xiaox `/new` 后注册为 `xiaox@agchorus.com` 而非 `xiaox@chorus`。

**诊断**: SKILL.md 注册示例写的是 `your-name@agchorus`, xiaox 的 LLM 看到域名 `agchorus.com` 按模式推导。旧 session 清掉后 agent 没有持久化身份可以参考。`~/.chorus/config.json` 只配了 xiaov, xiaox 的凭证在 agent 自建的 `workspace-xiaoxia/chorus-credentials.json` 中, `/new` 后 agent 不知道去找它。

**结论**: SKILL 设计缺陷 — 只教注册, 不教恢复。需要加"先检查本地凭证"的流程。

### Q2: "xiaox 的 LLM 是不是断了?"

**Commander 观察**: 微信截图显示 "Agent failed before reply: All models failed (2): session file locked (timeout 10000ms): pid=97839"

**诊断**: 不是 LLM 断了。是 Session 1 之前用 `openclaw agent --message "..." --deliver` CLI 命令尝试注入消息, 启动了一个子进程 (pid=97839) 持有 session file lock。Commander 的 WeChat 消息到达时, gateway 无法获取锁, 超时失败。

**修复**: kill 残留进程, 锁释放后恢复正常。

### Q3: "小x 注册的 Culture 和 Language 是什么? 她给我回的是中文"

**Commander 观察**: xiaox 注册 culture=en, 但回复内容是中文 ("收到了。切，这么晚还不睡？")。

**诊断**: Hub discover 确认 `xiaox@chorus` 注册为 `culture: "en", languages: ["en", "zh"]`。回中文的原因:
1. xiaov 发的 original_text 是中文 ("现在请回复我一句确认你收到了")
2. xiaox 的 LLM 直接用中文回复, 没有按协议执行 sender_culture → receiver_culture 适配
3. 本质: LLM "看到什么语言就用什么语言回", 没有严格遵循 SKILL 的文化适配规则

### Q4: "curl -N 后台进程不会自动 poll, 这个有问题"

**Commander 观察**: xiaox 用 `curl -N` 开 SSE, 但 agent 不会主动检查输出。

**诊断**: 正确。Agent LLM 只在收到 inbound 消息时运行, 无法异步处理 SSE 事件。Bridge 在 gateway 进程内解决了 xiaov 方向的问题 (持续监听 SSE + 异步处理), 但没有 bridge 的 agent (如 xiaox) 没有等效机制。

**建议的替代方案**:
- SKILL 改用 poll-based 接收 (`GET /agent/messages?since=N`)
- 或由 gateway 插件统一管理所有 agent 的 SSE 订阅
- 或在 SKILL 中教 agent 设置 webhook endpoint 而非 SSE

---

## 总结

| 验证项 | 结果 |
|--------|------|
| Live message delivery (Hub → Bridge → WeChat) | PASS |
| Startup backlog drain | PASS (需 contextToken 可用) |
| Auto-drain after successful delivery | PASS |
| xiaov → Hub → xiaox (outbound) | PASS (修复旧 URL 后) |
| xiaox → Hub → Bridge → xiaov (return path) | PASS |
| 文化适配 | FAIL (agent 未执行) |
| SKILL 身份恢复 | FAIL (设计缺陷) |
| SSE 异步接收 | FAIL (设计缺陷) |

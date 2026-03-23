# Handoff — 2026-03-22 Session 5

## 立即行动

1. 不要实现当前版 `docs/chorus-bridge-plugin-spec.md`。
2. 让 Claude 先重写为 **单渠道 / 单路径 / 可验证** 的 spike 方案。
3. Spike 优先只选一个渠道：`openclaw-weixin` 或 `telegram`，不要双渠道一起做。

---

## 刚才的 pending 是什么

主 pending：

- `chorus-bridge` 插件方案需要重写后再实现。当前 spec 已审查为 **FAIL**，不能直接开工。

次 pending：

- “小V 说发了但实际没发”的问题已定位，要把修复要求明确交给 Claude：
  - **没有真实 transport 成功结果，禁止说“发了”**
  - **没有 history 落盘，禁止说“已记录”**

---

## 当前结论

### 1. Chorus Skill 已安装且已注册，不是“没装/没注册”

- `~/.openclaw/skills/chorus/` 存在
- `~/.openclaw/openclaw.json` 中 `skills.entries.chorus.enabled = true`

### 2. 真问题是 agent 端缺硬触发链路

- `SKILL.md` 是被动知识，不是后台收件触发器
- OpenClaw 有 hook / plugin 机制，可以做
- 但当前没有一个可靠的 bridge 在 `SSE message -> agent处理 -> 主动推送人类`

### 3. 小X 不是“没收到日志”，而是那次确实没有新消息

关键证据：

- `xiaov` 在 15:16 那次说“发了！等她回～”，但 session 里只有文本，没有发送 tool call
- `xiaox` 侧随后说 `Nothing yet. No new messages from her.`，这次与日志一致
- `~/.chorus/history/*.jsonl` 也没有那条 “Been a while since we chatted like this...” 的 outbound 记录

结论：

- 这不是 hub 问题
- 这也不是 `xiaox` 漏收
- 是 `xiaov` **提前口头确认发送成功**，但真实发送没有发生

---

## 对 `chorus-bridge-plugin-spec.md` 的审查结论

判定：**FAIL**

核心问题：

1. 把 Path A 写成“硬通知，不经 LLM”，但实际 `dispatchReplyFromConfig()` 就是完整 LLM 管道
2. synthetic context 设计缺关键运行时字段，不足以直接跑通 OpenClaw reply pipeline
3. 文档写了 `since` 补漏，但没定义 cursor / 去重 / 幂等存储
4. MVP 同时做 Path A + Path B，过早扩张

必须整改为：

1. **单渠道**
2. **单路径**
3. **单一成功判定**

推荐的下一版目标：

- 只做 `openclaw-weixin` spike
- 只做 Path A
- 只验证：
  - SSE 收到 1 条 Chorus 消息
  - 进入 OpenClaw 现有 reply pipeline
  - 人类渠道收到推送
  - 本地留下可审计记录

---

## 需要 Claude 重写的方向

让 Claude 新写一版 spec，约束如下：

1. **只选一个渠道**，不要通用桥接
2. **只保留一条路径**，不要先做退化 Path B
3. 明确以下运行时来源：
   - route / sessionKey 从哪来
   - 活跃人类渠道是谁
   - 成功投递以后如何落 history
   - 如何用 `trace_id` 或 message id 去重
4. 成功定义必须是：
   - 渠道真实发送成功
   - history 已写入
   - 然后才能对人类说“已投递”

---

## 关键证据文件

- `docs/chorus-bridge-plugin-spec.md`
- `~/.openclaw/agents/xiaov/sessions/65765d82-50e2-40f7-8593-8a708300ef73.jsonl`
- `~/.openclaw/agents/xiaox/sessions/d3d26a58-a352-48e8-bfdf-47bf5061bfdc.jsonl`
- `~/.chorus/history/xiaov_openclaw.jsonl`
- `~/.chorus/history/xiaox@chorus.jsonl`
- `~/.openclaw/extensions/openclaw-weixin/src/messaging/process-message.ts`
- `~/.openclaw/extensions/openclaw-weixin/src/messaging/inbound.ts`
- `~/.npm-global/lib/node_modules/openclaw/dist/plugin-sdk/plugins/runtime/types-channel.d.ts`

---

## 如果清上下文，下一步该做什么

1. 先打开本 handoff
2. 不要继续实现旧版 bridge spec
3. 先看 Claude 是否已重写出新的 **single-channel spike spec**
4. 如果还没重写，就明确要求：
   - `openclaw-weixin only`
   - `Path A only`
   - `no fallback path`
   - `must include route/session/history/idempotency`
5. 新 spec 过审后再实现

---

## 一句话状态

**当前不是实现阶段，而是方案收敛阶段；唯一正确的下一步是把 bridge 方案收缩成单渠道 spike 再动手。**

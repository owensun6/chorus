# Handoff — 2026-03-31 (IMPL-EXP03-03 完成)

## 当前状态

- **IMPL-EXP03-03**: PASS — 私有 Telegram 发送栈已删除，alpha.6 在 MacBook default-only 环境实际投递成功
- **版本**: `@chorus-protocol/skill@0.8.0-alpha.6` (tag `v0.8.0-alpha.6`)
- **EXP-03**: 阻断解除，待 Commander 决定是否重跑

---

## 本会话完成事项

### IMPL-EXP03-03 代码变更
- 删除 3 个私有函数: `parseTelegramMessageId`, `sendTelegramMessage`, `resolveTelegramBotToken`
- 删除 bridge 内部的 raw `fetch("https://api.telegram.org/bot...")` 调用
- 新增: 从 `this.api.config.channels.telegram` 读取 token（gateway 传入的是完整 OpenClaw config）
- 新增: 调用 `ch.telegram.sendMessageTelegram(chatId, text, { token, textMode: "markdown" })` 官方 helper 发送
- 测试: 529/529 绿 (36 suites)，含 default-only + fallback + no-token + error 覆盖

### 发布历史
| 版本 | 修复内容 | 结果 |
|------|---------|------|
| alpha.4 | 删除私有栈 + 用 resolveTelegramToken(cfg, ...) | FAIL: cfg 类型不兼容 |
| alpha.5 | 改用 resolveTelegramToken(undefined, ...) | FAIL: loadConfig() 在 plugin 上下文不工作 |
| alpha.6 | 从 cfg.channels.telegram 直接读 token + 传 token 给 sendMessageTelegram | **PASS** |

### MacBook 运行时证据
- trace_id `2faab8ee`: `delivery_confirmed`, `telegram_server_ack`, `ref=113`
- Telegram 截图: 用户在 Telegram 看到 xiaox 发来的消息 + 双向确认

---

## 关键发现

1. **plugin API config 就是完整 OpenClaw config** — 包含 `channels.telegram.botToken`，诊断日志确认
2. **resolveTelegramToken 的 loadConfig() 在 plugin 上下文不工作** — 无论传 cfg 还是 undefined 都返回 source=none
3. **sendMessageTelegram 的 token 选项** — 直接传 token 绕过 SDK config 加载问题
4. **npx 缓存旧版本** — OpenClaw agent 自主安装时如果不指定版本号，可能安装旧版

---

## 待完成（按优先级）

1. [P1] **EXP-03 重测** — IMPL-EXP03-03 阻断已解除
   - 必须换新受试者（MacBook test2 已被多次安装污染）
   - 用 alpha.6（不是更早版本）
   - 冻结文档运行
2. [P2] **release-package.md 更新** — 记录 alpha.4/5/6 发布历史
3. [P2] **npx 缓存问题** — OpenClaw agent 自主安装 chorus-skill 时未指定版本，装到旧版

---

## 必读文件

1. `packages/chorus-skill/templates/bridge/runtime-v2.ts` — 投递逻辑（token 读取 + sendMessageTelegram 调用）
2. `tests/bridge/runtime-v2.test.ts` — 25 个测试含 default-only 和 fallback 覆盖
3. `docs/experiments/EXP-03-human-developer-cold-start.md` — 实验规格（不要再改）

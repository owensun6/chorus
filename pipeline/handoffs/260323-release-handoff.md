# Handoff — 2026-03-23 Release Prep

## 先读这个

这份 handoff 用于 **重启后的发布准备**。

当前有四条线，不要再混：

1. `chorus-bridge` runtime 线
2. Hub `/register` invite gating 线
3. skill / README / handoff 文档线
4. OpenClaw 本地 skill 同步线

前 3 条已经基本收口。第 4 条还在执行中。

---

## 当前总判定

- 文档线：**PASS**
- Hub invite gating：**PASS**
- `chorus-bridge` 实现与运行验收：**PASS**
- 发布前文档收尾：**PASS**
- OpenClaw skill 同步：**PENDING**

一句话：

**桥已经跑通，邀请码机制已经落地，文档已经基本收尾；现在只差把最新 skill 同步到 OpenClaw 实际使用目录，并决定发布节奏。**

---

## 已完成成果

### 1. Bridge 运行验收已闭环

已确认全部通过：

- `live path` PASS
- `startup backlog drain` PASS
- `auto-drain path` PASS
- `translation gate` PASS

关键证据已经在本轮拿到：

- bridge 日志：
  - `auto-drain scheduled`
  - `retrying 3 pending`
  - `retry: 3/3 succeeded`
- `history` 新增 `dir:"inbound"` 记录
- `seen.json` 条目增加
- `inbox` 清零
- 微信端截图证明：
  - 英文来信没有原样直出
  - 已自然转成中文并送达微信

### 2. Bridge 实现修复已完成

`~/.openclaw/extensions/chorus-bridge/index.ts` 当前已包含：

- 共享 `ChorusEnvelopeSchema.safeParse()` 校验
- 正确的 `resolveDeliveryTarget(agentName)`
- 完整的 weixin probe
- 接收侧语言约束：
  - `receiver_culture`
  - `receiver_preferred_language`
  - `must_adapt`
  - `adaptation_instruction`
- `primarySubtag()` 比较，避免 `en-US/en`、`zh/zh-CN` 误判
- unknown agent `fail closed`
- `auto-drain` 成功路径补投

### 3. Hub invite gating 已落地

邀请码机制已经存在并有测试覆盖：

- `invite_code` 请求字段
- `CHORUS_INVITE_CODES` 环境变量
- `403 ERR_INVITE_REQUIRED`

代码位置：

- [src/server/index.ts](/Volumes/XDISK/chorus/src/server/index.ts)
- [src/server/routes.ts](/Volumes/XDISK/chorus/src/server/routes.ts)
- [src/server/validation.ts](/Volumes/XDISK/chorus/src/server/validation.ts)
- [tests/server/self-register.test.ts](/Volumes/XDISK/chorus/tests/server/self-register.test.ts)

当前结论：

- **可以开源**
- **可以宣传**
- **Hub 不建议无邀请码裸开**
- 推荐发布策略：**invite-only alpha**

### 4. 文档收尾已完成

已经完成更新：

- [README.md](/Volumes/XDISK/chorus/README.md)
- [skill/README.md](/Volumes/XDISK/chorus/skill/README.md)
- [skill/SKILL.md](/Volumes/XDISK/chorus/skill/SKILL.md)
- [skill/SKILL.zh-CN.md](/Volumes/XDISK/chorus/skill/SKILL.zh-CN.md)
- [skill/TRANSPORT.md](/Volumes/XDISK/chorus/skill/TRANSPORT.md)
- [memory-bank/progress.md](/Volumes/XDISK/chorus/memory-bank/progress.md)
- [pipeline/handoffs/260323-bridge-handoff.md](/Volumes/XDISK/chorus/pipeline/handoffs/260323-bridge-handoff.md)

已经补上的关键规则：

- agent 可以自主和其他 agent 继续对话
- 但每一轮自主发送和每一轮收到的回复，都必须自然地告诉人类
- 不允许静默后台长聊后再统一总结

---

## 当前唯一待闭环事项

### OpenClaw 正在使用旧版 skill

这是当前最重要的 pending。

已经确认：

- 仓库里的 skill 文件已经更新：
  - [skill/SKILL.md](/Volumes/XDISK/chorus/skill/SKILL.md)
  - [skill/SKILL.zh-CN.md](/Volumes/XDISK/chorus/skill/SKILL.zh-CN.md)
  - [skill/TRANSPORT.md](/Volumes/XDISK/chorus/skill/TRANSPORT.md)
- 但 OpenClaw 实际读取的是：
  - `/Users/test2/.openclaw/skills/chorus/SKILL.md`
  - `/Users/test2/.openclaw/skills/chorus/TRANSPORT.md`
- 两边内容当前不一致
- OpenClaw skill 目录下甚至没有 `SKILL.zh-CN.md`
- 主会话里存在 `skillsSnapshot` 缓存

所以：

**现在还不能假设 `xiaov/xiaox` 已经在吃新版自主对话规则。**

---

## 1号当前任务

1号已被派去做这件事：

1. 将仓库中的最新 skill 同步到 `~/.openclaw/skills/chorus/`
2. 校验同步结果
3. 清理 `skillsSnapshot`
4. 回报是否需要重启 gateway

在 1号回来之前，不要假设这条线已经完成。

---

## 重启后第一优先级

重启后先做这 3 步：

1. 读取 1号回报
2. 确认以下几点：
   - 哪些文件已复制到 `~/.openclaw/skills/chorus/`
   - `cmp/diff` 是否一致
   - `clear-skill-cache.sh` 是否已执行
   - 是否需要 `gateway restart`
3. 如果 1号结论是需要重启：
   - 执行一次 gateway restart
   - 然后再让 `xiaov/xiaox` 使用新版 skill 开始自主聊

---

## 发布内容范围

如果要准备对外发布，当前可以公开讲的内容是：

### 可公开讲

- Chorus 是跨平台 agent-to-agent 通信协议
- 核心差异是语言翻译 + 文化适配
- `agchorus.com` 提供 public hub
- `chorus-bridge` 已完成 runtime 验证
- 英文来信可适配为中文后送微信
- agent 可以自主和其他 agent 聊，但对人类保持可见
- Hub 当前支持 invite-gated self-registration

### 不建议现在公开讲得太满

- 不要说“生产级安全已完成”
- 不要说“身份系统完善”
- 不要说“public hub fully open”
- 不要把 invite gating 说成完整账号体系
- 不要把 bridge 说成通用多渠道生产版，它现在仍是 spike/bridge 路线

---

## 发布建议

当前最稳妥的发布策略：

### 代码层

- 可以开源
- 可以开始发 README / demo / protocol / skill

### Hub 层

- 维持 invite-only alpha
- 打开 `CHORUS_INVITE_CODES`
- 不要公开无门槛放开 `/register`

### 渠道层

- 先做定向邀请
- 再做社交媒体/媒体扩散
- 不要在 hub 完全裸开的前提下先上大流量

---

## 待办清单

### P0

1. 等 1号回报 OpenClaw skill 同步结果
2. 如需，重启 gateway 让新版 skill 生效
3. 再次确认 `xiaov/xiaox` 自主对话时遵守“自然告知人类”的新规则

### P1

1. 整理一版最终发布摘要
2. 确认 `CHORUS_INVITE_CODES` 的实际配置与发放方式
3. 设计首批 invite-only alpha 分发名单与口径

### P2

1. 收掉 `CHORUS_PROJECT` 硬编码
2. 补齐 skill 中文文档的长期缺口（如 Local Storage 全量对齐）
3. 继续清理 README / npm / package 分发的一致性

---

## 不要再重开的问题

1. 不要再重开 bridge 是否跑通。已经 PASS。
2. 不要再重开 auto-drain 是否生效。已经 PASS。
3. 不要再重开英文是否会原样直出。微信截图已证明不是。
4. 不要再把 Hub invite gating 和 bridge runtime 混在一起审。
5. 不要再把“agent 自主聊”理解成“必须先审批”。当前目标是允许自主聊，但要对人类保持持续可见。

---

## 是否还需要 2号 / 3号

当前结论：

- **2号：待命即可**
  - 只有在 1号 同步 skill 后，你发现 `xiaov/xiaox` 仍然没有按新版规则表现时，再叫 2号
- **3号：待命即可**
  - 只有在后续你想做“最终发布前审查”或“社交媒体文案/发布页审查”时，再叫 3号

现在不需要主动再开 2号、3号继续做事。

---

## 关键文件

- [README.md](/Volumes/XDISK/chorus/README.md)
- [skill/SKILL.md](/Volumes/XDISK/chorus/skill/SKILL.md)
- [skill/SKILL.zh-CN.md](/Volumes/XDISK/chorus/skill/SKILL.zh-CN.md)
- [skill/TRANSPORT.md](/Volumes/XDISK/chorus/skill/TRANSPORT.md)
- [pipeline/handoffs/260323-bridge-handoff.md](/Volumes/XDISK/chorus/pipeline/handoffs/260323-bridge-handoff.md)
- [src/server/index.ts](/Volumes/XDISK/chorus/src/server/index.ts)
- [src/server/routes.ts](/Volumes/XDISK/chorus/src/server/routes.ts)
- [tests/server/self-register.test.ts](/Volumes/XDISK/chorus/tests/server/self-register.test.ts)
- `/Users/test2/.openclaw/skills/chorus/SKILL.md`
- `/Users/test2/.openclaw/skills/chorus/TRANSPORT.md`
- `/Users/test2/.openclaw/scripts/clear-skill-cache.sh`

---

## 一句话状态

**项目层面已经从“修 bridge”切换到“准备发布”；当前唯一现实中的未闭环点，是把新版 skill 同步进 OpenClaw 实际使用目录。**

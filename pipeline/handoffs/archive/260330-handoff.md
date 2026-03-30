# Handoff — 2026-03-30

## ⚡ 立即行动（第一步）

读取 `pipeline/bridge-v2-validation/final-verdict.md` 确认当前验收状态（CONDITIONAL PASS），然后读本文件的"待完成"章节，确定下一步。

---

## 当前状态

- **项目**: Chorus — 跨平台 Agent 通信协议
- **Stage**: 无活跃 Fusion Stage（Bridge v2 验证 + onboarding 修复已完成，非标准 Stage 流程）
- **Release**: v0.8.0-alpha 未发布（git tag 未打）
- **Branch**: main @ `3e41bf1`
- **Tests**: 523 tests / 36 suites 全绿
- **Hub**: agchorus.com 运行中（0.7.0-alpha 部署）

---

## 本会话完成事项

### 1. Onboarding/Activation 产品缺陷修复（Commander 已关单）

三个根因缺陷全部修复：

| 缺陷 | 修复 | Commit |
|------|------|--------|
| verify 假阳性（standby 报 exit 0） | verify 拆两层，standby exit 1 | `094c684` |
| 凭证双轨不通（workspace vs ~/.chorus/agents/） | workspace 路径优先 + 5s 轮询热激活 | `c2217fc`, `67b8c28` |
| 源码路径硬依赖（/Volumes/XDISK/chorus） | 9 个运行时模块打包 + jiti zod alias | `0b9aad5`, `8ae072c` |

### 2. SKILL.md 冷启动语义

- 定义了"继续"触发词 → 注册 → 保存凭证 → 等激活的完整序列 → `a649f13`
- Cold-start acceptance spec + evidence 模板 → `1dec0b4`

### 3. MacBook Cold-Start 验收 PASS

- 无 XDISK、无源码仓库，bridge 从 extension/runtime/ 加载，V2 bridge active → `3e41bf1`
- 基础设施路径验收通过（install → credentials → activation）

### 4. E2E 内容对话验收 BLOCKED

- Hub SSE 投递成功（trace `0874e7e6`），bridge 收到消息
- 首次失败：`no_delivery_target`（缺 telegram_chat_id）— 已修正
- 仍失败：chorus-bridge 插件加载阻断 Telegram channel 启动（OpenClaw Gateway 问题）
- Commander 判定：不在 Chorus 修复范围

---

## 待完成（按优先级）

1. **[P0] E2E 内容对话验收** — 依赖：OpenClaw Gateway 解决插件-channel 互斥问题，或找到 Telegram channel 与 chorus-bridge 共存的方案
2. **[P1] npm publish `@chorus-protocol/skill@0.8.0-alpha`** — 依赖：Commander 审核发布材料（`docs/distribution/github-release-package.md`）
3. **[P1] Git tag `v0.8.0-alpha`** — 依赖：Commander 最终审核
4. **[P2] Gene Bank 毕业** — 8 条 Gene confidence ≥ 0.8，可运行 `/fusion-graduate`

---

## 关键决策与约束

| 决策/约束 | 具体内容 | 原因 |
|----------|---------|------|
| workspace 凭证优先 | `~/.openclaw/workspace/chorus-credentials.json` 是主路径，`~/.chorus/agents/*.json` 降为兼容路径 | 统一 SKILL.md（agent 写 workspace）和 bridge（读 workspace）的凭证路径 |
| 运行时模块打包 | 9 个 .ts 文件打包进 extension/runtime/，不依赖外部源码 | 任何无源码仓库的机器都能激活 bridge |
| verify exit 1 on standby | 安装完整但无凭证时 verify 返回非零 | 防止用户误以为"安装成功=可用" |
| E2E 不在本轮范围 | chorus-bridge 阻断 Telegram 是 OpenClaw 问题 | Commander 判定 |

---

## 必读文件

1. `pipeline/bridge-v2-validation/final-verdict.md` — 当前验收真相（CONDITIONAL PASS）
2. `pipeline/bridge-v2-validation/evidence/E-03-01-cold-start.md` — MacBook 验收证据
3. `docs/distribution/github-release-package.md` — 发布材料（待 Commander 审核）
4. `packages/chorus-skill/templates/bridge/runtime-v2.ts` — bridge 核心，理解模块加载路径

---

## 风险与禁区

- **禁止**: 在 MacBook 上同时启用 chorus-bridge 和 Telegram channel — 会导致 Telegram 不启动
- **注意**: `runtime-v2.ts:36` 仍有 `/Volumes/XDISK/chorus` 作为 dev-only fallback 候选路径，这是设计意图不是遗漏
- **注意**: Hub 仍运行 0.7.0-alpha，bridge 代码（hub-client.ts）有 session exchange 404 fallback 到 Bearer auth 的兼容逻辑
- **注意**: WeChat delivery 仍为 `unverifiable`（iLink Bot 协议限制），不要声称"所有渠道确认投递"

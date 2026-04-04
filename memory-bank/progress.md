# Chorus Protocol — Progress Log

## 2026-04-03 EXP-03 Run 2 PASS + IMPL-EXP03-03 修复 + alpha.9 发布

**操作**: 执行 3 个待办任务 + EXP-03 Run 2 全流程

**结果**:

- IMPL-EXP03-03 完成：bridge 去私有 Telegram 发送栈，`sendMessageTelegram` 改用 `accountId` 委托 OpenClaw channel helper（commit `f222b70`）
- RESTART_CONSENT_HARD_GATE：新增 credentials-only 路径测试（commit `f222b70`）
- `@chorus-protocol/skill@0.8.0-alpha.9` 发布（commit `bbf7f9c`，tag `v0.8.0-alpha.9`，shasum `9021a0d0`）
- Mac mini + MacBook Chorus 安装痕迹全清
- MacBook SSH 修复（用户名 test2，ed25519 公钥）
- EXP-03 pre-flight 13.1-13.3 全 PASS，conductor 改为 xiaox@chorus（xiaoyin key 丢失）
- EXP-03 Run 2 执行：18:40 开场 → 18:41 安装 → 18:42 批准重启 → 18:46 Telegram 消息可见
  - Agent: openclaw-test@agchorus
  - Hub trace: `0c02a49a`，delivery_confirmed，telegram_server_ack ref=147
  - C-1 到 C-11 全部满足 → **PASS**
- Friction event: Telegram polling 断连（IMPL-EXP03-04），根因为 approve 写 openclaw.json 触发连锁 reload
- 整改规格 `TASK_SPEC_EXP03_TELEGRAM_POLLING_DISCONNECT.md` 已写入

**决策**:

- Conductor 从 xiaoyin@chorus 改为 xiaox@chorus（API key 在清理 ~/.chorus/ 时丢失，生产 Hub 无法本地删除）
- EXP-03 PASS 不因 Telegram 断连降级（C-6 在 18:46 已达成，断连发生在之后）
- IMPL-EXP03-04 approve 不写 openclaw.json，complete 合并清理

## 2026-04-01（续，13.2 已闭环；整体 pre-flight 仍待 13.4）

**操作**: 在显式放行后补完 Run 2 pre-flight 剩余两项：conductor self-test + browser console check
**结果**:

- conductor self-test 已完成：
  - direct Hub send response 返回 `delivery=delivered_sse`
  - sender=`run2-selftest-1775054319392@chorus`
  - inbound trace=`6ce7e751-abd5-41e1-aa52-38beb8d547e2`
  - gateway log 已记录 `delivery_confirmed`
  - xiaoyin state/relay 记录已闭合，reply relay `cb0460ed-2d99-4f0b-a7d3-657496cbf597` 为 `confirmed=true`
- browser console check 已完成：
  - headless Chrome 成功加载 `https://agchorus.com/console`
  - HTTP `200`
  - title / H1 = `Chorus Alpha Console`
  - 截图已落盘到 `pipeline/bridge-v2-validation/evidence/EXP-03-run2-console-check-20260401.png`
- pre-flight evidence 已更新为：
  - `Section 13.2 rerun = PASS`
  - 但整体 run pre-flight 仍 **not cleared**，因为 `Section 13.4`（subject/session logistics）仍 pending

**决策**:

- 不改 spec，不换 conductor identity，不启动 Run 2
- 当前唯一剩余 gate 是 `13.4`：选定受试者、做 subject environment pre-check、arm 录屏与 shell/browser history
- 只有 `13.4` 关闭后，整体 pre-flight 才能转为 cleared

## 2026-04-01（续，13.4 执行包已备好；现在缺真实受试者）

**操作**: 继续推进 Section 13.4，但只做本地可完成的准备工作
**结果**:

- 已新增运行包 [EXP-03-run2-subject-precheck-20260401.md](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/evidence/EXP-03-run2-subject-precheck-20260401.md)，把以下内容固定成可执行记录单：
  - subject selection / screening
  - written consent
  - Section 13.4 machine pre-check
  - Section 13.5 session logistics
  - screen recording / shell history / browser history capture plan
- 主 pre-flight 证据已链接这份运行包，明确说明：流程已备好，但目前仍没有真实受试者数据可填

**决策**:

- 在不改 spec、不换 conductor identity、不启动 Run 2 的前提下，当前最大阻塞已经收敛为：需要你给出一个合格的真实受试者并完成现场核验
- 一旦受试者确定，下一步只按这份运行包逐项填完 13.4 / 13.5，然后再重判 pre-flight 是否 cleared

## 2026-04-01（续，补当前 agents 目录快照；冻结继续）

**操作**: 按整改清单补 Section 13.2 证据，但继续冻结在 pre-flight，不启动 conductor self-test，也不开始 Run 2
**结果**:

- `pipeline/bridge-v2-validation/evidence/EXP-03-run2-preflight-20260401.md` 已补当前 `~/.chorus/agents/` 目录级快照，明确当前实际内容是 `01-xiaoyin.json`，不是只保留“empty”文字描述
- `curl -s https://agchorus.com/health` 当前仍返回 `status=ok`（`2026-04-01T14:25:11.804Z`）
- `curl -s https://agchorus.com/discover` 当前真实 JSON 结构为 `data[]`；`jq '.data[] | select(.agent_id=="xiaoyin@chorus")'` 在 `2026-04-01T14:26:14.700Z` 仍显示 `xiaoyin@chorus online=true`
- gateway 当前运行证据未漂移：`2026-04-01T22:11:53.385+08:00 [gateway] [chorus-bridge] [xiaoyin] V2 bridge active (state: /Users/owenmacmini/.chorus/state/xiaoyin)`

**决策**:

- 不走 spec 改绑分支；原 conductor identity `xiaoyin@chorus` 继续有效
- Section 13.2 仍然只算 partial rerun：online 已确认，但 self-test / browser console check 依旧未做
- pre-flight 维持 `entered but not cleared`；在新放行前，禁止 conductor self-test 与 Run 2

### 2026-04-01（续，Run 2 继续冻结；后续只允许补完 13.2 剩余两项）

**操作**: 接收新的整改边界，冻结 pre-flight 在当前状态，不进入 Run 2
**结果**:
- 当前冻结继续有效：不改 spec，不换 conductor identity，不启动 Run 2
- 若后续继续推进，允许补的检查只剩两项：
  - conductor self-test
  - browser console check
- 只有这两项补完后，才允许重新判定 pre-flight 是否 cleared

**决策**:
- 在新的显式放行前，不做任何额外 pre-flight 扩展动作
- 当前状态维持：pre-flight entered but not cleared

### 2026-04-01（续，xiaoyin conductor identity 已恢复；13.2 只做了冻结条件下的部分重跑）

**操作**: 按 Run 2 pre-flight 整改清单恢复 `xiaoyin@chorus` 合法凭证链，并补目录级证据快照
**结果**:
- pre-flight evidence 已补进 `~/.chorus/agents/` 的目录级快照，明确记录恢复前该目录确实为空
- 已恢复 `~/.chorus/agents/01-xiaoyin.json`，保留原 conductor identity，不走 spec 改绑分支
- gateway 无需手动重启即重新激活 `xiaoyin@chorus`
  - 证据点：`2026-04-01T22:08:21.341+08:00 [gateway] [chorus-bridge] activated: xiaoyin@chorus from agents/01-xiaoyin.json`
- Section 13.2 已在冻结约束下重跑：
  - `curl -s https://agchorus.com/health` 仍为 `status=ok`
  - `curl -s https://agchorus.com/discover` 已显示 `xiaoyin@chorus online=true`
  - 但 conductor self-test 仍按整改要求保持 **未执行**
- `~/.openclaw/workspace/chorus-credentials.json` 的旧格式 `xiaox@chorus` 凭证仍在，并继续被 bridge 记为 malformed；本轮未清理，以保留证据真实性

**决策**:
- 不启动 conductor self-test，不开始 Run 2
- `xiaoyin@chorus` credential-loss blocker 已关闭，但 Section 13.2 只算 partial rerun，不能宣称 pre-flight cleared
- 当前冻结点：等待后续明确批准再补 self-test / browser console check，然后才可能进入受试者 pre-flight

### 2026-04-01（续，Run 2 pre-flight 阻塞根因已定位到 conductor credential 丢失）

**操作**: 继续推进 pre-flight，排查为什么 `xiaoyin@chorus` 长时间离线
**结果**:
- Hub 当下仍健康：`curl -s https://agchorus.com/health` 返回 `status=ok`，但 `discover` 仍显示 `xiaoyin@chorus online=false`
- `openclaw status` 确认本机 gateway 进程本身是活的，不是“服务没起”
- 真正阻塞点已缩到本机 credential 链：
  - `~/.openclaw/logs/gateway.err.log` 持续报 `workspace/chorus-credentials.json (missing required fields)`
  - `~/.openclaw/workspace/chorus-credentials.json` 是旧格式 `xiaox@chorus` 凭证，只含 `agent_id/api_key`，缺 `hub_url`
  - `~/.openclaw/workspace-xiaoyin/chorus-credentials.json` 缺失
  - 历史日志证明 `xiaoyin@chorus` 之前依赖 `~/.chorus/agents/01-xiaoyin.json` 激活，但该文件现已不存在
  - `~/.chorus/agents/` 为空，`~/.chorus/state/` 也没有 `xiaoyin` 状态残留
- pre-flight evidence 已补写本地诊断根因，并且 `npx markdownlint-cli pipeline/bridge-v2-validation/evidence/EXP-03-run2-preflight-20260401.md` 通过

**决策**:
- Run 2 pre-flight 仍是 BLOCKED，但阻塞口径已从泛化的“conductor 在线门未过”收紧为“conductor identity credential loss / stale local credential state”
- 在恢复 `xiaoyin@chorus` 的合法凭证前，不启动 conductor self-test，更不进入受试者执行
- 若要改用其他 conductor identity，必须先显式改实验规格和 sender identity，不能静默替换

### 2026-04-01（续，alpha.8 npm 发布完成；Run 2 版本门禁已清）

**操作**: 发布包含 Telegram fallback、proof-based restart gate、identity-first proof 绑定的新 npm 版本，并回填 EXP-03 run version
**结果**:
- `@chorus-protocol/skill@0.8.0-alpha.8` 已发布到 npm，`alpha` dist-tag 已从 `0.8.0-alpha.7` 移到 `0.8.0-alpha.8`
- registry smoke 通过：`npm view @chorus-protocol/skill@0.8.0-alpha.8 version` 返回 `0.8.0-alpha.8`
- registry smoke 通过：`npx @chorus-protocol/skill@0.8.0-alpha.8 --help` 可正常执行
- EXP-03 spec 已回填 `VERSION_UNDER_TEST=0.8.0-alpha.8`，顶层状态改为“run version published; awaiting Run 2 pre-flight”
- 发布映射已记录：`0.8.0-alpha.8` 是从 base `HEAD 2dfa4997` + 当时 dirty worktree 发出；`bd8e7bd` 在祖先链上

**决策**:
- Run 2 的“必须使用已发布 npm 版本”门禁已清除，但实验本身仍未开始
- 由于 alpha.8 不是从干净 tag 发出，后续 evidence / report 必须显式写明这是 dirty worktree publish，不能伪装成纯 tag release
- 下一阶段只做 Run 2 pre-flight、受试者执行和证据采集；不要在同一轮再混入新的功能改动

### 2026-04-01（续，Run 2 pre-flight 已进入；当前卡在 conductor 在线门）

**操作**: 冻结 Run 2 pre-flight 记录，执行 published-package smoke 与 Hub 可达性检查
**结果**:
- 新增 pre-flight evidence：`pipeline/bridge-v2-validation/evidence/EXP-03-run2-preflight-20260401.md`
- pre-flight 记录已固定写入 `@chorus-protocol/skill@0.8.0-alpha.8`、`dist.shasum=af7732068ce9afe018f895fd87fd8c5ee3ec1a1e`、`dist.integrity=sha512-v9/eikmYQv1BmAlWV6y8kxYyk49iV/cfIY2ORR8qAycWjVR1j9jDOVm06i82AcrZDRxV9umDUDy7DQA7cGDyEQ==`
- pre-flight smoke 通过：隔离 temp HOME 下 `npx @chorus-protocol/skill@0.8.0-alpha.8 init --target openclaw` exit `0`；`verify --target openclaw` 安装完整性 PASS 后按预期阻塞在 restart gate
- Hub health 通过：`status=ok`
- `discover` 可达，但当前 `xiaoyin@chorus` 为 `online=false`
- EXP-03 spec 已增加 pinned-install audit 规则：任何 unpinned install 直接记 `PROTOCOL DEVIATION: UNPINNED INSTALL`，且不得拿后续 artifact 证明 published-package path 真实性

**决策**:
- Run 2 pre-flight 已进入，但还未 cleared
- 当前阻塞是 conductor online/self-test gate；在 `xiaoyin@chorus` 恢复在线并完成自测前，不启动受试者执行
- Subject screening / 录屏 / shell history / browser history capture 仍是 pending 项

### 2026-04-01（续，restart consent hard gate 已实现并验证）

**操作**: 在 `packages/chorus-skill/cli.mjs` 实装 install-time restart consent hard gate，并补齐 proof-based completion / version pin 回归
**结果**:
- `init --target openclaw` 现在会在 fresh install 时写入 `~/.chorus/restart-consent.json`，并临时把 `gateway` 加入 `~/.openclaw/openclaw.json` 的 `tools.deny`
- `restart-consent.json` 现在记录 `packageVersion`；CLI 和 EN/zh-CN 模板里的 helper 命令都 pin 到安装版本
- 新增 `restart-consent status|request|approve|complete` CLI 子命令：先写 `chorus-restart-checkpoint.md`，再等待用户明确同意；`complete` 改成 **proof-based**，没有 post-restart runtime evidence 就拒绝清 gate
- proof 解析改成 **identity-first**：`currentIdentity` 只要不是 `unknown`，就必须绑定到同一 agent；workspace credential 若与 checkpoint identity 不一致，`complete` 直接失败
- bridge `runtime-v2` 成功激活后会写出 durable activation proof；`complete` 只接受 approval 之后的新 proof，并额外写 `chorus-restart-proof.json`
- `verify --target openclaw` 在 gate 仍激活时会明确报 blocked，不再把“已安装但未获准重启”误报成 ready
- EN / zh-CN SKILL 模板已同步到 helper 流程；局部 restart section lint 已清理
- 回归验证通过：`node --check packages/chorus-skill/cli.mjs`
- 回归验证通过：`npm test -- --runInBand tests/cli/cli.test.ts`（48/48）
- 回归验证通过：`npm test -- --runInBand tests/bridge/runtime-v2.test.ts --coverage=false`（26/26）

**决策**:
- 当前最早可执行 enforcement point 是 OpenClaw core `tools.deny` 对 `gateway` 工具的临时封锁，不再声称 bridge runtime/plugin hook 能拦住首次未授权重启
- gate 的收尾标准已从“agent 自报恢复完成”升级为“runtime 留下 post-restart proof + helper 写出 completion proof”
- 证明链现在要求“checkpoint identity = resolved proof agent”；不再允许 workspace credential 把恢复链路静默切到另一个 agent
- 这次修复的闭环范围冻结在 delegated fresh-install 的首次重启门禁；npm publish 和 EXP-03 Run 2 继续冻结到下一个阶段
- 模板整文件仍有历史 markdownlint 债，但本轮只修了 restart section 相关段落，不扩散范围

### 2026-04-01（续，已下发 P0 实现任务）

**操作**: 针对 delegated EXP-03 的最高优先级阻塞，签发代码实现任务
**结果**:
- 新增任务规格 `pipeline/tasks/TASK_SPEC_EXP03_RESTART_CONSENT_HARD_GATE.md`
- 任务明确要求：restart consent 必须是**代码级**门禁；禁止 runtime-v2-only 修复；fresh install 首次重启前必须已有 enforcement point

**决策**:
- 当前唯一 P0 实现任务：先做 restart consent hard gate
- npm publish / Run 2 / 新受试者执行都排在这个任务之后
- Run 2 仍冻结：必须是已发布 npm 版本，且同时包含 `bd8e7bd` 与 hard gate 修复

### 2026-04-01 (EXP-03 规格改为 delegated path + Run 2 门禁收紧)

**操作**: 根据 EXP-03 Run 1 真实执行轨迹和 `bd8e7bd` 修复后的当前态，重写实验规格，纠正“人类手工安装”假设
**结果**:
- `docs/experiments/EXP-03-human-developer-cold-start.md` 已改为 **Human-Delegated Cold-Start Integration**
- 新增 Section 0 `VERSION_UNDER_TEST`：Run 2 明确阻塞在“已发布 npm 版本且包含 `bd8e7bd` Telegram token fallback 修复”
- PASS 条件收紧为 delegated 真实路径：受试者必须直接对自己的 OpenClaw agent 下达任务；禁止人工 takeover；restart consent 变成硬门槛；agent 虚报成功记 FAIL
- debrief / artifacts / pre-flight checklist 已同步到 delegated 路径；新增 restart checkpoint 证据要求
- `npx markdownlint-cli docs/experiments/EXP-03-human-developer-cold-start.md` 通过

**决策**:
- EXP-03 不再允许拿“手工跑 npx / 读 docs / 改 JSON”的旧口径解释 Run 2
- alpha.7 和任何未发布本地代码都不允许作为 Run 2 版本基线
- restart consent 仍是开放实现风险，但现在被规格显式提升为 PASS/FAIL 门槛，不再是软提醒

### 2026-03-31 21:15 (Bridge→TG 投递失败根因修复)

**操作**: 排查并修复 bridge 收到 SSE 消息后未转发到 Telegram 的 P0 阻塞
**结果**: `bd8e7bd` — 531/531 tests green，MacBook live 验证 3/3 delivery_confirmed
**决策**:
- 根因：`deliverInbound` 从 `api.config`（plugin config）读 Telegram botToken，部分 OpenClaw 运行时的 plugin config 不含 channel credentials，token 仅在全局 `~/.openclaw/openclaw.json`
- 修复：plugin config 无 token 时 fallback 读全局 openclaw.json
- 测试 harness 去掉默认 botToken，default-only/fallback 测试断言 `flat-bot-token`（来自全局 config）
- recovery 回归测试走真 `RecoveryEngine.recover()` 路径（两轮 recover：throw → incomplete → succeed → cursor_advanced）
- 证据文件（docs/evidence/）暂未入提交，待后续整理

### 2026-03-31 20:30 (EXP-03 Run 1 冻结 + 审计产物补全)

**操作**: 补写 4 个缺失审计产物（question-log, debrief, contamination-check, screening），链接到 summary
**结果**: EXP-03 Run 1 产物冻结完成（10 个文件），verdict = VOID
**决策**:
- VOID 原因双重：(1) 污染审计 3 项全缺（录屏/shell history/browser history），(2) E-4 违反（受试者与 Commander 同组织）
- 实质发现记 IMPL：bridge 收到 SSE 但未转发到 Telegram
- 排查 bridge→TG 投递失败是下一个 P0

### 2026-03-31 20:15 (restart consent + alpha.7 + doc hardening + EXP-03 retest)

**操作**:
1. Restart consent checkpoint: task spec 冻结 + EN/zh-CN SKILL.md 模板实现（gateway 重启前必须写 checkpoint + 征求用户同意）
2. Alpha.7 发布: bump → tag `v0.8.0-alpha.7` → npm publish → registry 验证 PASS
3. Doc hardening: skill/ 同步 packages/（5 文件）、EXP-03 版本锁 alpha.7、CI stale version gate
4. CI 修复: hub-client SSE 测试在 Ubuntu 上 7 个失败，根因 @sinonjs/fake-timers 拦截 setImmediate。修复：保存真实 setTimeout + 移除不必要的 fake timers（4 轮迭代）
5. EXP-03 重测: MacBook 环境清理 + Mac mini 清理 + 受试者（Commander 同事）执行

**结果**:
- alpha.7 npm 发布成功，CI 529/529 全绿（commit `dd169c2`）
- EXP-03 重测结果 **INCOMPLETE**: 安装+注册+bridge 激活全自主完成，但 Chorus 消息未在 Telegram 可见
  - Hub 侧 `delivered_via=sse` 确认消息到达 bridge
  - Bridge → Telegram 投递链断裂（根因待排查）
  - 两台机器的 agent 都跳过了 restart consent checkpoint，直接自行重启 gateway
  - MacBook agent 注册为 `test2-macbook@agchorus`，小x 注册为 `xiaox@chorus`（旧凭证残留被重写，缺 hub_url）

**决策**:
- EXP-03 此轮标记 INCOMPLETE，不标 FAIL（安装链路完整，投递链断裂是 IMPL 问题）
- Restart consent checkpoint 未被 agent 遵守——SKILL.md 软约束对 agent 行为约束力不足
- 小x 凭证问题: 旧 `chorus-credentials.json` 被恢复，缺 `hub_url` 字段

### 2026-03-18 22:00

**操作**: Phase 0 收尾 + Phase 1 Stage 0 完成
**结果**:
- Phase 0 归档完成：5/15 语言对实验数据 → `results/report.json` + `results/summary.md`
- FP 审计发现 Schema-实验差异（`cultural_context` 字段不在 Schema 中），已在所有文档中显式标注
- Phase 0 所有文档交叉一致性验证通过
- Phase 1 PRD/FEATURE_LIST/BDD 编译完成，Gate 0 通过
- PM 自检 REVISE→修复，PM Consultant 审查 REVISE→修复 2 CRITICAL + 5 HIGH
- FP 审计删除 F8（降级）+ 心跳机制 + v0.1 兼容 BDD = -6 场景（25→19）
- Phase 1 Stage 0.5 SKIP（无 UI），进入 Stage 1

**决策**:
- `cultural_context` 生成策略：协议只定义字段格式，不管生成方式（FP 判定：Chorus 是路由层，不带 AI 算力）
- F8 Phase 1 不实现：所有 Agent 均为 v0.2，降级场景不存在
- 心跳删除：localhost demo 不需要分布式心跳，改为 Agent 退出时显式 DELETE 注销
- 延迟指标：8s E2E → 5s 单跳（有分解依据）
- Phase 1 目标受众：内部验证（demo first）

### 2026-03-19 12:00

**操作**: Phase 1 完整流水线 (Stage 1→7) + Phase 2 完整流水线 + 3 轮优化
**结果**:
- Phase 1: 8 Tasks TDD 完成，195 tests，92.5% coverage，merged to main
- Phase 1 E2E: ja→zh-CN "つまらないものですが"→"一点心意，不成敬意，请您收下" 验证通过
- Phase 2: Streaming + Web Demo UI + 多轮对话，8 Tasks，255 tests，merged to main
- 模型切换: qwen3.5-plus→qwen3-coder-next (80x 提速，30s→1.4s)
- FP 审计 3 轮: 死代码清除 + llm.ts 重复消除 + index.ts 拆分 + demo 假广播修复
- 架构简化: JSON 提取→纯文本双调用（零格式失败，消除 ja→zh 方向 100% 失败率）
- Agent 人格: 透明翻译管道→文化朋友传话模式（一行提示词改变，体验质变）

**决策**:
- 不定义 Agent 人格参数——LLM 自带人格，不需要额外配置
- 不要求 LLM 输出 JSON——纯文本调用，100% 可靠
- intent_type/formality/emotional_tone 删除——从未参与适配过程，只是展示元数据
- coding.dashscope.aliyuncs.com/v1 + qwen3-coder-next 是当前最优 LLM 配置
- 8 模型横评结论: qwen3-coder-next (1.4s) > kimi-k2.5 (2.1s) > 其余全部被 thinking 拖慢

### 2026-03-19 晚

**操作**: FP 清理提交 + Playwright E2E + Phase 3 personality + Phase 4 部署规划
**结果**:
- 3 commits: FP 死代码清理(c351ca8) + Playwright Web UI 测试(8c12e10) + Agent personality(1b11593)
- Playwright E2E: 15/15 assertions pass — 页面加载/SSE连接/双向 zh↔ja 消息/元数据折叠/空输入拦截
- Phase 3 Agent Personality: personality 从协议层(agent_card)移到 receiver 配置层 — 每个 agent 用自己的风格转述，不在协议中传递人格
- Phase 4 公网部署 PRD/FEATURE_LIST/BDD 编译完成，Gate 0 通过，Gate 2 待批（5 Tasks）
- 3 轮 FP 审计: 发现 tsc 编译链缺失 → auth 拆分重复 → Agent 客户端不发 auth 头

**决策**:
- personality 不属于协议 — Chorus 是 SMTP，邮局不管你是什么性格
- GET /agents 公开无需鉴权 — 类似 DNS/MX 记录，Agent 注册就是为了被发现
- HTTPS 由部署平台提供（TLS 终止），路由服务器本身仍监听 HTTP
- 路由服务器零 LLM 依赖 — 纯消息中继，不需要速率限制（Agent 自带成本控制）
- 写计划前必须先跑端到端用户动作链（FP 教训，已写入 memory）

### 2026-03-19 晚（续）

**操作**: Phase 4 Gate 2 批准 → 5 Tasks 执行 + FP 审计修复 + 协议对标调研 + 架构转向
**结果**:
- Phase 4 五个 Task 全部完成：tsconfig/build scripts + auth middleware + GET /health + Agent 鉴权 + Dockerfile
- 152 tests 全绿（+13 新增），tsc 类型检查通过，npm run build 编译到 dist/ 成功
- FP 审计发现 2 个问题并修复：routerApiKey 从 CLI 参数改为环境变量（P0 安全）+ routerHeaders 消除突变（P1 不变性）
- 12+ 协议对标调研：A2A (Google), MCP (Anthropic), ACP (Zed), ANP, AG-UI, SLIM, OASF, Agent Protocol (e2b), KERI 等
- **重大架构转向**：Chorus 从"需要中心 Router 的基础设施"转变为"任何 Agent 可学的 Skill"

**决策**:
- Chorus = Skill（核心产品），不是基础设施
- Router 降级为可选 Relay（给没有域名的 Agent 用）
- 发现/传输/认证不是 Chorus 的职责，交给宿主协议（A2A、MCP 等）
- Chorus 的唯一生态位：跨文化语义适配——所有现有协议都不管这一层
- Skill 形态：SKILL.md + envelope.schema.json + examples
- 现有 src/server/* 降级为 demo/relay 工具，src/agent/ 中的 LLM + envelope + receiver 是核心

### 2026-03-19 深夜

**操作**: Phase 5 PM 重写（统一 PRD v2.0）+ Skill 文件包创建 + 跨平台验证
**结果**:
- 统一 PRD v2.0 重写完成：Chorus 三层平台定义（L1 Protocol / L2 Skill / L3 Ecosystem）
- Commander 多次修正概念：Chorus 是协议+平台而非 Skill；Skill 只是协议的分发载体；L3 不是 Relay 而是连接生态（P2P/Agent社交网络/第三方/宿主平台，均可选）
- 3 轮 FP 审计：删除 Schema 中 intent_type/formality/emotional_tone（证明无用）；D2 跨平台验证提至 P1（先验证再投资 npm）；场景 D 从用例压缩为定位说明
- Phase 5 Skill 文件包完成（skill/ 目录）：SKILL.md + envelope.schema.json + 2 组示例 + README.md
- 跨平台验证通过：fresh Agent 读取 SKILL.md 后成功生成合法 Envelope（fr-FR→ja），schema 验证通过，适配质量达标
- 参考实现重定位完成：src/server/ + src/agent/ + src/demo/ 加 L3 标注
- 15 个历史 PM 文档加 SUPERSEDED 标记
- architecture.md 更新与 PRD 对齐

**决策**:
- Chorus ≠ Skill。Chorus 是协议，Skill 是分发载体（TCP/IP 是协议，RFC 是载体）
- L3 Ecosystem 不限制连接方式：P2P 直连（区块链等）、Agent 社交网络（远期）、第三方集成、宿主平台均可
- Agent 不只是翻译——也可以是自主社交参与者
- intent_type/formality/emotional_tone 从 Schema 显式定义中移除：Phase 0 证明无用 + passthrough 保兼容
- 交付优先级修正：D1 Skill (P0) → D2 跨平台验证 (P1) → D3 重定位 (P1) → D4 npm (P2) → D5 语言对 (P2) → D6 社交网络 (P3)

### 2026-03-19 深夜（续2）

**操作**: Phase 5 头脑风暴 + 协议重设计 + 全 8 Tasks 执行完成
**结果**:
- Commander 头脑风暴升维：Chorus = Link（跨平台 Agent 通信标准），文化适配是锦上添花
- PROTOCOL.md v0.4 定稿（71 行）：original_semantic→original_text，新增 sender_id(name@host)，新增 Response 格式 + 3 错误码
- SKILL.md 重写（75 行）：和智能体说话而非写 API 文档，包含 L3 实现指导（Chorus Server / P2P）
- 双语完成：PROTOCOL.zh-CN.md + SKILL.zh-CN.md
- npm CLI 包完成：packages/chorus-skill/（`npx @chorus-protocol/skill init --lang en|zh-CN`），测试通过
- 跨平台验证 3/3 PASS：同文化发送 + 异文化发送 + 异文化接收适配
- envelope.schema.json 更新到 v0.4（sender_id + original_text）
- 示例更新：新增 en-to-en.json（同文化），旧示例更新到 v0.4
- README.md 重写 + L3 标注完善
- SMTP RFC 5321 深度研究 + A2A/MCP/ACP/ActivityPub 对标分析 + EvoMap/Moltbook/OpenClaw 竞品研究

**决策**:
- Chorus = Link，一个动词。首先是跨平台通信标准，文化适配是增值层
- original_semantic 删除→original_text 替代：不需要"语义提取"步骤，Agent IS the LLM
- sender_id 格式 name@host：像 email 地址，host 命名空间保证唯一性
- cultural_context 条件触发：异文化首轮一次，同文化省略
- Protocol ≠ Skill 物理分离：PROTOCOL.md(L1) + SKILL.md(L2)
- Agent-Human 对接已解决（OpenClaw channels），Chorus 解决 Agent-Agent 互通
- L3 两种模式：Chorus Server（IM 中继）+ P2P 直连
- Skill 不含提示词模板：Agent 就是 LLM，不需要教它提示自己
- 保留"MUST deliver in a form the receiver can understand"：笨 Agent 可能直接转发外语给人类

### 2026-03-20 10:00

**操作**: Phase 5 整改 — 8 Step 修复计划全量执行
**结果**:
- Step 1: TRANSPORT.md 新建（298 行）— L3 默认传输方案。深度调研 SMTP/XMPP/Matrix/A2A/ActivityPub 5 个协议后设计。专家审查 3 轮修正（sender_id 单一来源 / A2A 编码不改契约 / SSE 语义分层）
- Step 2: envelope.schema.json 版本枚举修复 — `["0.2","0.3","0.4"]` → `["0.4"]`（v0.4 required 字段在旧版不存在 = 矛盾）
- Step 3: SKILL.md 重写 — 7 个问题修复（自主参与 / 多轮 / Role-Link 矛盾 / 具体连接步骤 / receiver_id / 响应格式 / receiver culture 获取）
- Step 4: README.md 清理 — "semantic intent"→"original messages"，删除 "Plain text LLM calls"，加 TRANSPORT.md
- Step 5: PRD 定位更新 — "跨文化语义适配协议与平台"→"跨平台 Agent 通信标准"
- Step 6: SKILL.zh-CN.md 完整重译（与英文版 7 个修复点同步）
- Step 7: npm CLI 更新 — templates 同步 + CLI init 输出 TRANSPORT.md，测试通过
- Step 8: 跨平台验证 5/5 PASS — 同文化发送(含 transport) + 异文化发送 + 异文化接收 + Server 注册 + P2P 直连

**决策**:
- TRANSPORT.md 定位为"可选 L3 profile"，非 Chorus 核心扩张（PRD 约束：Chorus 不限制连接方式）
- Send 操作：裸 envelope 为 MUST，A2A 包装为 MAY（alternate encoding，不改核心请求结构）
- sender_id 单一来源：删掉 Send/Receive 外层 sender_id，从 envelope.sender_id 读取（避免 SMTP MAIL FROM/From: 不一致类安全问题）
- receiver_id canonical form 定为 name@host（与 sender_id 对称），本地短名 SHOULD accept
- 投递状态语义：delivered / failed / rejected + 重试规则（幂等：conversation_id + turn_number 去重）
- /.well-known/chorus.json 发现机制：SHOULD，非 MUST
- SSE streaming：MAY 扩展，明确是"接收方内容流透传"，非"投递进度流"
- agent_card.chorus_version 是 agent card extension 版本（"0.2"），独立于 envelope protocol 版本（"0.4"）

### 2026-03-21 13:00–14:30

**操作**: npm 分发闭环 — 包发布 + CLI 增强 + 入口统一
**结果**:
- `@chorus-protocol/skill@0.4.0` 首次发布到 npm，registry smoke test 通过
- `@chorus-protocol/skill@0.4.1` 发布：CLI 新增 `--target openclaw|claude-user|claude-project`，OpenClaw 一键安装+自动注册 `openclaw.json`
- 包审计修复：模板 PROTOCOL.md 同步（en+zh-CN）、README/LICENSE 加入包、版本号动态读取、`files`/`engines` 字段
- GitHub 仓库 `owensun6/chorus`（private）创建并推送
- npm org `@chorus-protocol` 创建，账号 `sunyimin111`
- 本地 OpenClaw 安装测试通过（文件+注册+卸载）
- 5 份分发文档：openclaw-install.md、npm-release-checklist.md、quick-trial.md、outreach-targets.md、release-0.4.0.md + release-0.4.1.md
- 所有对外入口统一到 `npx @chorus-protocol/skill init --target openclaw`

**决策**:
- OpenClaw 是主要触达渠道，`--target openclaw` 为默认推荐入口
- `repository`/`homepage`/`bugs` 等 npm 元数据只填真实地址，不猜测
- npm token 不在对话中传递，由 Commander 本地配置
- 分发文档闭环后进入"等外部信号"状态，不再补内部材料

### 2026-03-20 14:00

**操作**: Phase 6 v0.4 清理 + 状态报告审计 + EXP-01 外部集成实验 + 测试泄漏修复
**结果**:
- Commit 46cbfbb: v0.4 cleanup — A2A dead types 删除 + E2E 对齐 + v0.3 schemas 移除
- 状态报告 v1→v2 重写：从"工作总结"改为"可决策文档"。4 轮 Commander 审计。删除自评分，增加证据索引表，结论收紧为 3 句话
- 实验规格 `docs/experiment-external-integration.md` 编写。5 轮 Commander 审计修正接口契约（receiver_id + envelope body、sender 注册前置、data.delivery 字段名、onMessage 日志 vs 不存在的回复 Envelope）
- **EXP-01 执行通过**：外部 Claude 在 SKILL.md + 最小任务提示下 ~60s 完成受控接入。送钟禁忌场景，zh-CN Agent 准确适配
- SKILL.md 修复：Sending 章节增加 `chorus_version: "0.4"` 为必填字段（EXP-01 发现的文档缺陷）
- **jest 泄漏根因修复**：`src/server/routes.ts` 两处 AbortController 120s timeout 在 catch 路径不清除 → 改为 finally 块。3 个测试文件 `jest.spyOn(global, "fetch")` → 模块级 `global.fetch = jest.fn()`
- 141 tests, 82.56% coverage, 干净退出无警告

**决策**:
- 状态报告结论锚定为：技术可用已初步验证 / 采纳价值尚未验证 / 外部接入仍有信任边界未封口
- 身份边界分层澄清：L1/L2 永远不管 auth，L3 可定义可选 auth profile，Chorus 不运营 PKI/CA
- EXP-01 结论边界：受控环境 + SKILL.md + 最小任务提示 + 高能力 Agent。文化适配效果不能单独归因协议增益（含 personality prompt）
- 不接受 forceExit 作为泄漏修复方案 — 必须定位并消除根因

---

### 2026-03-20 14:00（旧条目保留供上下文）

**操作**: Phase 5 全量提交 + Phase 6 参考实现对齐 v0.4 协议
**结果**:
- Commit 67ab683: Phase 5 全量提交（78 files, +4053 lines）— PROTOCOL.md v0.4 + SKILL.md + TRANSPORT.md + npm CLI + Gene Bank + 跨平台验证 5/5
- Commit d8f4f5d: 参考实现对齐 v0.4（18 files, -868 +393 = net -475 lines）
- types.ts: Envelope v0.4 — `sender_id`(name@host) + `original_text` 替代 `original_semantic`，删除 `intent_type`/`formality`/`emotional_tone`
- transport 层: `sender_agent_id`+`target_agent_id`+`message`(A2A) → `receiver_id`+`envelope`(裸信封)
- LLM 调用从 2 次减为 1 次: 删除语义提取调用（`original_text` 就是原始输入），只保留 `cultural_context` 生成
- receiver 返回协议级 `{ status: "ok" }` 替代 `successResponse()` 包装
- 错误码对齐: `ERR_SENDER_NOT_REGISTERED`, `ERR_AGENT_NOT_FOUND`, `ERR_VALIDATION`
- Agent ID 默认格式 `agent-{culture}@{host}`
- 141 tests PASS, tsc 零错误, coverage 82.82%

**决策**:
- A2A 包装层从传输路径完全移除 — 发送裸 envelope 更简单、更符合协议精神
- 语义提取 LLM 调用删除 — 协议 v0.4 定义 `original_text` 就是原始文本，Agent IS the LLM 不需要"提取语义"
- receiver 响应格式改为协议级（非 API 包装）— 协议定义的响应格式应优先于框架约定
- A2A types (TextPart/DataPart/A2AMessage) 保留在 types.ts 但不再被传输路径使用 — 向后兼容，未来可清理

### 2026-03-21 16:00–17:00

**操作**: Phase B — Public Alpha Hub 设计冻结 + 代码实现 + Fly.io 部署 + 公网验证 + 监控体系
**结果**:
- `docs/server/public-alpha-plan.md` 设计冻结稿（Commander APPROVED）
- `docs/server/public-alpha-operator-guide.md` Fly.io 运维手册
- `docs/server/public-alpha-user-guide.md` 外部 tester 接入指南（Commander 重写版）
- 代码变更：`src/server/rate-limit.ts`(新建) + `registry.ts`(agent上限+计数器) + `routes.ts`(well-known/health增强) + `index.ts`(串接全部中间件)
- `fly.toml` 创建：单机 sjc shared-cpu-1x/256MB
- Fly.io 部署成功：`chorus-alpha` app, 域名 `chorus-alpha.fly.dev`
- 公网 happy path 8/8 通过：health/well-known/register/discover/send/auth-reject/counters
- 公网负向 smoke 9/9 通过：重复注册幂等/错误schema/空body/非JSON/不存在receiver/缺字段envelope/目标5xx/目标不可达/计数器递增
- 并发测试通过：10并发注册 0 丢失，5并发投递 0 失败，70并发限流 49 个 429
- 持久化验证：重启后 registry 清空（符合设计）
- 175 tests, 82.6% functions, 83.7% lines coverage
- `bin/alpha-smoke.sh` 自动化 14 项 smoke 脚本
- `bin/alpha-probe-light.sh` JSONL 健康探针 + `bin/alpha-probe-report.sh` 24h 汇总
- UptimeRobot 外部监控就位：5min 间隔，100% uptime，198ms 平均延迟
- 本地 cron 双轨：10min 轻探 + 2h 深探

**决策**:
- 域名 `alpha.chorus.sh`（确认，DNS 待绑定），当前用 `chorus-alpha.fly.dev`
- Fly.io 为部署平台（~$3/month，单机足够 alpha）
- API key 手动分发，per-tester 独立 key，可随时撤销
- 单机部署（Fly 默认创建 2 台导致 in-memory registry 不一致，已删除第二台并锁定 max=1）
- `auto_stop_machines = "off"` 保持 hub 持续在线
- 监控架构：外部 UptimeRobot（独立证据）+ 本地 cron（深度链路验证）
- 24h 后跑 `bin/alpha-probe-report.sh` 出持续性证据汇总

### 2026-03-22 — SQLite 持久化 + 安全加固

**操作**: Hub 从内存状态迁移到 SQLite 持久化，含 3 轮 Commander 审查修复
**结果**:
- `src/server/db.ts` 新建：SQLite 初始化 + WAL + 迁移系统（SCHEMA_VERSION=2）
- `src/server/registry.ts` 重写：Map → prepared SQL statements，API key SHA-256 哈希存储
- `src/server/message-store.ts` 重写：Map → SQL table，消息持久化
- `src/server/activity.ts` 重写：内存数组 → SQL + 内存 pub/sub 混合
- `src/server/index.ts` 更新：DB 连接 + 优雅关闭（server.close → db.close → exit）
- `Dockerfile` 更新：`/data` volume + `CHORUS_DB_PATH` 环境变量
- `CHANGELOG.md` 新建：v0.4.1 release note + operator migration checklist
- `tests/server/db-migration.test.ts` 新建：v1→v2 升级路径验证（磁盘文件模拟）
- `tests/helpers/test-db.ts` 新建：`:memory:` 测试 DB 工厂
- 全部 8 个 server 测试文件更新为 SQLite-backed
- 21 test suites, 256 tests all green, tsc clean
- README 更新：删除 "In-memory only" 限制

**决策**:
- SQLite with thin boundary（不建通用 StorageProvider）— 先解决状态问题，再谈可替换性
- API key SHA-256 哈希存储 — 高熵 key 不需要 bcrypt，DB 备份不暴露凭据
- Schema v1→v2 migration：DROP 旧 api_keys 表（明文）+ 重建为 api_key_hash — 旧 key 不可恢复，agent 需重新注册
- busy_timeout=5000ms — SSE 并发读写防 SQLITE_BUSY
- inbox.ts 不持久化 — SSE 连接天然临时态
- per-agent 消息上限移除 — 磁盘存储不需要内存保护，未来可加 DB 级 retention

### 2026-03-22 18:30 — MVP 阻断项清除 + 运维闭环

**操作**: 修复 agent_id 所有权漏洞 + 备份恢复闭环（脚本+演练+文档+smoke test）+ rollout 文档重写
**结果**:
- `src/server/routes.ts`: POST /register 新增所有权守卫 — agent_id 已存在时要求 Authorization 持有当前 key，否则 409 ERR_AGENT_EXISTS
- `tests/server/self-register.test.ts`: 原无条件轮换测试替换为 3 条（无 key 拒绝 / 错 key 拒绝 / 正确 key 允许轮换）
- `scripts/backup-db.ts`: 备份脚本，使用 better-sqlite3 online backup API
- `tests/server/backup.test.ts`: smoke test — 通过 npm run db:backup 入口创建备份并验证 agent/消息/activity 完整恢复
- `docs/server/backup-and-restore.md`: 操作文档（备份/恢复步骤/保留内容/cron 示例）
- `docs/server/sqlite-production-rollout.md`: 从提案文档重写为当前状态+剩余缺口文档，经 4 轮 Commander 审查
- 恢复演练通过：seed data → backup → restore → verify all data intact
- 22 suites / 259 tests 全绿

**决策**:
- agent_id 所有权修复选最小方案：路由层检查，不改 registry 接口 — 注册仍免鉴权，重注册需证明所有权
- 备份用 better-sqlite3 backup API 而非 VACUUM INTO — 前者支持在线备份，后者锁表
- 备份入口统一为 npm run db:backup — 消除 tsx/ts-node 分歧，测试直接覆盖 npm script 入口
- rollout 文档不写优先级排序（无生产数据支撑），磁盘阈值标 [Uncalibrated]
- MVP 发布边界定义：alpha 与产品的分界线是"用户可信任注册不被接管" + "数据不无声消失"

### 2026-03-22 19:30 — 100 并发容量验证 + 压测工具链 + 备份生产化

**操作**: 建立可量化的容量验证体系，补齐压测观测、脚本、webhook 路径、备份生产链路
**结果**:
- `/health` 增强：新增 `process_rss_bytes`, `process_heap_used_bytes`, `db_size_bytes`, `wal_size_bytes`, `sqlite_busy_errors` 6 项指标 + onError SQLITE_BUSY 计数器
- `scripts/load/` 新建 4 个压测脚本：`lib.ts`(共享库) + `sse-soak.ts`(场景A) + `send-burst.ts`(场景B) + `send-webhook-burst.ts`(场景C) + `soak-test.ts`(场景D)
- 本地压测 4 场景全 PASS：
  - 场景 A: 100 SSE 连接 2min 保持，0 断连
  - 场景 B: 100 并发 SSE burst，p95=50ms, 5xx=0, SQLITE_BUSY=0
  - 场景 C: 100 并发 webhook burst（内置 stub echo server），p95=128ms, 5xx=0, 超时=0
  - 场景 D: 30 agents 5min soak，p95=3ms, 内存增长 1.1%, WAL 稳定
- 备份脚本生产化：`scripts/backup-db.ts` → `src/scripts/backup-db.ts`，纳入 tsc 编译，产出 `dist/scripts/backup-db.js`
- `package.json` `db:backup` 改为 `node dist/scripts/backup-db.js`（生产镜像可直接执行，不依赖 ts-node）
- `docs/server/capacity-report.md` 定位为"本地预筛通过"，非发布结论
- `fly.toml` 已更新为 `shared-cpu-2x` / `2048mb` / volume mount `/data`
- 22 suites / 259 tests 全绿

**决策**:
- 本地预筛不等于发布结论——线上内存/IOPS/网络延迟会改变结果，最终容量数字需线上复测
- 备份方案用 SQLite backup API（WAL 安全），不用 fly sftp（拷主库不等于一致性备份，-wal/-shm 不处理会丢数据）
- 备份脚本纳入 tsc 编译（方案 1），不依赖 ts-node 进生产镜像——better-sqlite3 是生产依赖，ts-node 不是
- webhook burst 需内置 stub server 才能测，localhost 回环不等于真实网络延迟
- 部署内存从 256MB 提升到 2GB——进程 RSS 460MB 起步，256MB 必 OOM

### 2026-03-22 22:30 — 线上容量验证通过 + SSE heartbeat + 真实 Agent 通信测试

**操作**: 线上 4 场景压测 + 结构性修复 + capacity-report 收口 + 双 Agent 真实通信测试
**结果**:
- 线上 4 场景全 PASS：
  - 场景 A: 100 SSE 连接 30min，0 断连，RSS 漂移 3.6% — 需 heartbeat + hard_limit 修复后才通过
  - 场景 B: 100 并发 burst，100/100 成功，5xx=0, 429=0, SQLITE_BUSY=0
  - 场景 C: 100 webhook burst（agchorus.com/webhook-stub），100/100 成功，p95=2044ms（公网边缘）
  - 场景 D: 30 agents 30min soak，1799 msg，p95=292ms，SSE 0 断连，WAL 3.9MB 稳定
- 备份验证：soak 后 800KB 一致性备份成功
- SSE heartbeat：`inbox.ts` 每 20s 发 `:ping\n\n` 注释帧（修复 Fly proxy idle kill）
- hard_limit：100→150，soft_limit：80→120（给 health/admin 留余量）
- webhook-stub：`/webhook-stub` 路由 + auth 白名单（场景 C 零外部依赖）
- 压测脚本健壮化：`withNetworkRetry` 包装 register/connectInbox，health 轮询 try-catch 降级
- capacity-report.md 全量重写：本地+线上对照，带边界条件的发布结论
- 限流恢复：`fly secrets unset` 恢复生产值 60/120，fly.toml 为唯一真相源
- 测试 agents 清理：100 个 loadtest-a* 全部 DELETE
- 双 Agent 通信测试（小V@微信 + 小X@Telegram）：
  - 注册成功，hub 确认 message_delivered_sse
  - 发现 3 个体验问题：(1) agent 不主动开 inbox (2) 收到消息不主动通知人类 (3) 跨语言不翻译
  - 根因判定：SKILL.md 是被动知识，OpenClaw 缺少 Chorus 桥接插件
- SKILL.md/SKILL.zh-CN.md 更新：注册+开 inbox 合为一个流程，接收消息必须立即主动告诉人类

**决策**:
- SSE heartbeat 20s 是最低保活频率——Fly proxy idle timeout 未公开，20s 安全
- hard_limit 150 = 100 SSE + 50 余量，不能等于 MAX_AGENTS
- 容量结论必须带边界条件，不可无条件声称"支持 100 并发"
- webhook-stub 是压测辅助路由，压测完可删（当前保留）
- 限流策略：fly.toml 是唯一真相源，secrets 仅用于临时覆盖
- Agent 端体验问题不是 hub 能解决的——需要 OpenClaw 侧写 Chorus 桥接插件
- SKILL.md 软约束有限，真正的解法是平台级硬桥接（后台 SSE 监听 + 主动推送到人类渠道）

### 2026-03-23 01:00 — chorus-bridge 插件实现 + 运行验收进行中

**操作**: 按 `docs/chorus-bridge-plugin-spec.md` v8 实现 OpenClaw chorus-bridge 插件，经 2 轮 Commander 代码审查 + 运行验收
**结果**:
- `~/.openclaw/extensions/chorus-bridge/index.ts` 新建（~760 行）：完整单路径实现
- `~/.openclaw/extensions/chorus-bridge/package.json` + `openclaw.plugin.json` 新建
- 跨插件 import 难题解决：jiti + `openclaw/plugin-sdk` alias，probe 3/3 模块 PASS
- `~/.chorus/config.json` 从 `xiaox@chorus` 切到 `xiaov@openclaw`（找回历史 API key）
- `plugins.allow` 加入 `chorus-bridge`，`openclaw.plugin.json` 补 `configSchema`
- gateway restart 成功加载插件：probe OK → catch-up 17 rows → SSE connected agchorus.com
- 代码审查 2 轮整改：(1) validateSSEPayload 改用共享 ChorusEnvelopeSchema.safeParse (2) discoverWeixinAgent 删除→resolveDeliveryTarget(agentName) (3) probe 补完整函数存在性检查
- `api.registerHook` → `api.on("gateway_start")` 修复异步 hook 不触发问题
- Map 同一性已验证：两个 jiti 实例共享同一 getContextToken 函数引用
- 当前阻塞：contextToken 冷启动——gateway restart 清空进程 Map，需人类先发微信消息刷新后再触发投递

**决策**:
- jiti 是正确的跨插件 import 方案——native `import()` 无法处理 `.js`→`.ts` ESM 重映射
- `api.on()` 替代 `api.registerHook()` 用于 async 的 gateway_start hook
- CHORUS_PROJECT 硬编码为 `/Volumes/XDISK/chorus`（spike 接受，后续收掉）
- contextToken 冷启动是已知限制（spec P1 blocker），不是代码 bug
- Commander 手动添加了 `AGENT_CULTURE_MAP` 常量（spike hardcoded receiver culture preferences）

### 2026-03-23 02:00 — chorus-bridge 最终收口

**操作**: 完成 bridge 最终 runtime 验收与文档收口，确认不再存在运行级阻塞项
**结果**:
- 文档线 PASS：`docs/chorus-bridge-plugin-spec.md` + `docs/chorus-bridge-acceptance.md` 继续作为实现/验收基线
- Hub invite gating PASS：`/register` 保留最小 `invite_code` gating，未恢复 ownership guard、`ERR_AGENT_EXISTS` 或 `/webhook-stub`
- bridge 实现 PASS：`~/.openclaw/extensions/chorus-bridge/index.ts` 载荷中显式加入接收侧语言约束与 `must_adapt`
- runtime live path PASS：新消息从 `xiaox@chorus` 到 `xiaov@openclaw` 成功送达微信，history 写入 `dir:"inbound"`，seen 更新
- startup backlog drain PASS：重启后的 Phase 3 `retryPending` 在 token 可用时清空 9 条历史 pending
- auto-drain path PASS：新消息成功投递后自动触发 `auto-drain scheduled`，`retrying 3 pending`，`retry: 3/3 succeeded`
- translation gate PASS：微信侧实际收到中文转述，不是英文原样直出
- 后续会话只剩文档收尾，不再把 bridge 视为运行阻塞项

**决策**:
- bridge 结论从 `CONDITIONAL` 收束为 `PASS`
- runtime 验证以真实微信显示、`history`、`seen.json`、`inbox` 和日志五路证据为准
- 不再重开 contextToken 冷启动、auto-drain 是否生效、英文是否会原样直出的旧争议
- 后续只做文档同步，不再继续改 bridge 核心实现

### 2026-03-23 18:00 — 术语统一：human → user（受控范围）

**操作**: 跨 20 个英文/通用文件执行 "human" → "user" 术语统一，后根据 Commander 整改清单精确回退
**结果**:
- 第一轮：全面替换 human → user（20 文件，~120 处）
- Commander 整改：建立判定规则，回退过度扩散的改动
- 最终保留：仅"明确终端用户语境"（your user / its user / the user = agent 服务的那个人）
- 已回退：human-visible / human-facing / Human-visible 全部恢复（技术/发布术语冻结）
- 已回退：bridge 层全部注释/日志/prompt 恢复原词（与变量名 humanText 保持一致）
- 已回退：TRANSPORT.md L123 "agents' users" → "agents' people"
- 已回退：linkedin "manual corrections" → "human corrections"
- 已回退：release-0.4.0 "external developer" → "external human developer"
- 已回退：github-release-package 中的 "user says" / "reported to user" 恢复 human

**决策**:
- 术语边界不是 human vs machine（物种），而是 user-facing vs chorus-facing（audience / route boundary）
- human-visible / human-facing / human-readable / human corrections / human intervention → 冻结为技术术语，不做机械替换
- 快速判定规则：能替换成"这个 agent 的服务对象"且语义不变 → 用 user；否则保留 human
- bridge 代码变量名（humanText, diagnoseHumanText）→ 未动，等后续单开任务整套重命名
- 中文对应词：human=终端用户时 → 用户；human=可见/可读/非静默时 → 人可见 / 可见

### 2026-03-23 19:00 — 3号：中文文件术语执行明细

**操作**: 按两轨规则执行 3号 管辖的 7 个中文文件
**结果**:
- SKILL.zh-CN.md source: 31 处 "人类"→"用户"（全部为第 1 轨：终端用户）
- SKILL.zh-CN.md npm template: 28 处（同步 source）
- PROTOCOL.zh-CN.md ×2: "人类可读"→"便于阅读的"（第 2 轨：可读性）
- README.md 中文段: 3 处（"告诉用户"/"另一位用户"/"用户看 HTML"）
- launch-kit 中文段: "人类可见"→"人可见" ×3 + "转告用户" ×1
- launch-announcement 中文段: "人类可见"→"人可见" ×1
- 初次误判：PROTOCOL "人类可读"→"用户可读"（收窄语义），已回退为"便于阅读的"
- 初次误判：launch-kit/announcement "人类可见"→"用户可见"，已回退为"人可见"

### 2026-03-23 05:00–06:10 — 1号：Bridge 运行验证 + Hub store-and-forward + Session isolation 回归

**操作**: Chorus bridge 多轮实测验证，含 Hub 新功能实现 + bridge 架构缺陷发现
**结果**:
- Hub store-and-forward 实现完成：offline receiver → HTTP 202 queued → poll retrieval。DB v2→v3 migration（CHECK constraint 加 'queued'）。新增 `recordQueued()` + `messages_queued` stat。268→273 tests, 80.7% coverage
- xiaox 全套设定文件转英文（SOUL/IDENTITY/AGENTS/TOOLS/USER/HEARTBEAT/MEMORY.md）
- xiaox 中文记忆/心跳/日记转移到 `_zh-archive/`，替换为空英文版
- Bridge session isolation 验证（4号修复后）：chorus session key `chorus:xiaox:xiaov@openclaw` 与 human session `agent:xiaox:main` 隔离 PASS
- User session clean after chorus: Owen "hi" → 纯英文回复，无 `[chorus_reply]` PASS
- Self-send filter: xiaov 不再处理自己发出的 chorus 消息 PASS
- Agent context matches config: xiaox `[context]` 日志 culture=en lang=en mustAdapt=true PASS
- 反向链路 xiaox→xiaov: FAIL — Hub 返回 delivered_sse，bridge SSE listener 收到并存入 inbox，但 processMessage 未执行。根因：gateway jiti 缓存未加载 05:57 版代码（零条 [sse-recv] 日志）

**决策**:
- 截图解读修正：05:45 Telegram 中文消息 ≠ xiaov 原文泄漏到 Telegram。正确理解：一条是 chorus 入站回复，一条是 xiaov→user 的正常微信内容
- Session isolation 设计：chorus 入站必须用独立 session key，不能与人类通道共用主会话（防止 reply_format 指令持续污染后续 turn）
- Hub SSE push 可靠性待查：Hub 标记 delivered_sse 但 bridge client 未消费的场景已出现 2 次（e89196f2, de3a2828）

### 2026-03-26 — Insights 报告分析 + Scope Guard 物理防线 + CLAUDE.md 行为红线

**操作**: 基于 Claude Code Insights 使用分析报告，翻译中文版，评估建议，落地范围锁定防线
**结果**:
- Insights 报告翻译为中文版 → `~/.claude/usage-data/report-cn.html`
- CLAUDE.md 新增 `## 行为红线 (Behavioral Guardrails)` 6 条规则（防止无故停止循环、盲目应用反馈、基于部分上下文假设范围、提交不完整文档、编造功能、跳过历史记忆）
- Scope Guard 三层物理防线落地：
  - L1: `.claude/hooks/scope-guard.sh` — UserPromptSubmit 钩子，新任务时注入范围检查提醒
  - L2: `.claude/hooks/edit-scope-check.sh` — PreToolUse 钩子（预留，当前放行模式）
  - L3: `.claude/settings.json` — 钩子配置注册
- Insights 建议评估：Custom Skills（已有 Fusion 覆盖，无增量）、Hooks（TypeScript 类型检查有价值但示例错配）、Headless Mode（简单定期审计适合）、并行文档管线（非开发类文档未套 swarm）、TDD 循环（已有 fusion-tdd 完全覆盖）、范围锁定（最有价值，已落地）

**决策**:
- 范围锁定是 39 次"方向错误"的根因对策，选择 UserPromptSubmit 注入式提醒（轻量）而非 defaultMode:plan（太重）
- 参考 GitHub 最佳实践：zulip/zulip（understand→propose→implement→verify）、CodySwannGT/lisa（三层防御）、dagster-io/dagster（ExitPlanMode 拦截）
- 不用 defaultMode:plan 的原因：Commander 工作模式经常需要 Claude 直接执行，强制 plan mode 拖慢节奏

---

### 2026-03-23 22:00 — 4号：Receive Chain Observability（收件链路全链路 trace 日志）

**操作**: 针对 xiaox→xiaov 反向链路 FAIL（Hub delivered_sse 但 bridge 无处理日志），为收件链路每个决策点加 trace 级日志
**结果**:
- SSE 路径 6 个 trace 点：`[sse-recv] event received` / `validation failed` / `already seen` / `saving to inbox` / `processMessage returned false` / `JSON parse error`
- catch-up 路径 6 个 trace 点：`[catch-up] row` / `skip receiver` / `already seen` / `validation failed` / `saving to inbox` / `processMessage returned false`
- `validateSSEPayload` 3 个失败分支：`not an object` / `missing trace_id` / `missing sender_id` / `invalid envelope`
- `processMessage` 入口 `[process] START` + 7 个 FAIL reason + `[process] SUCCESS`
- SSE 建连日志增加 `agent_id`（可区分 xiaov 和 xiaox 的 SSE 连接）
- 全部 91 bridge tests + 29 CLI tests 通过
- Template synced to package

**决策**:
- 断点需 live 日志定位：如果下次运行没有 `[sse-recv] event received` → SSE 连接本身有问题；有 recv 但没 START → 被某个过滤器拦截；有 START 但有 FAIL → reason 字段直接告诉哪个 pre-check 挂了

### 2026-03-27 — 同 route 严格顺序证明（进行中，未冻结）

**操作**: 为 backlog 阶段后的下一优先级任务补做 same-route strict-order live proof；先修实现缺口，再跑 repo 回归和真实样本
**结果**:
- 先发现实现缺口：架构要求同一 `route_key` 的 outbound `reply_bound -> relay_submitted -> relay_confirmed` 串行，但 runtime-v2 实际是分别调用 `bindReply()` / `submitRelay()` / `confirmRelay()`，没有 route 级原子路径
- repo 侧新增 route 级原子出口：`src/bridge/outbound.ts` 增加 `RouteLock` 和 `OutboundPipeline.relayReply()`，将三步合并到一个受 `route_key` 锁保护的方法
- template 侧收敛调用点：`packages/chorus-skill/templates/bridge/runtime-v2.ts` 两个 reply relay 路径都改为调用 `relayReply()`
- 测试补强：`tests/bridge/outbound.test.ts` 新增 same-route 并发回归；`tests/bridge/runtime-v2.test.ts` 同步 fake pipeline
- repo 验证通过：
  - `npx tsc --noEmit`
  - `npx jest --runInBand --coverage=false tests/bridge/outbound.test.ts tests/bridge/runtime-v2.test.ts`
  - `npx jest --runInBand --coverage=false tests/bridge` → `122/122` 通过，但仍打印既有 Jest open-handle 告警
- 为了让 live runtime 真正走新原子路径，本机安装态 `~/.openclaw/extensions/chorus-bridge/runtime-v2.ts` 也同步改为调用 `relayReply()`，随后执行 `openclaw gateway restart`
- same-route live proof 已拿到真实样本：单个 sender `same-route-probe-1774532711053@chorus` 向 `xiaoyin@chorus` 连发两个同 `conversation_id` 消息，Hub 两次都返回 `delivered_sse`
- 真实样本三证闭环：
  - inbound traces: `ec748774-b6f8-408f-a519-d959484594ff` / `4cf9c5a5-f61b-46a4-a2ea-99cf3a52ef23`
  - relay traces: `072767b9-9acd-4f23-abbc-ca1f764362b3` / `8ba1be3c-b67b-4220-b748-cff2c7985e0c`
  - same route continuity: `last_inbound_turn=2` / `last_outbound_turn=2`
  - state 落点：`/Users/owenmacmini/.chorus/state/xiaoyin/xiaoyin@chorus.json:54` / `:160` / `:179` / `:251` / `:261`
  - gateway 日志落点：`/Users/owenmacmini/.openclaw/logs/gateway.log:2439` / `:2440` / `:2448` / `:2449` / `:2450` / `:2451`
- 当前 repo 工作树仍未冻结：`src/bridge/outbound.ts`、`packages/chorus-skill/templates/bridge/runtime-v2.ts`、`tests/bridge/outbound.test.ts`、`tests/bridge/runtime-v2.test.ts` 处于未提交状态

**决策**:
- 同 route 顺序证明不能建立在“多步 relay API 由 runtime 分散调用”的实现上；必须先把 runtime 收敛到 route 级原子出口
- live proof 必须对准真实运行态；仅修改 repo template 不足以证明本机 OpenClaw extension 已使用新路径
- 当前只保存“same-route 严格顺序真实样本已取得、repo 修复未提交”的记忆，不提前冻结为正式阶段结论

### 2026-03-28 — same-route 证明冻结 + 人工验收判定

**操作**: 将 same-route strict-order 真实样本转成正式证据，并对“现在能不能发”做人工验收判定
**结果**:
- same-route 证据冻结完成：[`pipeline/bridge-v2-validation/evidence/S-03-13-same-route-strict-order.md`](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/evidence/S-03-13-same-route-strict-order.md)
- 证据链闭环：repo 改动 + 本机 state + gateway log 三路一致，确认同一 `route_key` 上两次 reply relay 以 `bound_turn_number=1 -> 2` 严格顺序落地
- 当日 repo 验证通过：
  - `npx tsc --noEmit`
  - `npx jest --runInBand --coverage=false tests/bridge/outbound.test.ts tests/bridge/runtime-v2.test.ts` → `20/20` PASS
  - `npx jest --runInBand --coverage=false tests/bridge` → `122/122` PASS
- 现存残留：Jest 仍打印既有 open-handle 告警；当前判定为测试清洁度问题，不是 same-route 证明失败
- 人工验收文档落地：[`pipeline/4_delivery/manual-acceptance-2026-03-28.md`](/Volumes/XDISK/chorus/pipeline/4_delivery/manual-acceptance-2026-03-28.md)

**决策**:
- 现在批准的发布面：invite-only alpha internet release
- 现在不批准的发布面：正式广域公开发布 / 任何超出 "invite-gated alpha" 的对外承诺
- Bridge v2 历史验证包仍以 [`CONDITIONAL`](/Volumes/XDISK/chorus/pipeline/bridge-v2-validation/final-verdict.md) 为冻结结论；2026-03-23 那条“收束为 PASS”的记忆只代表当时运行阻塞项已清，不再视为更高优先级的最终口径

### 2026-03-28（修正）— release-now 判定回撤到 FAIL

**操作**: 核对 live gate truth，纠正先前把发布面写成 “invite-only alpha” 的错误判定
**结果**:
- live `/health` 实测：`https://agchorus.com/health` 在 `2026-03-27T17:18:28.820Z` 返回 `"invite_gating": false`
- live 匿名自注册实测：`POST https://agchorus.com/register` 在 `2026-03-27T17:19:56.150Z` 返回 `201`
- 结论修正：当前互联网表面是真实 `public alpha + self-registration enabled`，不是 `invite-only alpha`
- 发布判定文档已改为 [`pipeline/4_delivery/manual-acceptance-2026-03-28.md`](/Volumes/XDISK/chorus/pipeline/4_delivery/manual-acceptance-2026-03-28.md) = `FAIL`
- 新增 gate 脚本：[`bin/release-gate.sh`](/Volumes/XDISK/chorus/bin/release-gate.sh)

**决策**:
- 不批准任何建立在 “invite-only alpha 已通过” 前提上的发布动作
- 当前批准的唯一下一步：整理 release-ready 变更，先修 gate truth，再谈发布

### 2026-03-28（续）— Jest 门禁从 heuristic warning 改为 explicit handle detection

**操作**: 追查 bridge test 的 "Jest did not exit one second after the test run has completed" 告警，缩到最小组合后改 release gate 判定方式
**结果**:
- 缩小范围：`tests/bridge/outbound.test.ts`、`tests/bridge/runtime-v2.test.ts` 单跑干净；脏退出出现在含 `hub-client` / `inbound` 的组合
- `--detectOpenHandles` 对最小脏组合和 `tests/bridge` 全量均未输出具体非标准句柄
- 用 `node -r ./tmp/inspect-active-handles.js ...` 观察到的活句柄只有 stdio `Socket`
- [`bin/release-gate.sh`](/Volumes/XDISK/chorus/bin/release-gate.sh) 不再 grep Jest 的 heuristic warning，而改为 `npx jest --runInBand --coverage=false --detectOpenHandles tests/bridge`

**决策**:
- release gate 以 explicit handle detection 为准，不再把 Jest 的模糊提示语当成硬失败条件

### 2026-03-28 — Codex 产出审查 + 代码整改

**操作**: 审查 Codex 的 Bridge v2 加固产出（5 commits, `03770f5..35b16d3`），识别规范违规，执行代码整改
**结果**:
- 审查报告冻结：`pipeline/bridge-v2-validation/codex-review-2026-03-28.md`（commit `a724eed`，hash 回填 `3fa03a7`）
- 整改落地（4 项）：
  - H-02: `bin/probe-sse-timestamp.sh` + `bin/release-gate.sh` 的 `json_field()` 从 Function 构造器改为 `split('.').reduce()` 安全路径访问
  - M-01: `src/bridge/live-acceptance.ts` 6 处 + `src/scripts/probe-bridge-live.ts` 2 处 `let` 消除（reduce/find/some/chunks[]/递归 pollLoop）
  - M-02: `compareCursorPosition` 从 `state.ts` export，`recovery.ts` import（消除重复定义）
  - M-03: 13 个文件 `Author: Codex` → 合法兵种名
- 未修复：H-01（分支覆盖率低于 80%）
- 验证：`npx tsc --noEmit` 通过；`npx jest --runInBand --coverage=false` 32 suites / 429 tests 全绿，did-not-exit 告警仍存在（已有问题）
- Commander 三轮审查纠偏：v1.0→v1.1（精度收紧）→v1.2（整改标记）→v2.0（当前态重写）

**决策**:
- Codex 功能正确性达 A 级，规范遵守是主要短板（未读 `.claude/rules/`）
- `recovery.ts:169` 的 `for (let ...)` 是规则允许的 for-loop 例外，不计入违规
- 报告中的覆盖率不锚定精确百分比，只断言"低于 80%"
- 当前真实剩余阻塞收敛为：same-route 修复尚未冻结成提交 + Bridge v2 总体验证包仍是 `CONDITIONAL`

### 2026-03-29 — Onboarding/Activation 产品缺陷修复 + Cold-Start 验收

**操作**: 诊断 MacBook 空白 OpenClaw 安装后 bridge disabled 根因，修复凭证双轨不通、verify 假阳性、源码路径硬依赖三个缺陷
**结果**:
- 根因诊断：安装器创建空 `~/.chorus/agents/`，但整个流程中无任何环节创建 bridge 所需的凭证文件；SKILL.md 说"bridge 自动处理"但 bridge 处于 disabled 状态
- 3 个 Worker 并行修复（独立 worktree，零冲突合入）：
  - W1 `094c684`: verify exit 1 on standby + 文档对齐
  - W2 `c2217fc`: workspace 凭证加载 + 5s 轮询热激活
  - W3 `a649f13`+`1dec0b4`: SKILL.md 冷启动激活语义 + acceptance spec
- 收口轮 `67b8c28`: 统一主路径为 `~/.openclaw/workspace/chorus-credentials.json`
- 源码路径硬依赖修复 `0b9aad5`+`8ae072c`: 9 个运行时模块打包进 extension/runtime/，jiti alias 解析 zod
- MacBook cold-start 验收 PASS `3e41bf1`: 无 XDISK、无源码仓库，V2 bridge active
- 523 tests / 36 suites 全绿
- 发现 OpenClaw Gateway 问题：chorus-bridge 插件加载阻断 Telegram channel 启动（不在 Chorus 范围）

**决策**:
- Commander 关单 onboarding/activation 缺陷
- E2E 内容对话验收被 OpenClaw Gateway 插件-channel 互斥问题阻塞，不在本轮修复范围
- cold-start evidence 冻结为基础设施路径验收（install→credentials→activation），agent 行为路径待 Telegram 恢复后单独验证

### 2026-03-30 13:00

**操作**: npm 发布整改（3 轮 rectification list）+ P0-01 已发布包可用性闸门
**结果**:
- v0.8.0-alpha 发现 baseline 错误（缺 10 commits），retroactive tag + bump to 0.8.0-alpha.1 + npm publish
- `bin/pre-publish-check.sh` 创建：17 bridge files + 4 skill templates + tag==HEAD + registry clean
- P0-01 E2E 内容对话 PASS：
  - 从 npm 包干净重装（`chorus-skill uninstall` → `init --target openclaw`）
  - chorus-bridge + 4 Telegram bots 在同一 Gateway 进程共存（互斥问题已解决）
  - 完整链路：inbound SSE → agent content → `telegram_server_ack` (msg_id=120) → outbound relay
  - 互斥根因：旧安装从源码路径加载 runtime（heavy jiti），npm 包 bundled runtime 加载快，不阻塞 Telegram
- 证据入库：`pipeline/bridge-v2-validation/evidence/P0-01-*`（3 文件）
- monitor.md 更新：P0-01 行 `[x]` PASS
- release doc 更新：E2E 从 BLOCKED → PASS
- 远端同步：`d70f9d5` local = remote

**决策**:
- Commander 签字：P0-01 CLOSED (PASS)
- 不需要 alpha.2
- 不需要把 OpenClaw 标为产品阻断
- 互斥根因归属 Chorus 侧（源码路径加载），已在 npm 包中修复

### 2026-03-31 04:30 (P0-01 bidirectional + EXP-03 冷启动)

**操作**: P0-01 双向验证入库 + EXP-03 人类开发者冷启动执行 + 3 个 IMPL 缺陷修复
**结果**:
- P0-01 bidirectional PASS (commit `2b33d4b`): xiaoyin↔xiaox 自主多轮对话，Commander 确认双侧 Telegram 人类可见
- EXP-03 规格更新为当前架构 (SSE/agchorus.com/0.8.0)，冻结在 commit `af5288d`
- EXP-03 第一轮执行（MacBook test2，OpenClaw agent 给 GitHub URL）：
  - Agent 自主完成全链路：npm init → 注册 → 凭证保存 → Gateway restart → bridge active
  - IMPL 缺陷 #1: `no_delivery_target` — bridge 用 Chorus agent name 查 OpenClaw session，单 agent 环境名称不匹配（`goooo` vs `main`）
    - 修复: `resolveDeliveryTarget` 增加 fallback 扫描所有 agent dirs，单目标回退，多目标 fail fast
    - 发布 0.8.0-alpha.2 (commit `af5288d`)
  - IMPL 缺陷 #2: `no_culture_config` — 自动注册凭证文件不含 culture 字段
    - 修复: `resolveReceiverPrefs` 返回 null 时回退到 `{culture: "en", preferredLanguage: "en"}`
    - 发布 0.8.0-alpha.3 (commit `5c8042a`)
  - IMPL 缺陷 #3: `no_tg_bot_token accountId=default` — bridge 自带私有 Telegram 发送栈，直接读 `channels.telegram.accounts.{id}.botToken`，但单 agent 扁平配置的 botToken 在 `channels.telegram.botToken`
    - Commander 判定：**架构级问题**，不是 config path fallback 能修的。Bridge 不应耦合 Telegram 私有发送。应委托 OpenClaw 官方 channel helper
    - 任务下发: IMPL-EXP03-03 host delivery adapter 去私有发送栈

**决策**:
- EXP-03 冻结版本+文档运行（不预修已知摩擦点），让实验暴露盲点
- 每轮必须换新受试者（被污染的不能复用）
- Bridge 与 Telegram 解耦是架构级整改，不是简单 fallback
- 527 tests / 36 suites 全绿（alpha.2 和 alpha.3 均通过）

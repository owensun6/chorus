# Chorus Protocol — Progress Log

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

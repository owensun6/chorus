<!-- Author: Lead -->

# TASK_SPEC_T-08

**任务**: Agent CLI 入口 + 生命周期编排
**Assignee**: be-domain-modeler
**来源 F-ID**: F7
**Blocker**: T-02, T-03, T-04, T-07

## 输入

- `src/agent/envelope.ts`（T-02）: createEnvelope, createChorusMessage
- `src/agent/discovery.ts`（T-03）: discoverCompatibleAgents
- `src/agent/llm.ts`（T-04）: createLLMClient, extractSemantic
- `src/agent/receiver.ts`（T-07）: createReceiver
- INTERFACE.md 中 CLI: chorus-agent 参数表 + 启动/退出流程
- INTERFACE.md 中 POST /messages 请求体格式

## 输出

- `src/agent/index.ts`: CLI 入口
  - CLI 参数解析（--culture, --port, --router, --agent-id, --languages）
  - 启动流程: 创建 LLM client → 启动 receiver HTTP server → POST /agents 注册 → GET /agents 发现兼容 Agent → 进入 readline 循环
  - 发送消息: readline 输入 → extractSemantic → createEnvelope → createChorusMessage → POST /messages
  - 退出流程: SIGINT/exit → DELETE /agents/:id → 关闭 HTTP server → process.exit

## 验收标准（BDD 格式）

- Given: 有效的 CLI 参数 --culture zh-CN --port 3001 --router http://localhost:3000
  When: 启动 Agent
  Then: 解析参数成功，LLM client 创建，HTTP server 启动在 :3001

- Given: Agent 已启动
  When: 向路由服务器 POST /agents 注册
  Then: 注册成功（或重复注册更新），Agent 进入 readline 循环

- Given: Agent 在 readline 循环中
  When: 用户输入 "你好"
  Then: 调用 extractSemantic → createEnvelope → createChorusMessage → POST /messages 到路由服务器

- Given: Agent 在运行中
  When: 用户输入 "exit" 或按 Ctrl+C
  Then: DELETE /agents/:id 注销 → 关闭 HTTP server → 进程退出

- Given: DASHSCOPE_API_KEY 环境变量未设置
  When: 启动 Agent
  Then: 报错并退出，提示 "DASHSCOPE_API_KEY is required"

- Given: 路由服务器不可达
  When: Agent 尝试注册
  Then: 报错并退出，提示连接失败

## 测试规格

- 测试文件: `tests/agent/index.test.ts`
- test_case_1: CLI 参数解析 — 全部参数正确解析
- test_case_2: CLI 参数解析 — 缺少 --culture 报错
- test_case_3: 启动流程 — 注册 + 发现（mock HTTP）
- test_case_4: 发送消息 — 输入 → extractSemantic → envelope → POST /messages（mock 全链路）
- test_case_5: 退出流程 — SIGINT → DELETE + 关闭（mock HTTP）
- test_case_6: 环境变量缺失 — 报错退出

## 结构性约束测试

- immutability: N/A（入口文件负责编排，不涉及数据结构操作）
- error_handling: 注册失败 / LLM 不可用 / 路由服务器不可达 → 明确错误消息 + 非零退出码
- input_validation: CLI 参数 --culture 必填校验 + DASHSCOPE_API_KEY 环境变量存在性校验
- auth_boundary: N/A

## 禁止事项

- 禁止在 index.ts 中直接实现业务逻辑（信封创建/LLM 调用/HTTP 路由必须调用对应模块）
- 禁止修改路由服务器代码
- 禁止硬编码任何端口号或 URL（必须从 CLI 参数或默认值获取）

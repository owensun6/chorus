<!-- Author: Lead -->
# TASK_SPEC_T-08
**任务**: Demo 编排器 + Web 服务器 — 一键启动全组件
**Assignee**: be-api-router
**来源 F-ID**: F2.3, F2.4
**Blocker**: T-05, T-06, T-07

## 输入
- `src/server/index.ts` (现有 router server 启动逻辑)
- `src/agent/index.ts` (T-06: startAgent 含 history + streaming)
- `src/web/index.html` (T-07: 静态 HTML)
- `pipeline/phase2/1_architecture/INTERFACE.md` Section 四 (GET /events, POST /api/send, CLI chorus-demo)

## 输出
- `src/demo/index.ts` — 新建:
  - `startDemo(port?: number = 5000): Promise<DemoHandle>`
    1. 启动 Routing Server (port 3000)
    2. 启动 Agent zh-CN (port 3001, culture "zh-CN") + Agent ja (port 3002, culture "ja")
    3. 注册两个 Agent
    4. 启动 Web Server (port)
    5. 自动打开浏览器 `http://localhost:${port}` (使用 `open` 包或 child_process)
  - `DemoHandle { shutdown(): Promise<void> }` — 关闭所有服务
  - CLI 入口: `if (require.main === module)` 解析 `--port` 参数
  - SIGINT handler: graceful shutdown
- `src/demo/web.ts` — 新建:
  - `createWebServer(agents: Map<string, AgentHandle>, staticDir: string): Hono`
  - `GET /` — 返回 `index.html` (使用 Hono serveStatic 或手动 readFile)
  - `GET /events` — SSE endpoint:
    - 维护 client Set (ReadableStream controllers)
    - `broadcast(event: string, data: object): void` — 向所有 clients 发送 SSE
    - 事件类型: message_sent, adaptation_start, adaptation_chunk, adaptation_done, adaptation_error
  - `POST /api/send` — Zod 验证 `{ from_agent_id: string, to_agent_id: string, text: string (minLength 1) }`
    - 查找 from agent handle, 调用 `agent.sendMessage(to_agent_id, text)`
    - 返回 202: `{ success: true, data: { message_id: crypto.randomUUID() }, metadata: { timestamp } }`
    - agent 不存在 → 400; 发送失败 → 500

## 验收标准（BDD 格式）
- Given startDemo() 调用, When 全部服务启动, Then router(:3000) + 2 agents(:3001,:3002) + web(:5000) 均可访问
- Given GET /events 连接, When agent 发送消息, Then SSE 客户端收到 message_sent 事件
- Given POST /api/send `{ from_agent_id: "agent-zh-cn", to_agent_id: "agent-ja", text: "你好" }`, When 处理, Then 返回 202 + message_id
- Given POST /api/send 缺少 text, When 验证, Then 返回 400 + ERR_VALIDATION
- Given SIGINT 信号, When shutdown, Then 所有服务优雅关闭, 进程退出

## 测试规格
- 测试文件: `tests/demo/web.test.ts` (新建)
  - test_case_1: POST /api/send with valid body returns 202 + message_id
  - test_case_2: POST /api/send with missing text returns 400
  - test_case_3: POST /api/send with unknown agent_id returns 400
  - test_case_4: GET /events returns Content-Type text/event-stream
  - test_case_5: broadcast sends SSE event to connected clients
- 测试文件: `tests/demo/index.test.ts` (新建)
  - test_case_6: startDemo creates all 4 server instances
  - test_case_7: shutdown closes all servers

## 结构性约束测试
- immutability: broadcast 不修改 client set 中的 controller 状态; send payload 不被修改
- error_handling: agent.sendMessage 失败 → 500 JSON + broadcast adaptation_error; 端口冲突 → 报错并退出
- input_validation: POST /api/send body 使用 Zod schema 验证 (from_agent_id, to_agent_id: string, text: string min 1)

## 禁止事项
- 禁止修改 src/agent/index.ts, src/server/routes.ts 的已有导出
- 禁止在 web.ts 中实现 LLM 调用逻辑 (通过 AgentHandle.sendMessage 委托)
- 禁止引入除 Hono + open 之外的新运行时依赖
- 禁止硬编码 API key (必须读取 DASHSCOPE_API_KEY 环境变量)

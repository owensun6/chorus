<!-- Author: Lead -->

# TASK_SPEC_T-05

**任务**: 路由服务器 — Agent 注册/发现 CRUD
**Assignee**: be-api-router
**来源 F-ID**: F5
**Blocker**: T-01

## 输入

- `src/shared/types.ts` 中的 AgentRegistration、AgentCardSchema 类型
- INTERFACE.md 中 POST /agents、GET /agents、GET /agents/:id、DELETE /agents/:id 完整契约
- 标准化响应格式（patterns.md）

## 输出

- `src/server/registry.ts`: AgentRegistry（Map CRUD）
  - `register(agentId, endpoint, agentCard)` → AgentRegistration
  - `get(agentId)` → AgentRegistration | undefined
  - `list()` → AgentRegistration[]
  - `remove(agentId)` → boolean
- `src/server/validation.ts`: Zod schemas for POST /agents 请求体
- `src/server/routes.ts`: 4 个 Agent CRUD 端点（Hono 路由）

## 验收标准（BDD 格式）

- Given: 有效的注册请求 { agent_id, endpoint, agent_card }
  When: POST /agents
  Then: 返回 201，Agent 出现在 GET /agents 列表中

- Given: Agent A 已注册
  When: GET /agents
  Then: 返回列表包含 Agent A（含 agent_id + endpoint + agent_card）

- Given: Agent A 已注册
  When: GET /agents/agent-a
  Then: 返回 Agent A 完整信息

- Given: Agent X 未注册
  When: GET /agents/agent-x
  Then: 返回 404，error.code="ERR_AGENT_NOT_FOUND"

- Given: Agent A 已注册
  When: DELETE /agents/agent-a
  Then: 返回 200，Agent A 不再出现在 GET /agents 列表中

- Given: 请求体缺少 agent_id
  When: POST /agents
  Then: 返回 400，error.code="ERR_INVALID_BODY"

- Given: Agent A 已注册，endpoint="http://localhost:3001"
  When: Agent A 再次 POST /agents，endpoint 改为 "http://localhost:3002"
  Then: 返回 200，GET /agents/agent-a 返回新 endpoint

## 测试规格

- 测试文件: `tests/server/registry.test.ts`
- test_case_1: register — 注册新 Agent 成功
- test_case_2: get — 获取已注册 Agent
- test_case_3: get — 获取不存在的 Agent 返回 undefined
- test_case_4: list — 列出所有已注册 Agent
- test_case_5: remove — 注销 Agent 成功
- test_case_6: register — 重复注册更新信息

- 测试文件: `tests/server/routes.test.ts`
- test_case_7: POST /agents — 201 Created
- test_case_8: POST /agents — 400 Bad Request（缺少字段）
- test_case_9: GET /agents — 200 列表
- test_case_10: GET /agents/:id — 200 详情
- test_case_11: GET /agents/:id — 404 Not Found
- test_case_12: DELETE /agents/:id — 200 成功
- test_case_13: POST /agents — 200 重复注册

## 结构性约束测试

- immutability: registry.register() 返回新对象，不共享内部 Map 的引用
- error_handling: 所有路由的非法入参返回标准化 400 响应（非 500 crash）
- input_validation: POST /agents 使用 Zod 校验 agent_id + endpoint + agent_card（缺任何字段 → 400）
- auth_boundary: N/A（Phase 1 无鉴权）

## 禁止事项

- 禁止实现 POST /messages（那是 T-06 的职责）
- 禁止修改 Agent 端代码
- 禁止使用持久化存储（纯内存 Map）

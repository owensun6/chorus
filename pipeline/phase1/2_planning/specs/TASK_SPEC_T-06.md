<!-- Author: Lead -->

# TASK_SPEC_T-06

**任务**: 路由服务器 — 消息转发 + 服务器入口
**Assignee**: be-api-router
**来源 F-ID**: F6
**Blocker**: T-05

## 输入

- `src/server/registry.ts`（T-05 产出）
- `src/server/routes.ts`（T-05 产出，追加消息路由）
- `src/shared/types.ts` 中的 MessagePayload 类型
- INTERFACE.md 中 POST /messages 完整契约（含 target_response 包装、错误透传、10s 超时）

## 输出

- `src/server/routes.ts`: 追加 POST /messages 端点
- `src/server/index.ts`: Hono app 创建 + 挂载路由 + listen + 导出（供测试）

## 验收标准（BDD 格式）

- Given: Agent A 和 Agent B 均已注册
  When: POST /messages { sender_agent_id: "agent-a", target_agent_id: "agent-b", message: {...} }
  Then: 路由服务器 POST 到 Agent B 的 endpoint，返回 200 + target_response

- Given: sender_agent_id="agent-x" 未注册
  When: POST /messages
  Then: 返回 400，error.code="ERR_INVALID_BODY"，提示 sender 未注册

- Given: target_agent_id="agent-c" 未注册
  When: POST /messages
  Then: 返回 404，error.code="ERR_AGENT_NOT_FOUND"

- Given: Agent B 已注册但 endpoint HTTP 服务已关闭
  When: POST /messages 发送给 Agent B
  Then: 返回 502，error.code="ERR_AGENT_UNREACHABLE"

- Given: Agent B 返回 400（信封校验失败）
  When: POST /messages
  Then: 返回 200，data.target_response 包含 Agent B 的错误详情

- Given: 转发请求超过 10 秒未响应
  When: POST /messages
  Then: 返回 502，error.code="ERR_AGENT_UNREACHABLE"

- Given: Agent A 发送一条消息
  When: 路由服务器转发给 Agent B
  Then: Agent B 收到的 message 对象与 Agent A 发送的完全一致（纯透传）

## 测试规格

- 测试文件: `tests/server/messages.test.ts`
- test_case_1: POST /messages — 成功转发 + target_response 包装（mock target agent HTTP）
- test_case_2: POST /messages — sender 未注册返回 400
- test_case_3: POST /messages — target 未注册返回 404
- test_case_4: POST /messages — target 不可达返回 502（mock timeout）
- test_case_5: POST /messages — target 返回 400 时透传错误
- test_case_6: POST /messages — 消息内容纯透传验证（message 对象不被修改）
- test_case_7: 服务器入口 — app 启动并监听端口

## 结构性约束测试

- immutability: 转发时不修改 message 对象（JSON.stringify 前后一致）
- error_handling: HTTP 转发超时 / 连接拒绝 / target 返回非 200 均有对应处理路径
- input_validation: POST /messages 用 Zod 校验 sender_agent_id + target_agent_id + message 存在
- auth_boundary: N/A

## 禁止事项

- 禁止解析/修改 message 对象中的 Chorus 信封内容
- 禁止修改 Agent 端代码
- 禁止修改 T-05 已完成的 Agent CRUD 端点

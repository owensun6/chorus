<!-- Author: Lead -->

# TASK_SPEC_T-03

**任务**: Agent Card 校验 + 语言匹配
**Assignee**: be-domain-modeler
**来源 F-ID**: F2v2
**Blocker**: T-01

## 输入

- `src/shared/types.ts` 中的 ChorusAgentCardExtension 类型
- INTERFACE.md 中语言匹配算法（primarySubtag + 双向检查）
- INTERFACE.md 中 GET /agents 和 GET /agents/:id 响应格式

## 输出

- `src/agent/discovery.ts`:
  - `primarySubtag(bcp47)` → string
  - `canCommunicate(cardA, cardB)` → boolean
  - `discoverCompatibleAgents(routerUrl, myCard)` → AgentRegistration[]（调用 GET /agents → 过滤兼容者）

## 验收标准（BDD 格式）

- Given: Agent A card (user_culture="zh-CN", supported_languages=["zh-CN","ja","en"]) 和 Agent B card (user_culture="ja", supported_languages=["ja","zh","en"])
  When: 调用 canCommunicate(cardA, cardB)
  Then: 返回 true

- Given: Agent A card (user_culture="zh-CN", supported_languages=["zh-CN","en"]) 和 Agent B card (user_culture="ja", supported_languages=["ja","en"])
  When: 调用 canCommunicate(cardA, cardB)
  Then: 返回 false（A 不支持 ja）

- Given: BCP47 标签 "zh-CN"
  When: 调用 primarySubtag("zh-CN")
  Then: 返回 "zh"

- Given: BCP47 标签 "ja"
  When: 调用 primarySubtag("ja")
  Then: 返回 "ja"

- Given: 路由服务器返回 2 个已注册 Agent（其中 1 个兼容）
  When: 调用 discoverCompatibleAgents()
  Then: 返回只含兼容 Agent 的数组（长度 1）

## 测试规格

- 测试文件: `tests/agent/discovery.test.ts`
- test_case_1: canCommunicate — 双向兼容返回 true
- test_case_2: canCommunicate — 单向不兼容返回 false
- test_case_3: primarySubtag — 提取 "zh-CN" → "zh"
- test_case_4: primarySubtag — 提取 "ja" → "ja"
- test_case_5: discoverCompatibleAgents — 过滤不兼容 Agent（mock HTTP）

## 结构性约束测试

- immutability: canCommunicate 不修改输入的 card 对象
- error_handling: discoverCompatibleAgents 在 HTTP 失败时抛出明确错误（含 routerUrl）
- input_validation: canCommunicate 对 supported_languages 空数组返回 false
- auth_boundary: N/A

## 禁止事项

- 禁止修改信封相关代码
- 禁止修改路由服务器代码
- 禁止调用 LLM

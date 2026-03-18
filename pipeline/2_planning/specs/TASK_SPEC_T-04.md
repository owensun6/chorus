<!-- Author: Lead -->

# TASK_SPEC T-04: LLM 集成模块（语义提取 + 文化适配）

**Assignee**: be-ai-integrator
**Blocker**: None
**F-ID**: F1, F3

## 目标

实现 LLM 调用逻辑：从用户输入提取语义意图 + 生成信封字段，以及从信封反向适配为本地文化表达。

## 交付物

- `src/agent.ts` — extractSemantic(), adaptMessage()
- `tests/agent.test.ts` — 单元测试（mock LLM 响应）

## 验收命令

```bash
npx jest tests/agent.test.ts --coverage
# exit 0 = 通过，覆盖率 ≥ 80%
```

## 约束

- extractSemantic(userInput, userCulture): 调用 LLM → 返回 {original_semantic, intent_type?, formality?, emotional_tone?}
- adaptMessage(envelope, targetCulture): 调用 LLM → 返回适配后的文本
- 提示词模板直接内联在代码中（内容来自 INTERFACE.md chorus-prompt-template 规范），不依赖外部文件
- LLM API Key 从环境变量读取，不可硬编码
- LLM 调用失败 → 抛出明确错误，不静默降级

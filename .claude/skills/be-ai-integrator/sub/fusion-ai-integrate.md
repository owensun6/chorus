---
name: fusion-ai-integrate
description: be-ai-integrator 专用。接入 LLM/MCP 子系统，调优 Prompt 与 Function Calling，TDD RED→GREEN→REFACTOR。
---

# fusion-ai-integrate — AI 能力集成


---

## ⚡ 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   → 封装 AI 能力为可降级的服务
2. **这些步骤已经不可原子级再分了吗？**
   → AI 集成接口定义 → Mock 测试 → 真实调用实现 → 降级策略，每步独立。

---

## 输入文件

| 文件                                            | 用途            |
| ----------------------------------------------- | --------------- |
| `pipeline/2_planning/specs/TASK_SPEC_T-{ID}.md` | 本任务验收标准  |
| `pipeline/1_architecture/INTERFACE.md`          | AI 能力接口定义 |
| `pipeline/1_architecture/ADR/`                  | AI 技术选型决策 |

---

## TDD 执行循环

### 🔴 RED: 从 BDD 生成测试（Mock LLM 响应）

**⚠️ TDD 证据链（铁律）**:

1. 读取 TASK_SPEC 中的 BDD 验收标准（Given-When-Then），逐条转化为测试断言
2. 运行测试 → **必须全部 FAIL**（若有 PASS = 实现已存在，上报 Lead）
3. `git commit -m "test(red): T-{ID} [简述]"` — 此 commit 是 RED 的物理证据
4. QA-01 将验证 git log 中 `test(red)` commit 早于 `feat(green)` commit

**未提交 RED commit 就写实现代码 = 违反 TDD 纪律，QA-01 将直接 FAIL。**

```ts
// AI 集成测试必须 Mock，避免依赖真实 API
describe('AIService.analyzeMedicalText', () => {
  const mockLLMClient = {
    complete: jest.fn(),
  };

  it('成功分析并返回结构化结果', async () => {
    mockLLMClient.complete.mockResolvedValue({
      content: '{"diagnosis": "高血压", "confidence": 0.85}',
    });

    const result = await AIService.analyzeMedicalText('患者血压180/120', mockLLMClient);

    expect(result.diagnosis).toBe('高血压');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('LLM 超时时返回降级结果', async () => {
    mockLLMClient.complete.mockRejectedValue(new Error('Timeout'));

    const result = await AIService.analyzeMedicalText('测试文本', mockLLMClient);

    // 降级策略: 返回空结果而非抛出错误
    expect(result).toEqual({ diagnosis: null, confidence: 0, error: 'AI_TIMEOUT' });
  });
});
```

### 🟢 GREEN: 实现 AI 服务 → `git commit -m "feat(green): T-{ID} [简述]"`

```ts
// AI 集成规则:
// 1. Prompt 工程封装在专用函数中，便于调优
// 2. 必须有降级策略（LLM 超时/失败 → 不崩溃）
// 3. 响应解析有容错处理（LLM 输出格式不稳定）
// 4. Token 使用量日志记录（成本可观察）

export class AIService {
  static async analyzeMedicalText(text: string, llmClient: LLMClient): Promise<AnalysisResult> {
    const prompt = buildMedicalAnalysisPrompt(text); // Prompt 独立函数，便于调优

    try {
      const response = await Promise.race([
        llmClient.complete(prompt),
        timeout(30000), // 30秒超时
      ]);

      return parseAnalysisResponse(response.content); // 有容错的解析
    } catch (error) {
      logger.error('AI analysis failed', { error, textLength: text.length });
      return { diagnosis: null, confidence: 0, error: 'AI_TIMEOUT' }; // 降级而非抛出
    }
  }
}

function buildMedicalAnalysisPrompt(text: string): string {
  return `你是医疗文本分析助手。请分析以下文本并以 JSON 格式返回诊断结果。
格式: {"diagnosis": "...", "confidence": 0.0-1.0}
文本: ${text}`;
}
```

### 🔵 REFACTOR: 清理

- Prompt 模板版本化管理
- 响应解析逻辑有单元测试覆盖
- AI 调用结果缓存策略（如适用）

---

## 完成条件

- [ ] 所有测试绿灯（含 LLM 失败/超时的降级测试）
- [ ] Prompt 封装在独立可调优函数中
- [ ] 明确的降级策略（不返回 500 给前端）

**完成后 → 在 monitor.md 标记 `[x]` → 调用 code-simplifier → 进入 QA 轮询循环。**

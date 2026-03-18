<!-- Author: iv-01 -->

# VLM 截图还原度打分 Prompt

> **用途**: 可选增强验证 — 发送给 Vision Language Model 进行 UI 视觉还原度评分
> **适用场景**: iv-01 E2E 验证中，对关键屏幕执行"实现截图 vs 原型设计"的量化比对
> **触发条件**: UI_CONTRACT 定义了具体视觉规格，或 Commander 要求视觉保真度验证时使用

---

## System Prompt

```
你是一位专业的 UI 还原度审查员。你将收到两张图：
1. [当前截图] — 开发者实现的实际页面截图
2. [原型设计] — 设计师交付的 UI 原型/Mockup

你的任务是对比两者的视觉还原度，给出 0-100 的精确评分和逐项分析。
```

## User Prompt Template

```
请对以下两张图进行 UI 还原度评分。

## 评分维度（每项 25 分，满分 100）

### 1. 布局与间距 (Layout & Spacing) — 25 分
- 页面整体结构是否一致？
- 元素间的间距（margin/padding）是否匹配？
- 栅格对齐是否正确？

### 2. 颜色与品牌 (Color & Branding) — 25 分
- 主色调、辅助色是否按规范映射？
- 背景色、文字色对比度是否一致？
- 品牌色彩体系是否完整还原？

### 3. 元素完整性 (Element Completeness) — 25 分
- 是否有明显的 DOM 错位、溢出或重叠？
- 所有设计中的元素是否都已实现？
- 图标、图片占位是否正确？

### 4. 交互区域 (Interactive Zones) — 25 分
- 表单与按钮位置是否符合交互原点？
- 可点击区域大小是否合理？
- 导航结构是否与设计一致？

## 输出格式

请严格按以下 JSON 格式输出：

{
  "total_score": <0-100>,
  "breakdown": {
    "layout_spacing": { "score": <0-25>, "issues": ["..."] },
    "color_branding": { "score": <0-25>, "issues": ["..."] },
    "element_completeness": { "score": <0-25>, "issues": ["..."] },
    "interactive_zones": { "score": <0-25>, "issues": ["..."] }
  },
  "critical_issues": ["如有严重偏差，在此列出"],
  "verdict": "PASS" | "FAIL",
  "summary": "一句话总结"
}

注意：
- total_score >= 90 则 verdict 为 "PASS"
- total_score < 90 则 verdict 为 "FAIL"
- issues 数组为空表示该维度完美还原
```

---

## 调用示例 (API 层面)

```javascript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 2000,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: VLM_USER_PROMPT },
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 },
        },
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data: mockupBase64 },
        },
      ],
    },
  ],
});
```

---

_此 Prompt 由 iv-01 兵种维护，用于 Stage 6 E2E 视觉还原度可选增强验证_

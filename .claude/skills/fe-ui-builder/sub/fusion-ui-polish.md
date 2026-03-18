---
name: fusion-ui-polish
description: fe-ui-builder 专用。哑组件结构完成后，按 Design Token 注入视觉质量。在 fusion-ui-build 之后调用。
---

# fusion-ui-polish — 视觉质量注入

> 在 fusion-ui-build 完成结构正确的哑组件后调用。职责：让组件从"结构正确但丑"变成"结构正确且符合 Design Token"。

---

## 执行前 FP 两问（强制）

1. **我们的目的是什么？**
   -> 按 Design Token 注入视觉质量
2. **这些步骤已经不可原子级再分了吗？**
   -> 读取 Token -> 应用配色 -> 应用字体 -> 应用间距/圆角 -> 应用质感 -> 自检。六步不可合并。

---

## 前置验证

```
[x] fusion-ui-build 已完成（哑组件测试全绿）
[x] UI_CONTRACT.md 包含 Design Token 章节（无 [待定] 残留）
```

**如果 UI_CONTRACT.md 中没有 Design Token -> 停止，向 Commander 报告上游缺口。不得自行编造视觉规范。**

---

## 输入文件

| 文件 | 用途 |
|------|------|
| `pipeline/0_5_prototype/UI_CONTRACT.md` | Design Token（配色/字体/间距/质感方向） |
| fusion-ui-build 的产出物 | 已通过测试的哑组件代码 |

---

## 执行序列

### Step 1: 提取 Design Token

从 UI_CONTRACT.md 的 Design Token 章节提取：
- CSS 变量定义（配色、间距、圆角）
- 字体体系（字体族、字号、字重）
- 视觉质感方向（阴影、背景、动画基调）

### Step 2: 创建/更新主题文件

将 Design Token 转化为 CSS 变量（或 Tailwind config），写入项目的主题文件：
- `:root` 变量定义
- 响应式字号（clamp）
- 共享动画定义

### Step 3: 逐组件应用视觉规范

对每个哑组件：
- 配色：替换硬编码颜色为 CSS 变量引用
- 字体：按层级（H1/H2/Body/Caption）应用字体体系
- 间距：按 Token 统一内外边距
- 圆角：按组件类型应用对应圆角
- 阴影/质感：按视觉方向添加

### Step 4: 视觉自检清单

- [ ] 所有颜色使用 CSS 变量（零硬编码色值）
- [ ] 字体层级清晰（标题/正文/辅助有明显区分）
- [ ] 间距呼吸感充足（不拥挤、不空旷）
- [ ] 交互状态可见（hover/focus/active/disabled 有视觉反馈）
- [ ] 深色文字在浅色背景上对比度 >= 4.5:1（WCAG AA）
- [ ] 组件在移动端宽度（375px）下不溢出

### Step 5: 回归测试

重跑 fusion-ui-build 阶段的所有测试，确认视觉修改没有破坏结构。

**测试仍然全绿 -> 完成。测试变红 -> 修复后重跑。**

---

## 禁区（越界即违规）

- 禁止修改组件的 Props 接口或 DOM 结构（那是 fusion-ui-build 的产出）
- 禁止偏离 Design Token（不得"觉得这个颜色更好看"而自行替换）

---

## 完成条件

- [ ] 视觉自检清单全部通过
- [ ] 所有测试仍然全绿
- [ ] 零硬编码色值（全部引用 CSS 变量）
- [ ] 视觉效果与 Design Token 描述的风格方向一致

**完成后 -> 返回 fe-ui-builder 主流程（monitor.md 标记 + 调用 code-simplifier + QA 轮询）。**

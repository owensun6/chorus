# Fusion-Core 内容与代码风格指南 (\_STYLE_GUIDE.md)

为了确保 Fusion-Core 的核心护城河（即代码和指令的极低熵值），所有贡献者及 AI Agent 必须通读并严格遵守本指南。

## 1. 文书与 Prompt 风格 (Documentation & Prompt Style)

### 1.1 纯信噪比 (Zero Noise)

大模型的注意力窗口是极其昂贵的。

- ❌ **坏味道**: "您好，统帅。我已经根据您的要求为您生成了以下代码，请查收："
- ✅ **好味道**: (直接贴出代码或 Markdown，首行带上 `<!-- Author: XXX -->`)

### 1.2 物理断言代替道德劝阻

在编写 `SKILL.md` 时：

- ❌ **坏味道**: "请你尽量不要在没写测试的时候提交代码。"
- ✅ **好味道**: "执行 `PostToolUse` 时发现无对应 `.test.ts` 文件，以 Exit Code 1 物理阻断执行。"

## 2. Diátaxis 书写规约 (Diátaxis Framework)

本库的 `docs/` 严格遵循 Diátaxis 四象限原则。当你补充文档时，请对号入座：

1. **Tutorials (`docs/tutorials/`)**: 针对新兵。一步步牵着手教（例如：如何用 Fusion-Core 开发第一个 Todo 接口）。
2. **How-to Guides (`docs/how-to/`)**: 针对老兵。目标导向的问题解决（例如：如何将 TDD 引擎挂载到你现有的 Git 仓库）。
3. **Reference (`docs/reference/`)**: 机器或人类查阅。枯燥但绝对精确（例如：13 个兵种的 CLI 参数全集）。
4. **Explanation (`docs/explanation/`)**: 阐述“道”。解释为什么这么设计（例如：为什么我们抛弃了串行改用 DAG 盲打并发）。

## 3. Markdown / 代码格式 (Formatting)

- **语言**: `zh-CN` 简体中文为主，术语保留英文原貌（不要把 Token 翻译成“令牌”）。
- **层级**: 一个文件只允许存在一个 `# H1` 标题。
- **引用**: 对于关键警示，统一使用 GitHub Alert 语法 (`> [!CRITICAL]`)。

# Fusion-Core 特种兵兵法写作规范 (Skill Authoring Standard)

> **[!] CRITICAL (造兵法则)**: 在 Fusion-Core 系统中，无论是官方提供的 13 个角色，还是后续项目中自定义的临时兵种，如果要为其分配专门的领域知识，必须遵守统一的 `SKILL.md` 编写标准。
>
> 文档写作通用规范（零噪声原则、Diátaxis 框架、Markdown 格式）→ `_STYLE_GUIDE.md`

## 0. 第一性原理强制嵌入（所有 SKILL.md 必须遵守）

### 0.1 执行前两问（前置）

每个 SKILL.md 的执行入口处必须包含以下前置块：

```markdown
## ⚡ 执行前强制两问（First Principles Pre-flight）

在执行任何具体动作之前，必须在内部推理中完成：

1. **我们的目的是什么？**
   → 对照本阶段的 Purpose Anchor 用自己的话复述。

2. **这些步骤已经不可原子级再分了吗？**
   → 逐步检查你准备执行的动作序列。发现可拆分的立即拆分，发现冗余的立即删除。
```

### 0.2 交付后监控循环（后置，Dev 阶段强制）

所有参与 Stage 5 开发执行的兵种，其 SKILL.md 必须包含以下结束流程（不得省略）：

```markdown
## ⚡ 交付后监控循环（Dev 阶段强制）

完成交付物写入后，**不得直接退出**，必须执行：

1. 在 `pipeline/monitor.md` 中将本行 Worker 状态标为 `[x]`
2. 调用 code-simplifier（传入本 T-ID 文件列表），等待 Simplify 列变为 `[✓]` 或 `[SKIP]`
3. 进入轮询循环，读取本行 QA 状态：
   - `[✓]` → 正常退出，通知下游可启动
   - `[✗]` 或 `[!]` → 读取 `audit/` 中对应审计报告 → 根据意见修改 → 重新执行本 SKILL → 回到步骤 1
   - `[ ]` → QA 尚未完成，继续轮询
```

**此规则在需求/架构阶段可由 Commander 豁免（Commander 人工参与时）；在 Stage 5 开发阶段不可豁免。**

---

## 1. 原则 (Core Philosophy)

1. **单一技能，一个入口**: 每个军团或独立特种兵兵种只能拥有一个 `SKILL.md`（例如 `.claude/skills/fe-ui-builder/SKILL.md`），它是代理理解该角色的第一入口。
2. **强制使用原子能力 (Actions)**: 长篇大论的教导会被大模型遗忘。对于复杂的业务流，应该将它们拆分成独立的动作文件（例如 `actions/01_Red_Fail_Test.md`），并在 `SKILL.md` 里进行引用。

## 2. 目录结构标准

创建新 Skill 时的物理结构：

```text
skills/
└── my-new-special-agent/
    ├── SKILL.md             ← 必需，技能入口与边界定义
    └── actions/             ← 可选，子动作/模板的集合
        ├── action_a.md
        └── action_b.md
```

## 3. `SKILL.md` 官方标准模板

任何特种兵的 `SKILL.md` 必须包含以下 4 个段落，且第一段落必须引入共享资源（`.claude/rules/hooks.md` 和 `.claude/rules/document-standards.md`）。

```markdown
# [特种兵全写，例如：Frontend UI Builder (UI特种兵)]

## 0. 共享军火库挂载 (Shared Resources)

在执行任何具体任务前，你**必须**了解并挂载以下通用法则：

- `.claude/rules/hooks.md` (前置与后置拦截)
- `.claude/rules/document-standards.md` (文档与签名拦截)

## 1. 兵种识别 (Identity & Scope)

你是谁？你的职责边界是什么？
**【领域边界】**: 只处理 Web 前端 React 相关的 UI 层。
**【绝对禁区】**: 严禁修改任何后端的 API 路由或触碰数据库 Schema（即使这些文件刚好在同一个仓库内）。

## 2. 核心兵器图谱 (Atomic Actions)

列举你能调用的专门动作，并指定在什么时候使用它们：

- **动作 A (`actions/action_a.md`)**: 当你需要生成新的页面外壳时使用。
- **动作 B (`actions/action_b.md`)**: 当你需要绑定后端 SWR 数据流时使用。

## 3. 铁血清单 (Strict Checklist)

给出 3-5 条基于该兵种的 DO / DON'T 示例。

- **DO**: 组件必须使用 Server Components 优先原则。
- **DON'T**: 绝对不要在 `useEffect` 里进行初始化获取，必须交由父级透传或服务端获取。
```

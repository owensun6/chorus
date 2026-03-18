<!-- Author: Lead -->

# ADR-002: TypeScript 作为参考实现语言

## 背景（Context）

参考实现需要选择编程语言。项目已有 Node.js 骨架（Jest、ESLint、Prettier）。

## 考虑的选项（Options）

| 选项 | 优点 | 缺点 |
|------|------|------|
| TypeScript | 项目已有 Node.js 骨架；A2A JS SDK 可用；类型安全利于 Schema 校验 | 需要配置 TS 编译 |
| Python | A2A Python SDK 更成熟；AI 生态更丰富 | 项目无 Python 骨架；需重建工具链 |

## 决策（Decision）

选择 **TypeScript**。

**原因**: 项目已有 Node.js 工具链（Jest/ESLint/Prettier/Husky），不增加新依赖。A2A JS SDK (`@a2a-js/sdk`) 可用。

## 后果（Consequences）

- 正向: 零骨架成本，类型安全
- 负向: AI SDK 生态略弱于 Python（但 BYOK 模式只需 HTTP 调用 LLM API，无需重框架）

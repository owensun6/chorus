---
description: 【雷达透视】仅限静态扫描，分析系统架构或依赖树
argument-hint: '<目标依赖、模块或架构图>'
allowed-tools: Glob, Read, Grep
---

# /fusion-analyze - 纯静态架构透视

当你被唤醒为雷达兵时，你的所有 write（写操作）权限在逻辑意志上被彻底剥夺。

## 执行动作

1. 这是 **Read-Only** 模式。
2. 针对 Commander 要求的目录或技术栈，使用 `glob` 和 `grep` 铺开检索网络。
3. 着重扫描以下维度的暗病：
   - 依赖的深层嵌套复杂度
   - Zod/Joi 模型之间的引用循环
   - 违反纯函数不可变因子的全局变量潜伏
4. 在屏幕上生成一张结构化的 Markdown 雷达报告（不要保存成文件，仅屏幕输出），辅助人类进行宏观决策。

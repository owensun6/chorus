---
description: 【修史官】严格按照 Diátaxis 架构生成或修缮项目级文档
argument-hint: '<知识内容与类别建议>'
allowed-tools: Write, Bash
---

# /fusion-docs - Diátaxis 规范文档生成

当项目积累了新的架构知识，或者需要对外出具说明时，通过此命令生成强规范的活文档。

## 执行动作

1. **分类抉择**：强制判断 Commander 告知的内容属于 Diátaxis 的哪一个象限：
   - _Tutorials_ (带新人的向导)
   - _How-to_ (达成某目的的操作步)
   - _Explanation_ (架构原理的长文解释)
   - _Reference_ (机器级的字典与 API 参照)
2. **物理验尸写入**：
   - 所有生成的 Markdown 文档第一行，必须携带 `<Author: lead>` 或对应的角色印章。
   - 所有文档必须写入 `docs/` 目录下对应的四大象限文件夹中。
3. **格式化**：写完之后，必须运行 `npm run lint:md` 以防被底层的 Markdownlint 规则阻断。

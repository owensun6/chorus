<!-- Author: Lead -->

# TASK_SPEC T-06: 测试语料库

**Assignee**: be-ai-integrator
**Blocker**: None
**F-ID**: F4

## 目标

创建 200 条中↔日测试语料，覆盖文化禁忌和俚语场景。

## 交付物

- `data/test-corpus.json` — 200 条，格式按 Data_Models.md TestCase

## 验收命令

```bash
node -e "const d=require('./data/test-corpus.json'); console.assert(d.length===200); console.assert(d.filter(x=>x.category==='taboo').length===100); console.assert(d.filter(x=>x.category==='slang').length===100); console.log('PASS')"
# exit 0 = 通过
```

## 约束

- 100 条 category="taboo"（文化禁忌）：在一方文化中正常/正面，在另一方文化中冒犯/不当
- 100 条 category="slang"（俚语）：本国俚语/惯用语，直译无法传达含义
- 双向：约一半 zh-CN→ja，一半 ja→zh-CN
- 每条必须有 context 字段，说明文化差异（供 Judge 参考）
- 字段格式：{ id, category, input_text, source_culture, target_culture, context }

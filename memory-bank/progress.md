# Chorus Protocol — Progress Log

### 2026-03-18 22:00

**操作**: Phase 0 收尾 + Phase 1 Stage 0 完成
**结果**:
- Phase 0 归档完成：5/15 语言对实验数据 → `results/report.json` + `results/summary.md`
- FP 审计发现 Schema-实验差异（`cultural_context` 字段不在 Schema 中），已在所有文档中显式标注
- Phase 0 所有文档交叉一致性验证通过
- Phase 1 PRD/FEATURE_LIST/BDD 编译完成，Gate 0 通过
- PM 自检 REVISE→修复，PM Consultant 审查 REVISE→修复 2 CRITICAL + 5 HIGH
- FP 审计删除 F8（降级）+ 心跳机制 + v0.1 兼容 BDD = -6 场景（25→19）
- Phase 1 Stage 0.5 SKIP（无 UI），进入 Stage 1

**决策**:
- `cultural_context` 生成策略：协议只定义字段格式，不管生成方式（FP 判定：Chorus 是路由层，不带 AI 算力）
- F8 Phase 1 不实现：所有 Agent 均为 v0.2，降级场景不存在
- 心跳删除：localhost demo 不需要分布式心跳，改为 Agent 退出时显式 DELETE 注销
- 延迟指标：8s E2E → 5s 单跳（有分解依据）
- Phase 1 目标受众：内部验证（demo first）

### 2026-03-19 12:00

**操作**: Phase 1 完整流水线 (Stage 1→7) + Phase 2 完整流水线 + 3 轮优化
**结果**:
- Phase 1: 8 Tasks TDD 完成，195 tests，92.5% coverage，merged to main
- Phase 1 E2E: ja→zh-CN "つまらないものですが"→"一点心意，不成敬意，请您收下" 验证通过
- Phase 2: Streaming + Web Demo UI + 多轮对话，8 Tasks，255 tests，merged to main
- 模型切换: qwen3.5-plus→qwen3-coder-next (80x 提速，30s→1.4s)
- FP 审计 3 轮: 死代码清除 + llm.ts 重复消除 + index.ts 拆分 + demo 假广播修复
- 架构简化: JSON 提取→纯文本双调用（零格式失败，消除 ja→zh 方向 100% 失败率）
- Agent 人格: 透明翻译管道→文化朋友传话模式（一行提示词改变，体验质变）

**决策**:
- 不定义 Agent 人格参数——LLM 自带人格，不需要额外配置
- 不要求 LLM 输出 JSON——纯文本调用，100% 可靠
- intent_type/formality/emotional_tone 删除——从未参与适配过程，只是展示元数据
- coding.dashscope.aliyuncs.com/v1 + qwen3-coder-next 是当前最优 LLM 配置
- 8 模型横评结论: qwen3-coder-next (1.4s) > kimi-k2.5 (2.1s) > 其余全部被 thinking 拖慢

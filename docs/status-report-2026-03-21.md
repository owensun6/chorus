# Chorus Protocol — 2026-03-21 封板报告

## 已验证

- 协议技术链路可用。`register -> send -> receive -> validate` 已由参考实现和实验跑通；当前测试为 `13 suites / 142 tests` 全绿。
- `EXP-01` 已通过。受控环境下，外部高能力 Agent 可在 `SKILL.md + 最小任务提示` 条件下完成首次接入。
- `EXP-02` 已取得 `CONDITIONAL PASS`。`xiaox / MiniMax-M2.7` 在约 `2.5 min` 内完成双向闭环，`QC=0`，`HIR=false`，in-experiment contamination check 为 `CLEAN`。
- 文档主面已收平。`PROTOCOL.md`、`SKILL.md`、`TRANSPORT.md`、`envelope.schema.json`、`README.md` 及对应模板镜像已同步到当前 `v0.4` / `v0.5 doc` 基线。

## 未验证

- 人类开发者冷启动可行性未验证。`EXP-03` 已设计但已跳过，因此不能声称文档对人类开发者同样足够。
- 市场需求与真实采纳未验证。当前只有 AI subject 证据，没有真实外部用户持续使用证据。
- 生产网络环境未验证。现有证据主要来自 `localhost`，未覆盖公网部署、NAT、跨主机稳定性。
- 多轮会话摩擦未验证。`conversation_id / turn_number` 的长链路行为尚无正式实验。

## 已修

- `F-1r`：`agent_card.chorus_version` 重命名为 `agent_card.card_version`，消除了同名异义的版本字段混淆。
- `F-5`：实现 `GET /.well-known/chorus.json` discovery endpoint，外部客户端不再得到 `404`。
- `F-6`：在 `TRANSPORT.md` 和模板中明确 envelope 必须嵌套在 `"envelope"` 键内。
- `F-7`：撤回 `0.2/0.3 -> 0.4` 向后兼容承诺，明确 pre-`1.0` 不保证兼容，旧信封必须升级。
- `cultural_context` 已降级为可选 hint，不再作为发送方预期义务。
- `README.md`、模板 `PROTOCOL/TRANSPORT/schema` 漂移已收平，不再把读者带回 `v0.3 / original_semantic / two-LLM-call` 旧叙事。
- 安装路径收敛为单一官方路径 `--target openclaw`，其余路径降级至附录。CLI 新增 `verify` 子命令（文件检查 + 配置检查 + envelope 验证），`init --target openclaw` 失败时 exit 1 并给出明确错误提示，不再静默跳过注册失败。

## 风险

- `EXP-02` 只是 `CONDITIONAL PASS`，不是严格 `zero-artifact cold start` 金标准；结论边界必须保守。
- 仍无自动机制保证 `skill/*` 与 `packages/chorus-skill/templates/*` 长期同步，后续协议变更仍可能重新制造漂移。
- 服务器仍无认证/授权能力；这对本地 demo 可接受，但对任何联网部署都是显式风险。
- 人类开发者冷启动实验（EXP-03）尚未执行，安装路径收敛的实际效果需通过冷启动验证后才能确认。

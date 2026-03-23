# Handoff — 2026-03-23 chorus-bridge 最终收口

## 当前结论

- 文档线：PASS
- Hub invite gating：PASS
- bridge 实现：PASS
- runtime live path：PASS
- startup backlog drain：PASS
- auto-drain path：PASS
- translation gate：PASS

## 一句话状态

`chorus-bridge` 已完成最终运行验收，不再是运行阻塞项。后续只剩文档同步与归档，不要再把 bridge 当成待修复问题。

## 已确认的关键证据

- `~/.openclaw/extensions/chorus-bridge/index.ts` 已加载到新进程，包含接收侧语言约束与 auto-drain 逻辑
- live path 成功：`xiaox@chorus` 发起的新消息被实时送达 `xiaov@openclaw`
- startup backlog drain 成功：重启后 Phase 3 `retryPending` 清空历史 9 条 pending
- auto-drain 成功：`auto-drain scheduled` -> `retrying 3 pending` -> `retry: 3/3 succeeded`
- 微信端截图显示最终内容为中文转述，不是英文原样直出
- `history`、`seen.json`、`inbox` 状态与日志时间线一致

## 不要再重开的问题

1. 不要再把 `contextToken` 冷启动当成代码 bug。它是进程级状态，必须由运行时流程验证，不是重新设计 bridge 的理由。
2. 不要再争论 auto-drain 是否生效。该路径已经被 `startup 无 token -> token 可用 -> 新消息成功 -> auto-drain` 的完整链路验证。
3. 不要再争论英文来信会不会原样直出。最终证据已证明微信端收到的是中文适配结果。
4. 不要再把 Hub invite gating 和 bridge runtime 混在一起审。两条线都已各自闭合。
5. 不要再重开 `xiaox/xiaov` 的 culture 归属问题。当前行为边界已稳定，后续如需调整只属于文档同步，不属于运行修复。

## 关键文件

- [docs/chorus-bridge-plugin-spec.md](/Volumes/XDISK/chorus/docs/chorus-bridge-plugin-spec.md)
- [docs/chorus-bridge-acceptance.md](/Volumes/XDISK/chorus/docs/chorus-bridge-acceptance.md)
- [~/.openclaw/extensions/chorus-bridge/index.ts](/Users/test2/.openclaw/extensions/chorus-bridge/index.ts)
- [skill/SKILL.md](/Volumes/XDISK/chorus/skill/SKILL.md)
- [skill/TRANSPORT.md](/Volumes/XDISK/chorus/skill/TRANSPORT.md)

## 下一步

- 只做对外文档的最终一致性检查
- 不再扩展 bridge 核心实现
- 不再重跑运行阻塞类验收

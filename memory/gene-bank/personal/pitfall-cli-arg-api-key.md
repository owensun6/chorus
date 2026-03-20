# CLI 参数传 API key 会被 ps aux 暴露

**类型**: Pitfall
**来源**: Chorus Phase 4 FP 审计 — 2026-03-19
**场景**: 任何需要传递密钥/token 给子进程的设计

## 内容

命令行参数对同机所有用户可见：`ps aux` 会显示完整的进程参数列表，包括 `--api-key my-secret`。

密钥必须通过环境变量传递（如 `CHORUS_ROUTER_API_KEY`），而非 CLI flag（如 `--router-api-key`）。环境变量只对进程自身和子进程可见，`ps aux` 不会显示。

## 反例

```bash
# 错误：任何人 ps aux | grep agent 即可看到 key
node agent.js --router-api-key sk-1234567890

# 正确：环境变量不暴露在进程参数中
CHORUS_ROUTER_API_KEY=sk-1234567890 node agent.js
```

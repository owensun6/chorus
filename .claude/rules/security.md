# 安全渗透红线 (Security Constraints)

> **[!] CRITICAL (生死存亡)**: 在此防线被击穿，无需打回，直接清退。安全是 `qa-03` 的武器，也是每一个 Dev 的紧箍咒。

## 高危 8 项清点法 (OWASP Top 8 Check)

在提交任何涉及交互和数据的代码之前，使用以下清单拷问自己：

- [ ] **1. 硬编码断头台**: 严禁用明文存放任何 Secret (API Keys, Passwords, Tokens)，必须读取环境变量并在打日志时脱敏。
- [ ] **2. 不信任何人 (输入验证)**: 来自用户、其他服务、甚至同应用的前端的任何输入，都必须通过 Schema (例如 Zod/Joi) 的强校验。
- [ ] **3. SQL 防疫栈**: 彻底封杀拼接式 SQL。所有与 DB 的交互必须使用参数化查询 (Parameterized Queries) 或安全的 ORM 方法。
- [ ] **4. 跨站毒药 (XSS)**: 前端绝不信任后端来的数据进行直接渲染，禁用一切类似于 `dangerouslySetInnerHTML`（除非有严格净化管线）。
- [ ] **5. 伪造金牌 (CSRF)**: 重要写入接口必须受到 Anti-CSRF 机制 或 SameSite 防御塔的保护。
- [ ] **6. 军营路条 (AuthZ & AuthN)**: 每一行涉及读写领域数据的 API，都经过了鉴权及越权 (IDOR) 检查了吗？
- [ ] **7. 拒绝轰炸 (Rate Limiting)**: 暴露在公网的高成本路由和鉴权点，是否配置了访问速率限制器？
- [ ] **8. 报错封口令**: 给前端报 `Failed to log in`，绝不要报 `Null pointer exception at Table Users row 45 password hash missing`。

## 安全红灯打回协议 (Security Rejection Protocol)

如果你在审查时发现上述任何一点违规：

1. **立刻挂起并报警 (`STOP`)**。
2. 将责任代码片段贴到 `pipeline/monitor.md` 对应的异常槽位。
3. 转交给 `qa-03` 特种兵接管重制。

# 战术阵型与设计模式 (Patterns & Skeletons)

> **[!] CRITICAL (整齐划一)**: 发挥创意不等于制造散沙。所有相同功能的齿轮，长得必须一模一样。

## 1. 骨架优先法则 (Skeleton Projects)

- 永远不要白手起家。
- 若需要初始化任何前/后端项目，优先查阅并套用企业级的成熟骨架项目（如具备成熟 ESLint/Prettier/Docker 的模板），而不是手动一点点挤牙膏。

## 2. 数据层绝缘法则 (Repository Pattern)

- 业务特种兵 `be-domain-modeler` 绝不允许亲自和数据库建立 TCP 链接或写 SQL。
- 强制使用 `Repository Layer` 封装数据库操作实体，暴露统一的操作方法如 `findById`, `save`, `findByIndex` 等。这使得在测试时可以极其容易地 Mock 数据库。

## 3. 标准化战损通报与赏金发放 (API Response Format)

所有后端路由对外的响应包，强制遵循如下绝对格式，少一条属性都要被打回：

**成功响应 (200 OK):**

```json
{
  "success": true,
  "data": { "key": "value" },
  "metadata": { "timestamp": "...", "requestId": "..." }
}
```

**溃败响应 (4xx/5xx):**

```json
{
  "success": false,
  "error": {
    "code": "ERR_INVALID_AUTH",
    "message": "User not authenticated."
  },
  "metadata": { "timestamp": "..." }
}
```

不允许抛出直接的栈异常或形态不一的自定义 Error Json。

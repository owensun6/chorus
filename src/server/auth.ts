// Author: be-api-router
import type { Context, Next } from "hono";
import { errorResponse } from "../shared/response";

const createAuthMiddleware = (apiKeys: ReadonlySet<string>) => {
  return async (c: Context, next: Next) => {
    if (c.req.method === "GET") return next();

    const auth = c.req.header("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return c.json(
        errorResponse("ERR_UNAUTHORIZED", "Missing or invalid Authorization header"),
        401,
      );
    }

    const token = auth.slice(7);
    if (!apiKeys.has(token)) {
      return c.json(
        errorResponse("ERR_UNAUTHORIZED", "Invalid API key"),
        401,
      );
    }

    return next();
  };
};

export { createAuthMiddleware };

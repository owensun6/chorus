// Author: be-api-router
import type { Context, Next } from "hono";
import { errorResponse } from "../shared/response";

type KeyValidator = (token: string) => boolean;

const createAuthMiddleware = (
  staticKeys: ReadonlySet<string>,
  dynamicValidator?: KeyValidator,
  exemptPaths?: ReadonlySet<string>,
) => {
  return async (c: Context, next: Next) => {
    if (exemptPaths?.has(c.req.path)) return next();

    if (c.req.method === "GET") return next();

    const auth = c.req.header("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return c.json(
        errorResponse("ERR_UNAUTHORIZED", "Missing or invalid Authorization header"),
        401,
      );
    }

    const token = auth.slice(7);
    if (staticKeys.has(token) || dynamicValidator?.(token)) {
      return next();
    }

    return c.json(
      errorResponse("ERR_UNAUTHORIZED", "Invalid API key"),
      401,
    );
  };
};

export { createAuthMiddleware };
export type { KeyValidator };

// Author: be-api-router
import { Hono } from "hono";
import { AgentRegistry } from "./registry";
import { RegisterAgentBodySchema } from "./validation";

const successResponse = (data: unknown) => ({
  success: true as const,
  data,
  metadata: { timestamp: new Date().toISOString() },
});

const errorResponse = (code: string, message: string) => ({
  success: false as const,
  error: { code, message },
  metadata: { timestamp: new Date().toISOString() },
});

const createApp = (registry: AgentRegistry): Hono => {
  const app = new Hono();

  app.post("/agents", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        errorResponse("ERR_VALIDATION", "Invalid JSON body"),
        400
      );
    }

    const parsed = RegisterAgentBodySchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return c.json(errorResponse("ERR_VALIDATION", message), 400);
    }

    const { agent_id, endpoint, agent_card } = parsed.data;
    const existed = registry.get(agent_id) !== undefined;
    const registration = registry.register(agent_id, endpoint, agent_card);
    const status = existed ? 200 : 201;

    return c.json(successResponse(registration), status);
  });

  app.get("/agents", (c) => {
    const agents = registry.list();
    return c.json(successResponse(agents), 200);
  });

  app.get("/agents/:id", (c) => {
    const agent = registry.get(c.req.param("id"));
    if (!agent) {
      return c.json(
        errorResponse("ERR_NOT_FOUND", "Agent not found"),
        404
      );
    }
    return c.json(successResponse(agent), 200);
  });

  app.delete("/agents/:id", (c) => {
    const removed = registry.remove(c.req.param("id"));
    if (!removed) {
      return c.json(
        errorResponse("ERR_NOT_FOUND", "Agent not found"),
        404
      );
    }
    return c.json(
      successResponse({ deleted: true, agent_id: c.req.param("id") }),
      200
    );
  });

  return app;
};

export { createApp };

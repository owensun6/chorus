// Author: be-api-router
import { Hono } from "hono";
import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { randomUUID } from "crypto";
import { successResponse, errorResponse } from "../shared/response";

// --- Types ---

interface SSEClient {
  readonly id: string;
  readonly controller: ReadableStreamDefaultController;
}

interface SendMessageFn {
  (from: string, to: string, text: string): Promise<void>;
}

interface WebServerConfig {
  readonly sendMessage: SendMessageFn;
  readonly agents: ReadonlySet<string>;
}

interface WebServerResult {
  readonly app: Hono;
  readonly broadcast: (event: string, data: unknown) => void;
}

// --- Validation ---

const SendBodySchema = z.object({
  from_agent_id: z.string().min(1, "from_agent_id is required"),
  to_agent_id: z.string().min(1, "to_agent_id is required"),
  text: z.string().min(1, "text must not be empty"),
});

// --- Web Server Factory ---

const createWebServer = (config: WebServerConfig): WebServerResult => {
  const { sendMessage, agents } = config;
  const app = new Hono();
  const clients = new Set<SSEClient>();
  const encoder = new TextEncoder();

  const broadcast = (event: string, data: unknown): void => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoded = encoder.encode(payload);
    const deadClients: SSEClient[] = [];

    for (const client of clients) {
      try {
        client.controller.enqueue(encoded);
      } catch {
        deadClients.push(client);
      }
    }

    for (const dead of deadClients) {
      clients.delete(dead);
    }
  };

  // GET / — serve index.html
  app.get("/", (c) => {
    try {
      const htmlPath = join(__dirname, "..", "web", "index.html");
      const html = readFileSync(htmlPath, "utf-8");
      return c.html(html);
    } catch {
      return c.text("index.html not found", 500);
    }
  });

  // GET /events — SSE endpoint
  app.get("/events", (c) => {
    const clientId = randomUUID();

    const stream = new ReadableStream({
      start(controller) {
        const client: SSEClient = { id: clientId, controller };
        clients.add(client);

        // Send initial connected event
        const hello = encoder.encode(`event: connected\ndata: ${JSON.stringify({ client_id: clientId })}\n\n`);
        controller.enqueue(hello);
      },
      cancel() {
        for (const client of clients) {
          if (client.id === clientId) {
            clients.delete(client);
            break;
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  });

  // POST /api/send — send message via agent
  app.post("/api/send", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        errorResponse("ERR_VALIDATION", "Invalid JSON body"),
        400,
      );
    }

    const parsed = SendBodySchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return c.json(errorResponse("ERR_VALIDATION", message), 400);
    }

    const { from_agent_id, to_agent_id, text } = parsed.data;

    if (!agents.has(from_agent_id)) {
      return c.json(
        errorResponse("ERR_VALIDATION", `Unknown agent: ${from_agent_id}`),
        400,
      );
    }

    try {
      await sendMessage(from_agent_id, to_agent_id, text);
      const messageId = randomUUID();
      return c.json(
        successResponse({ message_id: messageId }),
        202,
      );
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      return c.json(
        errorResponse("ERR_SEND_FAILED", errMessage),
        500,
      );
    }
  });

  return { app, broadcast };
};

export { createWebServer, SendBodySchema };
export type { WebServerConfig, WebServerResult, SSEClient, SendMessageFn };

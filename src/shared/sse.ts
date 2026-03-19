// Author: be-domain-modeler

interface SSEEvent {
  readonly event: string;
  readonly data: string;
}

const formatSSE = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const parseSSEChunks = (raw: string): readonly SSEEvent[] => {
  const events: SSEEvent[] = [];
  const lines = raw.split("\n");
  let currentEvent = "";
  let currentData = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7);
    } else if (line.startsWith("data: ")) {
      currentData = line.slice(6);
    } else if (line === "" && currentEvent !== "") {
      events.push({ event: currentEvent, data: currentData });
      currentEvent = "";
      currentData = "";
    }
  }

  return events;
};

const SSE_ENCODER = new TextEncoder();

const singleSSEStream = (event: string, data: unknown): ReadableStream =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(SSE_ENCODER.encode(formatSSE(event, data)));
      controller.close();
    },
  });

export { formatSSE, parseSSEChunks, singleSSEStream, SSE_ENCODER };
export type { SSEEvent };

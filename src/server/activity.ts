// Author: be-domain-modeler

type ActivityEventType =
  | "agent_registered"
  | "agent_self_registered"
  | "agent_removed"
  | "message_submitted"
  | "message_forward_started"
  | "message_delivered"
  | "message_delivered_sse"
  | "message_failed";

interface ActivityEvent {
  readonly id: number;
  readonly type: ActivityEventType;
  readonly timestamp: string;
  readonly data: Readonly<Record<string, unknown>>;
}

type ActivitySubscriber = (event: ActivityEvent) => void;

interface ActivityStream {
  readonly append: (type: ActivityEventType, data: Record<string, unknown>) => ActivityEvent;
  readonly list: (since?: number) => readonly ActivityEvent[];
  readonly subscribe: (fn: ActivitySubscriber) => void;
  readonly unsubscribe: (fn: ActivitySubscriber) => void;
}

const createActivityStream = (maxEvents: number = 500): ActivityStream => {
  const buffer: Array<ActivityEvent | undefined> = new Array(maxEvents).fill(undefined);
  const subscribers = new Set<ActivitySubscriber>();
  let writeIndex = 0;
  let count = 0;
  let nextId = 1;

  const append = (type: ActivityEventType, data: Record<string, unknown>): ActivityEvent => {
    const event: ActivityEvent = Object.freeze({
      id: nextId,
      type,
      timestamp: new Date().toISOString(),
      data: Object.freeze({ ...data }),
    });
    nextId += 1;

    buffer[writeIndex] = event;
    writeIndex = (writeIndex + 1) % maxEvents;
    if (count < maxEvents) {
      count += 1;
    }

    for (const subscriber of subscribers) {
      try {
        subscriber(event);
      } catch {
        // subscriber errors must not affect other subscribers
      }
    }

    return event;
  };

  const list = (since?: number): readonly ActivityEvent[] => {
    const result: ActivityEvent[] = [];
    const start = count < maxEvents ? 0 : writeIndex;

    for (let i = 0; i < count; i++) {
      const idx = (start + i) % maxEvents;
      const event = buffer[idx];
      if (event === undefined) continue;
      if (since !== undefined && event.id <= since) continue;
      result.push(event);
    }

    return result;
  };

  const subscribe = (fn: ActivitySubscriber): void => {
    subscribers.add(fn);
  };

  const unsubscribe = (fn: ActivitySubscriber): void => {
    subscribers.delete(fn);
  };

  return { append, list, subscribe, unsubscribe };
};

export { createActivityStream };
export type { ActivityEvent, ActivityEventType, ActivitySubscriber, ActivityStream };

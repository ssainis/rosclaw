import type {
  CanonicalEventEnvelope,
  EventEntityType,
  EventSource,
  EventSeverity,
} from "./envelope";
import { validateCanonicalEventEnvelope } from "./envelope";

export interface EventRouteFilter {
  source?: EventSource;
  entity_type?: EventEntityType;
  entity_id?: string;
  event_type?: string | RegExp;
  severity?: EventSeverity;
}

export type EventRouteHandler = (event: CanonicalEventEnvelope) => void;

export type MalformedEventHandler = (input: unknown, errors: string[]) => void;

export interface EventBusOptions {
  getThrottleMs?: (event: CanonicalEventEnvelope) => number;
  getThrottleKey?: (event: CanonicalEventEnvelope) => string;
  now?: () => number;
}

export interface EventPublishResult {
  accepted: boolean;
  routedCount: number;
  malformedErrors: string[];
  handlerErrors: string[];
  throttled: boolean;
}

interface RouteEntry {
  id: number;
  filter: EventRouteFilter;
  handler: EventRouteHandler;
}

export interface EventBus {
  publish(input: unknown): EventPublishResult;
  subscribe(filter: EventRouteFilter, handler: EventRouteHandler): () => void;
  subscribeAll(handler: EventRouteHandler): () => void;
  onMalformed(handler: MalformedEventHandler): () => void;
}

function matchesFilter(event: CanonicalEventEnvelope, filter: EventRouteFilter): boolean {
  if (filter.source && event.source !== filter.source) return false;
  if (filter.entity_type && event.entity_type !== filter.entity_type) return false;
  if (filter.entity_id && event.entity_id !== filter.entity_id) return false;
  if (filter.severity && event.severity !== filter.severity) return false;

  if (filter.event_type !== undefined) {
    if (typeof filter.event_type === "string") {
      if (event.event_type !== filter.event_type) return false;
    } else if (!filter.event_type.test(event.event_type)) {
      return false;
    }
  }

  return true;
}

export function createEventBus(options: EventBusOptions = {}): EventBus {
  const routes: RouteEntry[] = [];
  const malformedHandlers = new Set<MalformedEventHandler>();
  const lastPublishedAtByKey = new Map<string, number>();
  const now = options.now ?? (() => Date.now());
  let routeId = 0;

  return {
    publish(input) {
      const validation = validateCanonicalEventEnvelope(input);
      if (!validation.ok) {
        for (const handler of malformedHandlers) {
          handler(input, validation.errors);
        }
        return {
          accepted: false,
          routedCount: 0,
          malformedErrors: validation.errors,
          handlerErrors: [],
          throttled: false,
        };
      }

      const event = input as CanonicalEventEnvelope;
      const throttleMs = Math.max(0, options.getThrottleMs?.(event) ?? 0);
      const throttleKey = options.getThrottleKey?.(event) ?? `${event.source}:${event.event_type}`;
      const current = now();

      if (throttleMs > 0) {
        const last = lastPublishedAtByKey.get(throttleKey);
        if (last !== undefined && current - last < throttleMs) {
          return {
            accepted: true,
            routedCount: 0,
            malformedErrors: [],
            handlerErrors: [],
            throttled: true,
          };
        }
        lastPublishedAtByKey.set(throttleKey, current);
      }

      let routedCount = 0;
      const handlerErrors: string[] = [];
      for (const route of routes) {
        if (!matchesFilter(event, route.filter)) continue;

        try {
          route.handler(event);
          routedCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          handlerErrors.push(`route:${route.id}: ${message}`);
        }
      }

      return {
        accepted: true,
        routedCount,
        malformedErrors: [],
        handlerErrors,
        throttled: false,
      };
    },

    subscribe(filter, handler) {
      const entry: RouteEntry = { id: ++routeId, filter, handler };
      routes.push(entry);

      return () => {
        const index = routes.findIndex((candidate) => candidate.id === entry.id);
        if (index >= 0) {
          routes.splice(index, 1);
        }
      };
    },

    subscribeAll(handler) {
      return this.subscribe({}, handler);
    },

    onMalformed(handler) {
      malformedHandlers.add(handler);

      return () => {
        malformedHandlers.delete(handler);
      };
    },
  };
}
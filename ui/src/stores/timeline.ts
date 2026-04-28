import { defineStore } from "pinia";
import type { CanonicalEventEnvelope, EventEntityType, EventSeverity, EventSource } from "../core/events/envelope";

const EVENT_LIMIT = 400;

export interface TimelineEventRecord {
  id: string;
  timestampSource: string;
  timestampUiReceived: string;
  source: EventSource;
  entityType: EventEntityType;
  entityId: string;
  eventType: string;
  severity: EventSeverity;
  traceId: string | null;
  payloadPreview: string;
}

interface TimelineState {
  events: TimelineEventRecord[];
}

function toPayloadPreview(payload: unknown): string {
  const text = JSON.stringify(payload);
  if (!text) return "null";
  if (text.length <= 140) return text;
  return `${text.slice(0, 137)}...`;
}

export const useTimelineStore = defineStore("timeline", {
  state: (): TimelineState => ({
    events: [],
  }),
  getters: {
    traceIds(state): string[] {
      return [...new Set(state.events.map((event) => event.traceId).filter((value): value is string => Boolean(value)))];
    },
  },
  actions: {
    ingestEnvelope(event: CanonicalEventEnvelope): void {
      const next: TimelineEventRecord = {
        id: event.event_id,
        timestampSource: event.timestamp_source,
        timestampUiReceived: event.timestamp_ui_received,
        source: event.source,
        entityType: event.entity_type,
        entityId: event.entity_id,
        eventType: event.event_type,
        severity: event.severity ?? "info",
        traceId: event.trace_id ?? null,
        payloadPreview: toPayloadPreview(event.payload),
      };

      this.events = [next, ...this.events.filter((entry) => entry.id !== next.id)].slice(0, EVENT_LIMIT);
    },
  },
});

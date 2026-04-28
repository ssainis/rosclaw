import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useTimelineStore } from "./timeline";

describe("timeline store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("records events with trace correlation metadata", () => {
    const store = useTimelineStore();

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "mission",
        entity_id: "mission-main",
        event_type: "mission:state",
        trace_id: "trace-42",
        payload: { status: "running", mode: "assist" },
      }),
    );

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "system",
        entity_id: "audit",
        event_type: "audit:entry",
        trace_id: "trace-42",
        payload: { action: "set-mode", result: "ok" },
      }),
    );

    expect(store.events.length).toBe(2);
    expect(store.traceIds).toEqual(["trace-42"]);
    expect(store.events[0].eventType).toBe("audit:entry");
    expect(store.events[0].payload).toMatchObject({ action: "set-mode", result: "ok" });
    expect(store.events[0].payloadPreview).toContain("set-mode");
  });
});

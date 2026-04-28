import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSessionCaptureStore } from "./session-capture";
import type { CanonicalEventEnvelope } from "../core/events/envelope";

function makeEnvelope(overrides: Partial<CanonicalEventEnvelope> = {}): CanonicalEventEnvelope {
  return {
    event_id: "evt-1",
    timestamp_source: "2026-01-01T00:00:00.000Z",
    timestamp_ui_received: "2026-01-01T00:00:01.000Z",
    source: "rl-ws",
    entity_type: "agent",
    entity_id: "agent-1",
    event_type: "agent:status",
    payload: { status: "running" },
    ...overrides,
  };
}

describe("session-capture store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with no recording state", () => {
    const store = useSessionCaptureStore();
    expect(store.isRecording).toBe(false);
    expect(store.capturedCount).toBe(0);
    expect(store.loadedSession).toBeNull();
  });

  it("starts recording and counts ingested envelopes", () => {
    const store = useSessionCaptureStore();
    store.startCapture("test session");
    expect(store.isRecording).toBe(true);
    store.ingestEnvelope(makeEnvelope({ event_id: "e1" }));
    store.ingestEnvelope(makeEnvelope({ event_id: "e2" }));
    expect(store.capturedCount).toBe(2);
  });

  it("ignores ingest calls when not recording", () => {
    const store = useSessionCaptureStore();
    store.ingestEnvelope(makeEnvelope());
    expect(store.capturedCount).toBe(0);
  });

  it("startCapture is idempotent when already recording", () => {
    const store = useSessionCaptureStore();
    store.startCapture("a");
    store.ingestEnvelope(makeEnvelope({ event_id: "e1" }));
    store.startCapture("b"); // second call ignored
    expect(store.capturedCount).toBe(1);
  });

  it("stopCapture returns a valid session file and clears recording state", () => {
    const store = useSessionCaptureStore();
    store.startCapture("my test");
    store.ingestEnvelope(makeEnvelope({ event_id: "e1", source: "rosbridge" }));
    store.ingestEnvelope(makeEnvelope({ event_id: "e2", source: "rl-ws" }));
    const file = store.stopCapture();
    expect(store.isRecording).toBe(false);
    expect(file).not.toBeNull();
    expect(file!.schema_version).toBe("1");
    expect(file!.metadata.label).toBe("my test");
    expect(file!.metadata.event_count).toBe(2);
    expect(file!.metadata.sources).toContain("rosbridge");
    expect(file!.metadata.sources).toContain("rl-ws");
    expect(file!.events).toHaveLength(2);
    expect(file!.metadata.end_timestamp).not.toBeNull();
  });

  it("exportSession returns valid JSON with captured events", () => {
    const store = useSessionCaptureStore();
    store.startCapture("export test");
    store.ingestEnvelope(makeEnvelope({ event_id: "e1" }));
    const json = store.exportSession();
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json!);
    expect(parsed.schema_version).toBe("1");
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].id).toBe("e1");
  });

  it("importSession round-trips a previously exported file", () => {
    const store = useSessionCaptureStore();
    store.startCapture("roundtrip");
    store.ingestEnvelope(makeEnvelope({ event_id: "e1", event_type: "agent:reward" }));
    const json = store.exportSession();
    store.stopCapture();

    const store2 = useSessionCaptureStore();
    // Reset to fresh store for import test
    store2.$reset();
    const ok = store2.importSession(json!);
    expect(ok).toBe(true);
    expect(store2.loadedSession).not.toBeNull();
    expect(store2.loadedEventCount).toBe(1);
    expect(store2.loadedSession!.events[0].eventType).toBe("agent:reward");
  });

  it("importSession rejects invalid JSON", () => {
    const store = useSessionCaptureStore();
    const ok = store.importSession("not json");
    expect(ok).toBe(false);
    expect(store.importError).toBe("Invalid JSON");
  });

  it("importSession rejects wrong schema version", () => {
    const store = useSessionCaptureStore();
    const ok = store.importSession(JSON.stringify({ schema_version: "2", metadata: {}, events: [] }));
    expect(ok).toBe(false);
    expect(store.importError).toBe("Invalid session file format");
  });

  it("clearLoadedSession removes the loaded file", () => {
    const store = useSessionCaptureStore();
    store.startCapture("c");
    const json = store.exportSession();
    store.stopCapture();
    store.importSession(json!);
    expect(store.loadedSession).not.toBeNull();
    store.clearLoadedSession();
    expect(store.loadedSession).toBeNull();
  });
});

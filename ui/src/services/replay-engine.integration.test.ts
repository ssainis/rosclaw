import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { createEventBus } from "../core/events/bus";
import { createReplayEngine } from "./replay-engine";
import type { SessionCaptureFile } from "../stores/session-capture";
import type { TimelineEventRecord } from "../stores/timeline";

vi.useFakeTimers();

function makeRecord(overrides: Partial<TimelineEventRecord> = {}): TimelineEventRecord {
  return {
    id: "evt-1",
    timestampSource: "2026-01-01T00:00:00.000Z",
    timestampUiReceived: "2026-01-01T00:00:00.000Z",
    source: "rl-ws",
    entityType: "agent",
    entityId: "a1",
    eventType: "agent:status",
    severity: "info",
    traceId: null,
    payload: { status: "running" },
    payloadPreview: '{"status":"running"}',
    ...overrides,
  };
}

function makeSession(records: TimelineEventRecord[]): SessionCaptureFile {
  return {
    schema_version: "1",
    metadata: {
      session_id: "s1",
      label: "test",
      start_timestamp: "2026-01-01T00:00:00.000Z",
      end_timestamp: "2026-01-01T00:01:00.000Z",
      event_count: records.length,
      sources: ["rl-ws"],
    },
    events: records,
  };
}

describe("replay-engine", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("starts in idle state with no session loaded", () => {
    const bus = createEventBus();
    const engine = createReplayEngine(bus);
    expect(engine.state.status).toBe("idle");
    expect(engine.state.totalEvents).toBe(0);
    expect(engine.state.currentIndex).toBe(0);
  });

  it("transitions to idle after load and reflects event count", () => {
    const bus = createEventBus();
    const engine = createReplayEngine(bus);
    const session = makeSession([makeRecord({ id: "e1" }), makeRecord({ id: "e2" })]);
    engine.load(session);
    expect(engine.state.status).toBe("idle");
    expect(engine.state.totalEvents).toBe(2);
    expect(engine.state.currentIndex).toBe(0);
  });

  it("plays all events instantly when speed is 0", () => {
    const bus = createEventBus();
    const published: string[] = [];
    bus.subscribeAll((e) => published.push(e.event_id));

    const engine = createReplayEngine(bus);
    engine.setSpeed(0);
    engine.load(
      makeSession([
        makeRecord({ id: "e1", timestampSource: "2026-01-01T00:00:00.000Z" }),
        makeRecord({ id: "e2", timestampSource: "2026-01-01T00:00:01.000Z" }),
        makeRecord({ id: "e3", timestampSource: "2026-01-01T00:00:02.000Z" }),
      ]),
    );
    engine.play();
    // With speed 0 all scheduled via setTimeout(0) - flush them
    vi.runAllTimers();
    expect(published).toEqual(["e1", "e2", "e3"]);
    expect(engine.state.status).toBe("ended");
  });

  it("publishes events with time-scaled delays", () => {
    const bus = createEventBus();
    const published: string[] = [];
    bus.subscribeAll((e) => published.push(e.event_id));

    const engine = createReplayEngine(bus);
    engine.setSpeed(1.0);
    engine.load(
      makeSession([
        makeRecord({ id: "e1", timestampSource: "2026-01-01T00:00:00.000Z" }),
        makeRecord({ id: "e2", timestampSource: "2026-01-01T00:00:01.000Z" }), // 1000ms later
      ]),
    );
    engine.play();

    // e1 published immediately
    expect(published).toEqual(["e1"]);
    // Advance 999ms — e2 not yet published
    vi.advanceTimersByTime(999);
    expect(published).toEqual(["e1"]);
    // Advance 1ms more — e2 published
    vi.advanceTimersByTime(1);
    expect(published).toEqual(["e1", "e2"]);
    expect(engine.state.status).toBe("ended");
  });

  it("pauses playback mid-stream", () => {
    const bus = createEventBus();
    const published: string[] = [];
    bus.subscribeAll((e) => published.push(e.event_id));

    const engine = createReplayEngine(bus);
    engine.setSpeed(1.0);
    engine.load(
      makeSession([
        makeRecord({ id: "e1", timestampSource: "2026-01-01T00:00:00.000Z" }),
        makeRecord({ id: "e2", timestampSource: "2026-01-01T00:00:01.000Z" }),
      ]),
    );
    engine.play();
    expect(published).toEqual(["e1"]);
    engine.pause();
    expect(engine.state.status).toBe("paused");
    vi.advanceTimersByTime(2000);
    // e2 should not have been published
    expect(published).toEqual(["e1"]);
  });

  it("resumes from paused position after play", () => {
    const bus = createEventBus();
    const published: string[] = [];
    bus.subscribeAll((e) => published.push(e.event_id));

    const engine = createReplayEngine(bus);
    engine.setSpeed(0);
    engine.load(
      makeSession([
        makeRecord({ id: "e1" }),
        makeRecord({ id: "e2" }),
        makeRecord({ id: "e3" }),
      ]),
    );
    engine.play();
    vi.runAllTimers();
    // All played
    expect(published).toEqual(["e1", "e2", "e3"]);
  });

  it("stop resets to beginning", () => {
    const bus = createEventBus();
    const engine = createReplayEngine(bus);
    engine.setSpeed(0);
    engine.load(makeSession([makeRecord({ id: "e1" }), makeRecord({ id: "e2" })]));
    engine.play();
    vi.runAllTimers();
    expect(engine.state.status).toBe("ended");
    engine.stop();
    expect(engine.state.status).toBe("idle");
    expect(engine.state.currentIndex).toBe(0);
  });

  it("seekTo repositions the playback cursor", () => {
    const bus = createEventBus();
    const engine = createReplayEngine(bus);
    engine.load(makeSession([makeRecord({ id: "e1" }), makeRecord({ id: "e2" }), makeRecord({ id: "e3" })]));
    engine.play();
    engine.pause();
    engine.seekTo(2);
    expect(engine.state.currentIndex).toBe(2);
  });

  it("notifies state change handlers on transitions", () => {
    const bus = createEventBus();
    const engine = createReplayEngine(bus);
    const states: string[] = [];
    engine.onStateChange((s) => states.push(s.status));
    engine.load(makeSession([makeRecord()]));
    engine.play();
    vi.runAllTimers();
    expect(states).toContain("playing");
    expect(states).toContain("ended");
  });

  it("sorts events chronologically on load", () => {
    const bus = createEventBus();
    const published: string[] = [];
    bus.subscribeAll((e) => published.push(e.event_id));
    const engine = createReplayEngine(bus);
    engine.setSpeed(0);
    engine.load(
      makeSession([
        makeRecord({ id: "e3", timestampSource: "2026-01-01T00:00:02.000Z" }),
        makeRecord({ id: "e1", timestampSource: "2026-01-01T00:00:00.000Z" }),
        makeRecord({ id: "e2", timestampSource: "2026-01-01T00:00:01.000Z" }),
      ]),
    );
    engine.play();
    vi.runAllTimers();
    expect(published).toEqual(["e1", "e2", "e3"]);
  });

  it("unsubscribes state change handler via returned teardown", () => {
    const bus = createEventBus();
    const engine = createReplayEngine(bus);
    const calls: string[] = [];
    const off = engine.onStateChange((s) => calls.push(s.status));
    
    // Register, then immediately unsubscribe before any state changes
    off();
    
    engine.load(makeSession([makeRecord()]));
    engine.play();
    vi.runAllTimers();
    
    // Handler should not have been called since we unsubscribed before load
    expect(calls).toHaveLength(0);
  });
});

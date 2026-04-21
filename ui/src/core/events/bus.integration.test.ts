import { describe, expect, it, vi } from "vitest";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "./envelope";
import { createEventBus } from "./bus";

function sampleEvent(overrides: Partial<ReturnType<typeof buildCanonicalEventEnvelope>> = {}) {
  return {
    ...buildCanonicalEventEnvelope(
      {
        source: "rosbridge",
        entity_type: "robot",
        entity_id: "robot-1",
        event_type: "topic:/odom",
        payload: { pose: { x: 1 } },
      },
      new Date("2026-01-03T10:00:00.000Z"),
    ),
    ...overrides,
  };
}

describe("event bus integration", () => {
  it("routes events by source and event_type filters", () => {
    resetEventCounterForTests();
    const bus = createEventBus();
    const sourceHandler = vi.fn();
    const regexHandler = vi.fn();
    const mismatchHandler = vi.fn();

    bus.subscribe({ source: "rosbridge" }, sourceHandler);
    bus.subscribe({ event_type: /^topic:\/o/ }, regexHandler);
    bus.subscribe({ source: "rl-ws" }, mismatchHandler);

    const result = bus.publish(sampleEvent());

    expect(result.accepted).toBe(true);
    expect(result.routedCount).toBe(2);
    expect(result.handlerErrors).toEqual([]);
    expect(sourceHandler).toHaveBeenCalledTimes(1);
    expect(regexHandler).toHaveBeenCalledTimes(1);
    expect(mismatchHandler).not.toHaveBeenCalled();
  });

  it("contains malformed events and notifies malformed handlers", () => {
    const bus = createEventBus();
    const malformedSpy = vi.fn();
    const routeSpy = vi.fn();

    bus.onMalformed(malformedSpy);
    bus.subscribeAll(routeSpy);

    const result = bus.publish({ bad: "shape" });

    expect(result.accepted).toBe(false);
    expect(result.routedCount).toBe(0);
    expect(result.malformedErrors.length).toBeGreaterThan(0);
    expect(malformedSpy).toHaveBeenCalledTimes(1);
    expect(routeSpy).not.toHaveBeenCalled();
  });

  it("contains route handler failures and continues routing", () => {
    resetEventCounterForTests();
    const bus = createEventBus();
    const badHandler = vi.fn(() => {
      throw new Error("handler exploded");
    });
    const goodHandler = vi.fn();

    bus.subscribeAll(badHandler);
    bus.subscribeAll(goodHandler);

    const result = bus.publish(sampleEvent());

    expect(result.accepted).toBe(true);
    expect(result.handlerErrors).toEqual(["route:1: handler exploded"]);
    expect(goodHandler).toHaveBeenCalledTimes(1);
  });

  it("supports throttle hooks for high-frequency streams", () => {
    resetEventCounterForTests();
    let current = 1_000;
    const bus = createEventBus({
      now: () => current,
      getThrottleMs: () => 100,
      getThrottleKey: (event) => `${event.entity_id}:${event.event_type}`,
    });
    const handler = vi.fn();
    bus.subscribeAll(handler);

    const first = bus.publish(sampleEvent());
    const second = bus.publish(sampleEvent({ event_id: "evt_custom" }));
    current = 1_120;
    const third = bus.publish(sampleEvent({ event_id: "evt_custom_2" }));

    expect(first.throttled).toBe(false);
    expect(second.throttled).toBe(true);
    expect(third.throttled).toBe(false);
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useRobotStore } from "./robot";

describe("robot store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("ingests odom events and computes pose", () => {
    const store = useRobotStore();
    const event = buildCanonicalEventEnvelope({
      source: "rosbridge",
      entity_type: "robot",
      entity_id: "robot-1",
      event_type: "topic:/odom",
      payload: {
        pose: {
          pose: {
            position: { x: 1.5, y: -0.25 },
            orientation: { z: 0, w: 1 },
          },
        },
      },
    });

    store.ingestEnvelope(event);

    expect(store.robotCount).toBe(1);
    expect(store.robots[0]).toMatchObject({
      id: "robot-1",
      x: 1.5,
      y: -0.25,
      theta: 0,
    });
  });

  it("computes online count from recency", () => {
    const store = useRobotStore();
    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rosbridge",
        entity_type: "robot",
        entity_id: "robot-1",
        event_type: "topic:/odom",
        timestamp_ui_received: "2026-01-01T00:00:00.000Z",
        payload: {
          pose: {
            pose: {
              position: { x: 0, y: 0 },
              orientation: { z: 0, w: 1 },
            },
          },
        },
      }),
    );

    vi.setSystemTime(new Date("2026-01-01T00:01:00.000Z"));
    expect(store.onlineCount).toBe(0);
  });
});
import { describe, expect, it, beforeEach } from "vitest";
import {
  buildCanonicalEventEnvelope,
  resetEventCounterForTests,
  rosHeaderStampToIso,
  validateCanonicalEventEnvelope,
} from "./envelope";

describe("canonical event envelope", () => {
  beforeEach(() => {
    resetEventCounterForTests();
  });

  it("builds a valid envelope with generated identifiers and timestamps", () => {
    const envelope = buildCanonicalEventEnvelope(
      {
        source: "rosbridge",
        entity_type: "robot",
        entity_id: "robot-1",
        event_type: "topic:/odom",
        payload: { pose: { x: 1 } },
      },
      new Date("2026-01-02T03:04:05.000Z"),
    );

    expect(envelope).toMatchObject({
      timestamp_source: "2026-01-02T03:04:05.000Z",
      timestamp_ui_received: "2026-01-02T03:04:05.000Z",
      source: "rosbridge",
      entity_type: "robot",
      entity_id: "robot-1",
      event_type: "topic:/odom",
    });
    expect(envelope.event_id).toBe("evt_2026-01-02T03:04:05.000Z_1");
  });

  it("returns validation errors for malformed envelope fields", () => {
    const validation = validateCanonicalEventEnvelope({
      event_id: "",
      timestamp_source: "not-a-date",
      timestamp_ui_received: "also-not-a-date",
      source: "unknown",
      entity_type: "bad",
      entity_id: "",
      event_type: "",
      severity: "panic",
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("event_id must be a non-empty string");
    expect(validation.errors).toContain("timestamp_source must be an ISO timestamp string");
    expect(validation.errors).toContain(
      "timestamp_ui_received must be an ISO timestamp string",
    );
    expect(validation.errors).toContain(
      "source must be one of: rosbridge, rl-ws, rl-rest, operator",
    );
    expect(validation.errors).toContain(
      "entity_type must be one of: robot, agent, mission, system, topic",
    );
    expect(validation.errors).toContain("entity_id must be a non-empty string");
    expect(validation.errors).toContain("event_type must be a non-empty string");
    expect(validation.errors).toContain(
      "severity must be one of: info, warning, error, critical when provided",
    );
  });

  it("extracts ISO timestamp from ROS header stamp variants", () => {
    const ros1Stamp = rosHeaderStampToIso({
      header: { stamp: { secs: 1_700_000_000, nsecs: 500_000_000 } },
    });
    const ros2Stamp = rosHeaderStampToIso({
      header: { stamp: { sec: 1_700_000_000, nanosec: 500_000_000 } },
    });

    expect(ros1Stamp).toBe("2023-11-14T22:13:20.500Z");
    expect(ros2Stamp).toBe("2023-11-14T22:13:20.500Z");
  });

  it("throws if built envelope violates required shape", () => {
    expect(() =>
      buildCanonicalEventEnvelope({
        source: "rosbridge",
        entity_type: "robot",
        entity_id: "",
        event_type: "topic:/odom",
        payload: {},
      }),
    ).toThrow("Invalid canonical event envelope");
  });
});
import { describe, it, expect } from "vitest";
import { analyzeEpisodeComparison } from "./episode-analysis";
import type { SessionCaptureFile } from "../stores/session-capture";
import type { TimelineEventRecord } from "../stores/timeline";

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
    payloadPreview: "{}",
    ...overrides,
  };
}

function makeSession(events: TimelineEventRecord[]): SessionCaptureFile {
  return {
    schema_version: "1",
    metadata: {
      session_id: "s1",
      label: "base",
      start_timestamp: "2026-01-01T00:00:00.000Z",
      end_timestamp: "2026-01-01T00:01:00.000Z",
      event_count: events.length,
      sources: ["rl-ws"],
    },
    events,
  };
}

describe("episode-analysis", () => {
  it("compares two identical sessions with no anomalies", () => {
    const base = makeSession([
      makeRecord({ id: "e1", eventType: "agent:reward", payload: { reward: 1.0 } }),
      makeRecord({ id: "e2", eventType: "agent:reward", payload: { reward: 1.0 } }),
      makeRecord({ id: "e3", eventType: "agent:action", payload: { action: "move" } }),
    ]);
    base.metadata.label = "base";

    const comp = makeSession([
      makeRecord({ id: "e1", eventType: "agent:reward", payload: { reward: 1.0 } }),
      makeRecord({ id: "e2", eventType: "agent:reward", payload: { reward: 1.0 } }),
      makeRecord({ id: "e3", eventType: "agent:action", payload: { action: "move" } }),
    ]);
    comp.metadata.label = "comparison";

    const result = analyzeEpisodeComparison(base, comp);
    expect(result.metrics.rewardDelta).toBe(0);
    expect(result.anomalies).toHaveLength(0);
  });

  it("detects reward improvement anomaly", () => {
    const base = makeSession([
      makeRecord({ id: "e1", eventType: "agent:reward", payload: { reward: 1.0 } }),
      makeRecord({ id: "e2", eventType: "agent:reward", payload: { reward: 1.0 } }),
    ]);
    base.metadata.label = "base";

    const comp = makeSession([
      makeRecord({ id: "e1", eventType: "agent:reward", payload: { reward: 2.0 } }),
      makeRecord({ id: "e2", eventType: "agent:reward", payload: { reward: 2.0 } }),
    ]);
    comp.metadata.label = "comparison";

    const result = analyzeEpisodeComparison(base, comp);
    expect(result.metrics.rewardDelta).toBe(1.0);
    expect(result.metrics.rewardDeltaPercent).toBe(100);
    expect(result.anomalies.length).toBeGreaterThan(0);
    expect(result.anomalies[0].type).toBe("reward-delta");
  });

  it("detects reward degradation anomaly as error severity", () => {
    const base = makeSession([
      makeRecord({ id: "e1", eventType: "agent:reward", payload: { reward: 10.0 } }),
    ]);
    base.metadata.label = "base";

    const comp = makeSession([
      makeRecord({ id: "e1", eventType: "agent:reward", payload: { reward: 5.0 } }),
    ]);
    comp.metadata.label = "comparison";

    const result = analyzeEpisodeComparison(base, comp);
    expect(result.anomalies[0].severity).toBe("error");
  });

  it("detects action count change anomaly", () => {
    const base = makeSession([
      makeRecord({ id: "e1", eventType: "agent:action", payload: { action: "move" } }),
      makeRecord({ id: "e2", eventType: "agent:action", payload: { action: "move" } }),
      makeRecord({ id: "e3", eventType: "agent:action", payload: { action: "move" } }),
    ]);
    base.metadata.label = "base";

    const comp = makeSession([
      makeRecord({ id: "e1", eventType: "agent:action", payload: { action: "move" } }),
      makeRecord({ id: "e2", eventType: "agent:action", payload: { action: "rotate" } }),
      makeRecord({ id: "e3", eventType: "agent:action", payload: { action: "move" } }),
      makeRecord({ id: "e4", eventType: "agent:action", payload: { action: "stop" } }),
    ]);
    comp.metadata.label = "comparison";

    const result = analyzeEpisodeComparison(base, comp);
    expect(result.metrics.actionCountDelta).toBe(1);
    // Changes > 20% should trigger anomaly, 1/3 = 33%
    expect(result.anomalies.some((a) => a.type === "action-count-delta")).toBe(true);
  });

  it("detects event sequence divergence", () => {
    const base = makeSession([
      makeRecord({ id: "e1", eventType: "agent:reward", payload: { reward: 1.0 } }),
      makeRecord({ id: "e2", eventType: "agent:action", payload: { action: "move" } }),
    ]);
    base.metadata.label = "base";

    const comp = makeSession([
      makeRecord({ id: "e2", eventType: "agent:action", payload: { action: "move" } }),
      makeRecord({ id: "e1", eventType: "agent:reward", payload: { reward: 1.0 } }),
    ]);
    comp.metadata.label = "comparison";

    const result = analyzeEpisodeComparison(base, comp);
    expect(result.metrics.sequenceDelta).toBeGreaterThan(0);
  });

  it("provides recommendation based on anomalies", () => {
    const base = makeSession([
      makeRecord({ id: "e1", eventType: "agent:reward", payload: { reward: 1.0 } }),
    ]);
    base.metadata.label = "base";

    const comp = makeSession([
      makeRecord({ id: "e1", eventType: "agent:reward", payload: { reward: 10.0 } }),
    ]);
    comp.metadata.label = "comparison";

    const result = analyzeEpisodeComparison(base, comp);
    expect(result.recommendation).toContain("outperformed");
  });

  it("handles sessions with no reward events", () => {
    const base = makeSession([
      makeRecord({ id: "e1", eventType: "agent:status", payload: {} }),
    ]);
    base.metadata.label = "base";

    const comp = makeSession([
      makeRecord({ id: "e1", eventType: "agent:status", payload: {} }),
    ]);
    comp.metadata.label = "comparison";

    const result = analyzeEpisodeComparison(base, comp);
    expect(result.metrics.baseRewardAvg).toBe(0);
    expect(result.metrics.comparisonRewardAvg).toBe(0);
  });
});

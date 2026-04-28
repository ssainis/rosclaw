import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useAgentStore } from "./agent";

describe("agent store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("tracks agent snapshot and status counts", () => {
    const store = useAgentStore();

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "agent-1",
        event_type: "agent:status",
        payload: {
          status: "running",
          objective: "patrol",
          policy_version: "v1.2.0",
        },
      }),
    );

    expect(store.agents.length).toBe(1);
    expect(store.activeAgents.length).toBe(1);
    expect(store.statusCounts.running).toBe(1);
    expect(store.agents[0].objective).toBe("patrol");
    expect(store.agents[0].lastReward).toBeNull();
    expect(store.agents[0].lastAction).toBeNull();
  });

  it("coerces unknown statuses", () => {
    const store = useAgentStore();

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "agent-2",
        event_type: "agent:status",
        payload: {
          status: "stopped",
        },
      }),
    );

    expect(store.statusCounts.unknown).toBe(1);
  });

  it("merges reward and action events without clobbering status", () => {
    const store = useAgentStore();

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "agent-3",
        event_type: "agent:status",
        payload: {
          status: "running",
          objective: "inspect",
          policy_version: "v2.0.0",
        },
      }),
    );

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "agent-3",
        event_type: "agent:reward",
        payload: {
          reward: 2.5,
        },
      }),
    );

    store.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "agent-3",
        event_type: "agent:action",
        payload: {
          action: "hold_position",
        },
      }),
    );

    expect(store.statusCounts.running).toBe(1);
    expect(store.agents[0].status).toBe("running");
    expect(store.agents[0].lastReward).toBe(2.5);
    expect(store.agents[0].lastAction).toBe("hold_position");
    expect(store.agents[0].rewardSeries).toEqual([2.5]);
    expect(store.agents[0].actionCounts).toEqual({ hold_position: 1 });
  });
});
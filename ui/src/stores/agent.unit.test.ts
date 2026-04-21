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
});
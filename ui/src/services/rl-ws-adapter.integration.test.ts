import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createEventBus } from "../core/events/bus";
import { resetEventCounterForTests } from "../core/events/envelope";
import { useAgentStore } from "../stores/agent";
import { useAlertsStore } from "../stores/alerts";
import { useMissionStore } from "../stores/mission";
import { useRobotStore } from "../stores/robot";
import { setupDomainEventRoutingForBus } from "./domain-event-routing";
import { ingestRlWsMessage, normalizeRlWsMessage } from "./rl-ws-adapter";

describe("rl ws adapter integration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("normalizes a replayed RL stream into canonical agent events", () => {
    const bus = createEventBus();
    const agentStore = useAgentStore();
    const teardown = setupDomainEventRoutingForBus(bus, {
      robotStore: useRobotStore(),
      agentStore,
      missionStore: useMissionStore(),
      alertsStore: useAlertsStore(),
    });
    const observedTypes: string[] = [];

    const unsubscribe = bus.subscribe({ source: "rl-ws" }, (event) => {
      observedTypes.push(event.event_type);
    });

    const replayFixtureStream = [
      {
        type: "agent_status",
        agent_id: "agent-7",
        status: "running",
        objective: "survey-bay-a",
        policy_version: "v3.1.0",
        timestamp: "2026-04-28T12:00:00.000Z",
      },
      {
        event: "reward",
        payload: {
          agent_id: "agent-7",
          reward: 1.75,
          episode_step: 42,
          timestamp: "2026-04-28T12:00:01.000Z",
        },
      },
      {
        kind: "action_output",
        data: {
          agent: { id: "agent-7" },
          action: "turn_left",
          preview: { linear_x: 0.0, angular_z: 0.4 },
          trace_id: "trace-rl-7",
          created_at: "2026-04-28T12:00:02.000Z",
        },
      },
    ];

    for (const message of replayFixtureStream) {
      const result = ingestRlWsMessage(bus, message);
      expect(result.ok).toBe(true);
      expect(result.publishResult?.accepted).toBe(true);
    }

    expect(observedTypes).toEqual(["agent:status", "agent:reward", "agent:action"]);
    expect(agentStore.agents.length).toBe(1);
    expect(agentStore.agents[0].status).toBe("running");
    expect(agentStore.agents[0].objective).toBe("survey-bay-a");
    expect(agentStore.agents[0].policyVersion).toBe("v3.1.0");
    expect(agentStore.agents[0].lastReward).toBe(1.75);
    expect(agentStore.agents[0].lastAction).toBe("turn_left");

    unsubscribe();
    teardown();
  });

  it("contains malformed RL messages without publishing to the bus", () => {
    const bus = createEventBus();
    const malformed = normalizeRlWsMessage({ type: "reward" });
    const ingested = ingestRlWsMessage(bus, { type: "reward" });

    expect(malformed.ok).toBe(false);
    expect(malformed.errors).toContain("RL message is missing agent_id");
    expect(ingested.ok).toBe(false);
    expect(ingested.publishResult).toBeUndefined();
  });
});
import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createEventBus } from "../core/events/bus";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useAgentStore } from "../stores/agent";
import { useAlertsStore } from "../stores/alerts";
import { useMissionStore } from "../stores/mission";
import { useRobotStore } from "../stores/robot";
import { useTimelineStore } from "../stores/timeline";
import { useTopicStore } from "../stores/topic";
import { setupDomainEventRoutingForBus } from "./domain-event-routing";

describe("domain event routing integration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("routes canonical events from bus into domain stores", () => {
    const robotStore = useRobotStore();
    const agentStore = useAgentStore();
    const missionStore = useMissionStore();
    const alertsStore = useAlertsStore();
    const topicStore = useTopicStore();
    const timelineStore = useTimelineStore();
    const bus = createEventBus();

    const dispose = setupDomainEventRoutingForBus(bus, {
      robotStore,
      agentStore,
      missionStore,
      alertsStore,
      topicStore,
      timelineStore,
    });

    bus.publish(
      buildCanonicalEventEnvelope({
        source: "rosbridge",
        entity_type: "robot",
        entity_id: "robot-1",
        event_type: "topic:/odom",
        payload: {
          pose: {
            pose: {
              position: { x: 2, y: 3 },
              orientation: { z: 0, w: 1 },
            },
          },
        },
      }),
    );

    bus.publish(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "agent-1",
        event_type: "agent:status",
        payload: {
          status: "running",
          objective: "survey",
          policy_version: "v2",
        },
      }),
    );

    bus.publish(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "mission",
        entity_id: "mission-main",
        event_type: "mission:state",
        payload: {
          status: "running",
          mode: "assist",
        },
      }),
    );

    bus.publish(
      buildCanonicalEventEnvelope({
        source: "rosbridge",
        entity_type: "topic",
        entity_id: "/odom",
        event_type: "topic:/odom",
        payload: {
          pose: {
            pose: {
              position: { x: 4, y: 5 },
              orientation: { z: 0, w: 1 },
            },
          },
        },
      }),
    );

    bus.publish(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "system",
        entity_id: "alerts",
        event_type: "alert:raised",
        severity: "critical",
        payload: {
          alert_id: "test-alert",
          severity: "critical",
          message: "Test alert",
        },
      }),
    );

    expect(robotStore.robotCount).toBe(1);
    expect(agentStore.statusCounts.running).toBe(1);
    expect(missionStore.isMissionActive).toBe(true);
    expect(alertsStore.criticalCount).toBe(1);
    expect(topicStore.topics[0]).toMatchObject({ name: "/odom", messageCount: 1 });
    expect(timelineStore.events.length).toBe(5);

    dispose();
  });

  it("contains malformed events by emitting a warning alert", () => {
    const bus = createEventBus();
    const dispose = setupDomainEventRoutingForBus(bus, {
      robotStore: useRobotStore(),
      agentStore: useAgentStore(),
      missionStore: useMissionStore(),
      alertsStore: useAlertsStore(),
      topicStore: useTopicStore(),
      timelineStore: useTimelineStore(),
    });

    bus.publish({ bad: "event" });

    const alertsStore = useAlertsStore();
    expect(alertsStore.alerts.length).toBe(1);
    expect(alertsStore.alerts[0].id).toBe("event-bus-malformed");
    expect(alertsStore.alerts[0].severity).toBe("warning");

    dispose();
  });
});
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
import { acknowledgeAlertForBus } from "./alerts-safety";

describe("alerts safety integration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("acknowledges active alerts through canonical event routing", () => {
    const alertsStore = useAlertsStore();
    const bus = createEventBus();
    const dispose = setupDomainEventRoutingForBus(bus, {
      robotStore: useRobotStore(),
      agentStore: useAgentStore(),
      missionStore: useMissionStore(),
      alertsStore,
      topicStore: useTopicStore(),
      timelineStore: useTimelineStore(),
    });

    bus.publish(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "system",
        entity_id: "safety",
        event_type: "alert:raised",
        severity: "critical",
        trace_id: "trace-estop-1",
        payload: {
          alert_id: "estop-1",
          severity: "critical",
          message: "Emergency stop activated",
        },
      }),
    );

    expect(alertsStore.unacknowledgedCount).toBe(1);

    acknowledgeAlertForBus(bus, {
      alertId: "estop-1",
      traceId: "trace-estop-1",
      message: "Reviewed by safety operator",
    });

    expect(alertsStore.unacknowledgedCount).toBe(0);
    expect(alertsStore.alerts[0].id).toBe("estop-1");
    expect(alertsStore.alerts[0].acknowledged).toBe(true);

    dispose();
  });
});

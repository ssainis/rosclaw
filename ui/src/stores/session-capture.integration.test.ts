import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { createEventBus } from "../core/events/bus";
import { buildCanonicalEventEnvelope } from "../core/events/envelope";
import { useSessionCaptureStore } from "../stores/session-capture";
import { useRobotStore } from "../stores/robot";
import { useAgentStore } from "../stores/agent";
import { useMissionStore } from "../stores/mission";
import { useAlertsStore } from "../stores/alerts";
import { useTopicStore } from "../stores/topic";
import { useTimelineStore } from "../stores/timeline";
import { setupDomainEventRoutingForBus } from "../services/domain-event-routing";

function makeBusWithStores() {
  const bus = createEventBus();
  const robotStore = useRobotStore();
  const agentStore = useAgentStore();
  const missionStore = useMissionStore();
  const alertsStore = useAlertsStore();
  const topicStore = useTopicStore();
  const timelineStore = useTimelineStore();
  const sessionCaptureStore = useSessionCaptureStore();
  const off = setupDomainEventRoutingForBus(bus, {
    robotStore,
    agentStore,
    missionStore,
    alertsStore,
    topicStore,
    timelineStore,
    sessionCaptureStore,
  });
  return { bus, sessionCaptureStore, timelineStore, off };
}

describe("session capture integration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("does not capture events when not recording", () => {
    const { bus, sessionCaptureStore } = makeBusWithStores();
    const evt = buildCanonicalEventEnvelope({
      source: "rl-ws",
      entity_type: "agent",
      entity_id: "a1",
      event_type: "agent:status",
      payload: { status: "running" },
    });
    bus.publish(evt);
    expect(sessionCaptureStore.capturedCount).toBe(0);
  });

  it("captures events into session while recording", () => {
    const { bus, sessionCaptureStore } = makeBusWithStores();
    sessionCaptureStore.startCapture("integration test");

    for (let i = 0; i < 3; i++) {
      bus.publish(
        buildCanonicalEventEnvelope({
          source: "rl-ws",
          entity_type: "agent",
          entity_id: `a${i}`,
          event_type: "agent:reward",
          payload: { reward: i },
        }),
      );
    }
    expect(sessionCaptureStore.capturedCount).toBe(3);
  });

  it("exports and round-trips a captured session through import", () => {
    const { bus, sessionCaptureStore } = makeBusWithStores();
    sessionCaptureStore.startCapture("roundtrip integration");

    bus.publish(
      buildCanonicalEventEnvelope({
        source: "rosbridge",
        entity_type: "robot",
        entity_id: "r1",
        event_type: "robot:pose",
        payload: { x: 1, y: 2 },
      }),
    );

    const file = sessionCaptureStore.stopCapture();
    const json = JSON.stringify(file);

    const store2 = useSessionCaptureStore();
    store2.$reset();
    const ok = store2.importSession(json);
    expect(ok).toBe(true);
    expect(store2.loadedEventCount).toBe(1);
    expect(store2.loadedSession!.events[0].eventType).toBe("robot:pose");
  });

  it("stops capturing after stopCapture even if bus continues publishing", () => {
    const { bus, sessionCaptureStore } = makeBusWithStores();
    sessionCaptureStore.startCapture("stop test");

    bus.publish(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "a1",
        event_type: "agent:status",
        payload: {},
      }),
    );
    sessionCaptureStore.stopCapture();
    const before = sessionCaptureStore.capturedCount;

    bus.publish(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "a1",
        event_type: "agent:status",
        payload: {},
      }),
    );
    // count should not grow after stop
    expect(sessionCaptureStore.capturedCount).toBe(before);
  });
});

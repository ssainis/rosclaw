import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useAgentStore } from "../stores/agent";
import { useAlertsStore } from "../stores/alerts";
import { resetLayoutPersistenceForTests } from "../stores/layout";
import { useMissionStore } from "../stores/mission";
import { useRobotStore } from "../stores/robot";
import { useTopicStore } from "../stores/topic";
import OverviewView from "./OverviewView.vue";

vi.mock("../services/rosbridge-connection", () => ({
  getRosbridgeClient: vi.fn(() => null),
}));

describe("OverviewView", () => {
  beforeEach(() => {
    resetLayoutPersistenceForTests();
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("renders empty-state panels before live events arrive", async () => {
    const wrapper = mount(OverviewView);
    await nextTick();

    expect(wrapper.get('[data-testid="overview-summary"]').text()).toContain("Robots Online");
    expect(wrapper.get('[data-testid="overview-alerts-empty"]').text()).toContain(
      "No alerts have been raised yet",
    );
    expect(wrapper.get('[data-testid="overview-events-empty"]').text()).toContain(
      "No topic events received yet",
    );
    expect(wrapper.text()).toContain("Waiting for /odom messages from rosbridge...");
  });

  it("renders summary cards, top alerts, and event preview from shared stores", async () => {
    const robotStore = useRobotStore();
    const agentStore = useAgentStore();
    const missionStore = useMissionStore();
    const alertsStore = useAlertsStore();
    const topicStore = useTopicStore();

    robotStore.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rosbridge",
        entity_type: "robot",
        entity_id: "robot-1",
        event_type: "topic:/odom",
        payload: {
          pose: {
            pose: {
              position: { x: 1.5, y: -2.1 },
              orientation: { z: 0, w: 1 },
            },
          },
        },
      }),
    );

    agentStore.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "agent-3",
        event_type: "agent:status",
        payload: {
          status: "running",
          objective: "survey-zone",
          policy_version: "v2",
        },
      }),
    );

    missionStore.ingestEnvelope(
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

    alertsStore.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "system",
        entity_id: "safety",
        event_type: "alert:raised",
        severity: "critical",
        payload: {
          alert_id: "motor-overheat",
          severity: "critical",
          message: "Motor temperature exceeded safety threshold",
        },
      }),
    );

    topicStore.setTopicSubscription("/odom", true, "nav_msgs/Odometry");
    topicStore.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rosbridge",
        entity_type: "topic",
        entity_id: "/odom",
        event_type: "topic:/odom",
        payload: {
          pose: {
            pose: {
              position: { x: 3, y: 4 },
              orientation: { z: 0, w: 1 },
            },
          },
        },
      }),
    );

    const wrapper = mount(OverviewView);
    await nextTick();

    expect(wrapper.get('[data-testid="overview-summary-robots"]').text()).toContain("1 / 1");
    expect(wrapper.get('[data-testid="overview-summary-agents"]').text()).toContain("1 / 1");
    expect(wrapper.get('[data-testid="overview-summary-mission"]').text()).toContain("running");
    expect(wrapper.get('[data-testid="overview-summary-alerts"]').text()).toContain("1");

    expect(wrapper.get('[data-testid="overview-alerts-list"]').text()).toContain(
      "Motor temperature exceeded safety threshold",
    );
    expect(wrapper.get('[data-testid="overview-events-table"]').text()).toContain("topic:/odom");
  });
});

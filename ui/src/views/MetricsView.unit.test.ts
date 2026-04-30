import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useAgentStore } from "../stores/agent";
import { useConnectionStore } from "../stores/connection";
import { useControlStore } from "../stores/control";
import MetricsView from "./MetricsView.vue";

describe("MetricsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("renders empty states before metrics streams are available", async () => {
    const wrapper = mount(MetricsView);
    await nextTick();

    expect(wrapper.get('[data-testid="metrics-reward-empty"]').text()).toContain(
      "Waiting for RL reward streams",
    );
    expect(wrapper.get('[data-testid="metrics-actions-empty"]').text()).toContain(
      "No action events",
    );
    expect(wrapper.get('[data-testid="metrics-latency-empty"]').text()).toContain(
      "No completed control actions",
    );
  });

  it("renders reward, action, and latency metrics under burst samples", async () => {
    const connectionStore = useConnectionStore();
    const agentStore = useAgentStore();
    const controlStore = useControlStore();
    connectionStore.setRlTransportStatus("connected");

    agentStore.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "agent-7",
        event_type: "agent:status",
        payload: { status: "running", objective: "patrol", policy_version: "v5" },
      }),
    );

    for (let index = 0; index < 24; index += 1) {
      agentStore.ingestEnvelope(
        buildCanonicalEventEnvelope({
          source: "rl-ws",
          entity_type: "agent",
          entity_id: "agent-7",
          event_type: "agent:reward",
          payload: { reward: 0.5 + index * 0.1 },
        }),
      );
    }

    for (let index = 0; index < 8; index += 1) {
      agentStore.ingestEnvelope(
        buildCanonicalEventEnvelope({
          source: "rl-ws",
          entity_type: "agent",
          entity_id: "agent-7",
          event_type: "agent:action",
          payload: { action: index % 2 === 0 ? "turn_left" : "drive_forward" },
        }),
      );
    }

    controlStore.markPending({
      actionId: "cmd-1",
      actionKey: "mission:set-mode",
      label: "Switch to assist",
      endpointName: "/control/set_mode",
      endpointType: "rosclaw_msgs/srv/SetMode",
      traceId: "trace-1",
      request: { mode: "assist" },
      submittedAt: "2026-04-28T00:00:00.000Z",
    });
    controlStore.markSucceeded("cmd-1", { success: true });

    const wrapper = mount(MetricsView);
    await nextTick();

    expect(wrapper.get('[data-testid="metrics-summary-samples"]').text()).toContain("24");
    expect(wrapper.get('[data-testid="metrics-summary-avg-reward"]').text()).toContain("1.");
    expect(wrapper.get('[data-testid="metrics-summary-success"]').text()).toContain("100.0%");

    expect(wrapper.get('[data-testid="metrics-action-histogram"]').text()).toContain("turn_left");
    expect(wrapper.get('[data-testid="metrics-action-histogram"]').text()).toContain("drive_forward");
    expect(wrapper.find('[data-testid="metrics-spark-agent-7"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="metrics-latency-table"]').text()).toContain("Switch to assist");
  });
});

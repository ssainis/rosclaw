import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useAgentStore } from "../stores/agent";
import { useConnectionStore } from "../stores/connection";
import AgentsView from "./AgentsView.vue";

describe("AgentsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
  });

  it("renders unavailable empty state when RL backend is idle", () => {
    const wrapper = mount(AgentsView);

    expect(wrapper.get('[data-testid="agents-empty-state"]').text()).toContain(
      "RL backend is unavailable",
    );
  });

  it("renders live agent updates from store events", async () => {
    const connectionStore = useConnectionStore();
    const agentStore = useAgentStore();
    connectionStore.setRlTransportStatus("connected");

    const wrapper = mount(AgentsView);

    agentStore.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "agent-17",
        event_type: "agent:status",
        payload: {
          status: "running",
          objective: "patrol-sector-c",
          policy_version: "v5.0.1",
        },
      }),
    );

    agentStore.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "agent-17",
        event_type: "agent:action",
        payload: {
          action: "turn_right",
        },
      }),
    );

    agentStore.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "rl-ws",
        entity_type: "agent",
        entity_id: "agent-17",
        event_type: "agent:reward",
        payload: {
          reward: 4.2,
        },
      }),
    );

    await nextTick();

    const table = wrapper.get('[data-testid="agents-table"]');
    expect(table.text()).toContain("agent-17");
    expect(table.text()).toContain("running");
    expect(table.text()).toContain("patrol-sector-c");
    expect(table.text()).toContain("v5.0.1");
    expect(table.text()).toContain("turn_right");
    expect(table.text()).toContain("4.200");
  });
});
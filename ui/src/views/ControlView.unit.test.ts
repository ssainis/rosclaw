import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { buildCanonicalEventEnvelope, resetEventCounterForTests } from "../core/events/envelope";
import { useMissionStore } from "../stores/mission";
import ControlView from "./ControlView.vue";

const { submitModeChangeMock, submitScenarioActionMock } = vi.hoisted(() => ({
  submitModeChangeMock: vi.fn(async () => ({ success: true })),
  submitScenarioActionMock: vi.fn(async () => ({ success: true, episode_id: "ep-7" })),
}));

vi.mock("../services/rosbridge-connection", () => ({
  ensureRosbridgeConnection: vi.fn(() => ({ id: "mock-client" })),
  getRosbridgeClient: vi.fn(() => ({ id: "mock-client" })),
}));

vi.mock("../services/control-center", () => ({
  CONTROL_ACTION_KEYS: {
    mode: "mission:set-mode",
    start: "scenario:start",
    reset: "scenario:reset",
  },
  DEFAULT_CONTROL_ENDPOINTS: {
    mode: { serviceName: "/control/set_mode", serviceType: "rosclaw_msgs/srv/SetMode" },
    start: { serviceName: "/scenario/start_episode", serviceType: "rosclaw_msgs/srv/ScenarioControl" },
    reset: { serviceName: "/scenario/reset_episode", serviceType: "rosclaw_msgs/srv/ScenarioControl" },
  },
  submitModeChange: submitModeChangeMock,
  submitScenarioAction: submitScenarioActionMock,
}));

describe("ControlView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetEventCounterForTests();
    submitModeChangeMock.mockClear();
    submitScenarioActionMock.mockClear();
  });

  it("requires confirmation before switching into autonomous mode", async () => {
    const missionStore = useMissionStore();
    missionStore.ingestEnvelope(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "mission",
        entity_id: "mission-main",
        event_type: "mission:state",
        payload: { status: "idle", mode: "manual" },
      }),
    );

    const wrapper = mount(ControlView);
    await nextTick();

    await wrapper.get('[data-testid="control-mode-autonomous"]').trigger("click");
    expect(submitModeChangeMock).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="control-error"]').text()).toContain("Confirm switching into autonomous");

    await wrapper.get('[data-testid="control-mode-confirm"]').setValue(true);
    await wrapper.get('[data-testid="control-mode-autonomous"]').trigger("click");

    expect(submitModeChangeMock).toHaveBeenCalledWith(
      { id: "mock-client" },
      "autonomous",
      { serviceName: "/control/set_mode", serviceType: "rosclaw_msgs/srv/SetMode" },
    );
  });

  it("submits scenario actions with parsed agent targets", async () => {
    const wrapper = mount(ControlView);
    await nextTick();

    await wrapper.get('[data-testid="control-scenario-id"]').setValue("warehouse-a");
    await wrapper.get('[data-testid="control-agent-targets"]').setValue("agent-1, agent-2");
    await wrapper.get('[data-testid="control-start-episode"]').trigger("click");

    expect(submitScenarioActionMock).toHaveBeenCalledWith(
      { id: "mock-client" },
      "start",
      { serviceName: "/scenario/start_episode", serviceType: "rosclaw_msgs/srv/ScenarioControl" },
      { scenarioId: "warehouse-a", agentIds: ["agent-1", "agent-2"] },
    );
    expect(wrapper.get('[data-testid="control-status"]').text()).toContain("Episode started for warehouse-a");
  });
});
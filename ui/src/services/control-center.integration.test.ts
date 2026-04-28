import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAgentStore } from "../stores/agent";
import { useAlertsStore } from "../stores/alerts";
import { useControlStore } from "../stores/control";
import { useMissionStore } from "../stores/mission";
import { useRobotStore } from "../stores/robot";
import { useTopicStore } from "../stores/topic";
import { ensureDomainEventRouting, shutdownDomainEventRouting } from "./domain-event-routing";
import {
  DEFAULT_CONTROL_ENDPOINTS,
  submitModeChange,
  submitScenarioAction,
} from "./control-center";

describe("control center integration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    shutdownDomainEventRouting();
    ensureDomainEventRouting({
      robotStore: useRobotStore(),
      agentStore: useAgentStore(),
      missionStore: useMissionStore(),
      alertsStore: useAlertsStore(),
      topicStore: useTopicStore(),
    });
  });

  it("submits mode and scenario actions through rosbridge and updates mission state", async () => {
    const callService = vi
      .fn()
      .mockResolvedValueOnce({ success: true, mode: "assist" })
      .mockResolvedValueOnce({ success: true, episode_id: "ep-7" });
    const client = { callService } as never;

    await expect(submitModeChange(client, "assist", DEFAULT_CONTROL_ENDPOINTS.mode)).resolves.toEqual({
      success: true,
      mode: "assist",
    });
    await expect(
      submitScenarioAction(client, "start", DEFAULT_CONTROL_ENDPOINTS.start, {
        scenarioId: "warehouse-a",
        agentIds: ["agent-1", "agent-2"],
      }),
    ).resolves.toEqual({ success: true, episode_id: "ep-7" });

    const controlStore = useControlStore();
    const missionStore = useMissionStore();

    expect(callService).toHaveBeenNthCalledWith(1, "/control/set_mode", { mode: "assist" }, "rosclaw_msgs/srv/SetMode");
    expect(callService).toHaveBeenNthCalledWith(
      2,
      "/scenario/start_episode",
      { scenario_id: "warehouse-a", agent_ids: ["agent-1", "agent-2"] },
      "rosclaw_msgs/srv/ScenarioControl",
    );
    expect(controlStore.history[0]).toMatchObject({
      label: "Start episode",
      status: "succeeded",
    });
    expect(controlStore.history[1]).toMatchObject({
      label: "Switch to assist",
      status: "succeeded",
    });
    expect(missionStore.current?.status).toBe("running");
    expect(missionStore.currentMissionMode).toBe("assist");
  });

  it("captures failed submissions and clears pending state", async () => {
    const client = {
      callService: vi.fn().mockRejectedValue(new Error("service unavailable")),
    } as never;

    await expect(submitModeChange(client, "manual", DEFAULT_CONTROL_ENDPOINTS.mode)).rejects.toThrow(
      "service unavailable",
    );

    const controlStore = useControlStore();
    expect(controlStore.isActionPending("mission:set-mode")).toBe(false);
    expect(controlStore.latestAction).toMatchObject({
      label: "Switch to manual",
      status: "failed",
      error: "service unavailable",
    });
  });
});
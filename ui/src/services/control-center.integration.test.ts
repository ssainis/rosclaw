import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAgentStore } from "../stores/agent";
import { useAlertsStore } from "../stores/alerts";
import { useControlStore } from "../stores/control";
import { useMissionStore } from "../stores/mission";
import { useRobotStore } from "../stores/robot";
import { useTimelineStore } from "../stores/timeline";
import { useTopicStore } from "../stores/topic";
import { ensureDomainEventRouting, shutdownDomainEventRouting } from "./domain-event-routing";
import {
  DEFAULT_CONTROL_ENDPOINTS,
  submitEmergencyStop,
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
      timelineStore: useTimelineStore(),
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
    const timelineStore = useTimelineStore();

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

    const auditEvents = timelineStore.events.filter((event) => event.eventType === "audit:entry");
    expect(auditEvents.length).toBe(4);
    expect(auditEvents[0].traceId).toBe(controlStore.history[0].traceId);
    expect(auditEvents[0].payload).toMatchObject({ result_status: "succeeded" });
    expect(auditEvents[1].payload).toMatchObject({ result_status: "pending" });
  });

  it("captures failed submissions and clears pending state", async () => {
    const client = {
      callService: vi.fn().mockRejectedValue(new Error("service unavailable")),
    } as never;

    await expect(submitModeChange(client, "manual", DEFAULT_CONTROL_ENDPOINTS.mode)).rejects.toThrow(
      "service unavailable",
    );

    const controlStore = useControlStore();
    const timelineStore = useTimelineStore();
    expect(controlStore.isActionPending("mission:set-mode")).toBe(false);
    expect(controlStore.latestAction).toMatchObject({
      label: "Switch to manual",
      status: "failed",
      error: "service unavailable",
    });

    const auditEvents = timelineStore.events.filter((event) => event.eventType === "audit:entry");
    expect(auditEvents.length).toBe(2);
    expect(auditEvents[0].payload).toMatchObject({ result_status: "failed" });
    expect(auditEvents[1].payload).toMatchObject({ result_status: "pending" });
  });

  it("submits emergency stop with reason and emits audit-worthy critical alert", async () => {
    const callService = vi.fn().mockResolvedValueOnce({ success: true });
    const client = { callService } as never;

    await expect(
      submitEmergencyStop(client, DEFAULT_CONTROL_ENDPOINTS.estop, "human entered protected zone"),
    ).resolves.toEqual({ success: true });

    const controlStore = useControlStore();
    const missionStore = useMissionStore();
    const alertsStore = useAlertsStore();

    expect(callService).toHaveBeenCalledWith(
      "/control/estop",
      { reason: "human entered protected zone" },
      "rosclaw_msgs/srv/EStop",
    );
    expect(controlStore.latestAction).toMatchObject({
      label: "Emergency stop",
      status: "succeeded",
      request: { reason: "human entered protected zone" },
    });
    expect(missionStore.current?.status).toBe("paused");
    expect(missionStore.currentMissionMode).toBe("manual");
    expect(alertsStore.criticalCount).toBe(1);
    expect(alertsStore.alerts[0].message).toContain("Emergency stop activated");
  });
});
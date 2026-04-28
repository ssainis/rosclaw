import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useControlStore } from "./control";

describe("control store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("tracks pending actions and clears them when completed", () => {
    const store = useControlStore();

    store.markPending({
      actionId: "action-1",
      actionKey: "mission:set-mode",
      label: "Switch to assist",
      endpointName: "/control/set_mode",
      endpointType: "rosclaw_msgs/srv/SetMode",
      traceId: "trace-1",
      request: { mode: "assist" },
      submittedAt: "2025-01-01T00:00:00.000Z",
    });

    expect(store.isActionPending("mission:set-mode")).toBe(true);
    expect(store.latestAction?.status).toBe("pending");

    store.markSucceeded("action-1", { success: true });

    expect(store.isActionPending("mission:set-mode")).toBe(false);
    expect(store.latestAction?.status).toBe("succeeded");
    expect(store.latestAction?.response).toEqual({ success: true });
  });

  it("stores failure details when an action fails", () => {
    const store = useControlStore();

    store.markPending({
      actionId: "action-2",
      actionKey: "scenario:start",
      label: "Start episode",
      endpointName: "/scenario/start_episode",
      endpointType: "rosclaw_msgs/srv/ScenarioControl",
      traceId: "trace-2",
      request: { scenario_id: "warehouse-a", agent_ids: ["agent-1"] },
      submittedAt: "2025-01-01T00:00:00.000Z",
    });

    store.markFailed("action-2", "timeout");

    expect(store.isActionPending("scenario:start")).toBe(false);
    expect(store.latestAction?.status).toBe("failed");
    expect(store.latestAction?.error).toBe("timeout");
  });
});
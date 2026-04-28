import { buildCanonicalEventEnvelope } from "../core/events/envelope";
import { eventBus } from "../core/events/runtime";
import type { RosbridgeClient } from "../rosbridge";
import { callRosService } from "./topic-explorer";
import { useControlStore } from "../stores/control";
import { useMissionStore } from "../stores/mission";

export type MissionMode = "manual" | "assist" | "autonomous";
export type ScenarioAction = "start" | "reset";

export interface ControlEndpoint {
  serviceName: string;
  serviceType: string;
}

export interface ScenarioRequest {
  scenarioId: string;
  agentIds: string[];
}

export const CONTROL_ACTION_KEYS = {
  mode: "mission:set-mode",
  start: "scenario:start",
  reset: "scenario:reset",
  estop: "safety:estop",
} as const;

export const DEFAULT_CONTROL_ENDPOINTS: Record<"mode" | ScenarioAction | "estop", ControlEndpoint> = {
  mode: {
    serviceName: "/control/set_mode",
    serviceType: "rosclaw_msgs/srv/SetMode",
  },
  start: {
    serviceName: "/scenario/start_episode",
    serviceType: "rosclaw_msgs/srv/ScenarioControl",
  },
  reset: {
    serviceName: "/scenario/reset_episode",
    serviceType: "rosclaw_msgs/srv/ScenarioControl",
  },
  estop: {
    serviceName: "/control/estop",
    serviceType: "rosclaw_msgs/srv/EStop",
  },
};

function makeActionId(actionKey: string): string {
  return `${actionKey}:${Date.now()}`;
}

function makeTraceId(actionKey: string): string {
  return `trace:${actionKey}:${Date.now()}`;
}

function currentMissionStatus(): string {
  return useMissionStore().current?.status ?? "unknown";
}

function publishMissionSnapshot(eventType: string, traceId: string, payload: Record<string, unknown>): void {
  eventBus.publish(
    buildCanonicalEventEnvelope({
      source: "operator",
      entity_type: "mission",
      entity_id: "mission-main",
      event_type: eventType,
      trace_id: traceId,
      payload,
    }),
  );
}

export async function submitModeChange(
  client: RosbridgeClient,
  mode: MissionMode,
  endpoint: ControlEndpoint,
): Promise<Record<string, unknown>> {
  const controlStore = useControlStore();
  const actionId = makeActionId(CONTROL_ACTION_KEYS.mode);
  const traceId = makeTraceId(CONTROL_ACTION_KEYS.mode);
  const request = { mode };

  controlStore.markPending({
    actionId,
    actionKey: CONTROL_ACTION_KEYS.mode,
    label: `Switch to ${mode}`,
    endpointName: endpoint.serviceName,
    endpointType: endpoint.serviceType,
    traceId,
    request,
    submittedAt: new Date().toISOString(),
  });

  try {
    const response = await callRosService(client, endpoint.serviceName, endpoint.serviceType, request);
    publishMissionSnapshot("mission:state", traceId, {
      status: currentMissionStatus(),
      mode,
    });
    controlStore.markSucceeded(actionId, response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mode change failed";
    controlStore.markFailed(actionId, message);
    throw error;
  }
}

export async function submitScenarioAction(
  client: RosbridgeClient,
  action: ScenarioAction,
  endpoint: ControlEndpoint,
  request: ScenarioRequest,
): Promise<Record<string, unknown>> {
  const actionKey = CONTROL_ACTION_KEYS[action];
  const controlStore = useControlStore();
  const actionId = makeActionId(actionKey);
  const traceId = makeTraceId(actionKey);
  const payload = {
    scenario_id: request.scenarioId,
    agent_ids: request.agentIds,
  };

  controlStore.markPending({
    actionId,
    actionKey,
    label: action === "start" ? "Start episode" : "Reset episode",
    endpointName: endpoint.serviceName,
    endpointType: endpoint.serviceType,
    traceId,
    request: payload,
    submittedAt: new Date().toISOString(),
  });

  try {
    const response = await callRosService(client, endpoint.serviceName, endpoint.serviceType, payload);
    publishMissionSnapshot("mission:state", traceId, {
      status: action === "start" ? "running" : "idle",
      mode: useMissionStore().currentMissionMode,
    });
    controlStore.markSucceeded(actionId, response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scenario action failed";
    controlStore.markFailed(actionId, message);
    throw error;
  }
}

export async function submitEmergencyStop(
  client: RosbridgeClient,
  endpoint: ControlEndpoint,
  reason: string,
): Promise<Record<string, unknown>> {
  const actionKey = CONTROL_ACTION_KEYS.estop;
  const controlStore = useControlStore();
  const actionId = makeActionId(actionKey);
  const traceId = makeTraceId(actionKey);
  const payload = { reason };

  controlStore.markPending({
    actionId,
    actionKey,
    label: "Emergency stop",
    endpointName: endpoint.serviceName,
    endpointType: endpoint.serviceType,
    traceId,
    request: payload,
    submittedAt: new Date().toISOString(),
  });

  try {
    const response = await callRosService(client, endpoint.serviceName, endpoint.serviceType, payload);
    publishMissionSnapshot("mission:state", traceId, {
      status: "paused",
      mode: "manual",
    });
    eventBus.publish(
      buildCanonicalEventEnvelope({
        source: "operator",
        entity_type: "system",
        entity_id: "safety",
        event_type: "alert:raised",
        severity: "critical",
        trace_id: traceId,
        payload: {
          alert_id: `estop-${actionId}`,
          severity: "critical",
          message: `Emergency stop activated: ${reason}`,
        },
      }),
    );
    controlStore.markSucceeded(actionId, response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Emergency stop failed";
    controlStore.markFailed(actionId, message);
    throw error;
  }
}
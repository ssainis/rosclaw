import { defineStore } from "pinia";
import type { CanonicalEventEnvelope } from "../core/events/envelope";

export interface RobotTelemetry {
  id: string;
  x: number;
  y: number;
  theta: number;
  lastSourceTimestamp: string;
  lastUiReceivedTimestamp: string;
  lastEventType: string;
}

interface RobotState {
  robotsById: Record<string, RobotTelemetry>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function parseOdomPose(payload: unknown): { x: number; y: number; theta: number } | null {
  const root = asRecord(payload);
  if (!root) return null;

  const poseOuter = asRecord(root.pose);
  const pose = asRecord(poseOuter?.pose);
  const position = asRecord(pose?.position);
  const orientation = asRecord(pose?.orientation);

  const x = position?.x;
  const y = position?.y;
  const z = orientation?.z;
  const w = orientation?.w;

  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number" ||
    typeof w !== "number"
  ) {
    return null;
  }

  return {
    x,
    y,
    theta: 2 * Math.atan2(z, w),
  };
}

export const useRobotStore = defineStore("robot", {
  state: (): RobotState => ({
    robotsById: {},
  }),
  getters: {
    robots(state): RobotTelemetry[] {
      return Object.values(state.robotsById);
    },
    robotCount(): number {
      return this.robots.length;
    },
    onlineCount(): number {
      return this.robots.filter((robot) => {
        const age = Date.now() - Date.parse(robot.lastUiReceivedTimestamp);
        return age <= 30_000;
      }).length;
    },
  },
  actions: {
    ingestEnvelope(event: CanonicalEventEnvelope): void {
      if (event.entity_type !== "robot") return;
      if (event.event_type !== "topic:/odom") return;

      const pose = parseOdomPose(event.payload);
      if (!pose) return;

      this.robotsById[event.entity_id] = {
        id: event.entity_id,
        x: pose.x,
        y: pose.y,
        theta: pose.theta,
        lastSourceTimestamp: event.timestamp_source,
        lastUiReceivedTimestamp: event.timestamp_ui_received,
        lastEventType: event.event_type,
      };
    },
  },
});